import { connection } from "next/server";
import { readServerPublicEnv } from "@/lib/supabase/env";

// Hands the browser its public config at runtime (loaded by a <script> in the root layout's <head>).
export async function GET() {
  await connection();
  return new Response(`window.__WFH_ENV__ = ${JSON.stringify(readServerPublicEnv())};\n`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
