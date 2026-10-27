// Creates (or resets) a local test customer for checking logged-in ordering without Facebook.
// Local development only: refuses to run against anything but localhost.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.DEV_CUSTOMER_EMAIL ?? "customer@wfh.test";
const password = process.env.DEV_CUSTOMER_PASSWORD;

if (!url || !secret || !password) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and DEV_CUSTOMER_PASSWORD in apps/web/.env.local");
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Refusing to create a test customer on ${url}: local Supabase only.`);
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: list, error: listError } = await admin.auth.admin.listUsers();
if (listError) throw listError;

const existing = list.users.find((u) => u.email === email);
if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
  if (error) throw error;
} else {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Test Customer" },
  });
  if (error) throw error;
}
console.log(`Local test customer ready: ${email} (password in apps/web/.env.local). Sign in at http://localhost:3100/login`);
