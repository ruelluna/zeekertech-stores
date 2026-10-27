// Creates (or resets) the local test owner account from apps/web/.env.local.
// Local development only: refuses to run against anything but localhost.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.DEV_OWNER_EMAIL;
const password = process.env.DEV_OWNER_PASSWORD;

if (!url || !secret || !email || !password) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, DEV_OWNER_EMAIL and DEV_OWNER_PASSWORD in apps/web/.env.local");
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
  console.error(`Refusing to create a test owner on ${url}: local Supabase only.`);
  process.exit(1);
}

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: list, error: listError } = await admin.auth.admin.listUsers();
if (listError) throw listError;

let user = list.users.find((u) => u.email === email);
if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) throw error;
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
}

const { error: staffError } = await admin
  .schema("ops")
  .from("staff_users")
  .upsert({ user_id: user.id, display_name: "Owner (local)", role: "owner", active: true });
if (staffError) throw staffError;

console.log(`Local owner ready: ${email} (password in apps/web/.env.local). Sign in at http://localhost:3000/admin`);
