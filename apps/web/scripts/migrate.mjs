// Applies pending database migrations (supabase/migrations) when the website container starts, after
// backing up the whole database (every store) to Supabase Storage. Runs before `next start` (see the
// Dockerfile); a failed backup or migration stops the start, so the new version never runs against a
// half-migrated database.
//
// Env: DATABASE_URL (direct Postgres connection; without it this script does nothing),
//      NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (backup upload),
//      MIGRATE_SKIP_BACKUP=1 (local testing only).

import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../supabase/migrations");
const BACKUP_BUCKET = "db-backups";
const KEEP_BACKUPS = 10;
// Any constant: only one container migrates at a time.
const LOCK_KEY = 727001;

const log = (...args) => console.log("[migrate]", ...args);

async function pendingMigrations(db) {
  await db.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
  `);
  const { rows } = await db.query("select version from supabase_migrations.schema_migrations");
  const applied = new Set(rows.map((r) => r.version));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  return files
    .map((file) => ({ file, version: file.split("_")[0], name: file.replace(/^\d+_/, "").replace(/\.sql$/, "") }))
    .filter((m) => !applied.has(m.version));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}: ${stderr.trim()}`))));
  });
}

/** Full dump of the database (custom format, for pg_restore), uploaded before anything changes. */
async function backup(label) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are needed to store the backup");

  const dir = await mkdtemp(join(tmpdir(), "wfh-backup-"));
  const file = join(dir, "backup.dump");
  try {
    await run("pg_dump", ["--format=custom", "--no-owner", `--file=${file}`, `--dbname=${process.env.DATABASE_URL}`]);
    const storage = createClient(url, key, { auth: { persistSession: false } }).storage;
    const { error: bucketError } = await storage.createBucket(BACKUP_BUCKET, { public: false });
    if (bucketError && !/already exists/i.test(bucketError.message)) throw bucketError;

    const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-before-${label}.dump`;
    const { error } = await storage.from(BACKUP_BUCKET).upload(name, await readFile(file), { contentType: "application/octet-stream" });
    if (error) throw error;
    log(`backup saved: ${BACKUP_BUCKET}/${name}`);

    // Keep the newest few (names start with the time, so they sort by age).
    const { data: existing } = await storage.from(BACKUP_BUCKET).list("", { limit: 1000, sortBy: { column: "name", order: "desc" } });
    const old = (existing ?? []).filter((o) => o.name.endsWith(".dump")).slice(KEEP_BACKUPS).map((o) => o.name);
    if (old.length) await storage.from(BACKUP_BUCKET).remove(old);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    log("DATABASE_URL isn't set, so migrations are skipped (run them by hand)");
    return;
  }
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    const pending = await pendingMigrations(db);
    if (pending.length === 0) {
      log("database is up to date");
      return;
    }
    log(`${pending.length} to apply: ${pending.map((m) => m.file).join(", ")}`);

    if (process.env.MIGRATE_SKIP_BACKUP === "1") log("backup skipped (MIGRATE_SKIP_BACKUP=1)");
    else await backup(pending[0].version);

    // Each migration in its own transaction: all of it applies, or none of it.
    for (const m of pending) {
      const sql = await readFile(join(MIGRATIONS_DIR, m.file), "utf8");
      try {
        await db.query("begin");
        await db.query(sql);
        await db.query("insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)", [m.version, m.name]);
        await db.query("commit");
        log(`applied ${m.file}`);
      } catch (e) {
        await db.query("rollback").catch(() => {});
        throw new Error(`${m.file} failed and was rolled back: ${e.message}`);
      }
    }
    // Let the API see new tables and columns right away.
    await db.query("notify pgrst, 'reload schema'");
  } finally {
    await db.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    await db.end();
  }
}

main().catch((e) => {
  console.error("[migrate] stopped:", e.message);
  process.exit(1);
});
