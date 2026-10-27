// Public config: Supabase URL and publishable key, push key, map tiles, the Facebook Login switch.
// Read at runtime, not baked in at build, so one Docker image works with whichever Supabase it's pointed at
// (no build variables, and changing a value needs a restart, not a rebuild):
// - server: process.env, read by computed name so Next.js doesn't inline the (empty) build-time values;
// - browser: window.__WFH_ENV__, set by the /runtime-env script in the root layout's <head>.

export type PublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  vapidPublicKey: string;
  mapTileUrl: string;
  mapAttribution: string;
  facebookLogin: boolean;
};

declare global {
  interface Window {
    __WFH_ENV__?: PublicEnv;
  }
}

const EMPTY: PublicEnv = {
  supabaseUrl: "",
  supabasePublishableKey: "",
  vapidPublicKey: "",
  mapTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  mapAttribution: "&copy; OpenStreetMap contributors",
  facebookLogin: false,
};

/** Server only: the public config from the server's environment at request time. */
export function readServerPublicEnv(): PublicEnv {
  const env = process.env;
  const get = (name: string) => env[`NEXT_PUBLIC_${name}`]?.trim() || undefined;
  return {
    supabaseUrl: get("SUPABASE_URL") ?? EMPTY.supabaseUrl,
    supabasePublishableKey: get("SUPABASE_PUBLISHABLE_KEY") ?? EMPTY.supabasePublishableKey,
    vapidPublicKey: get("VAPID_PUBLIC_KEY") ?? EMPTY.vapidPublicKey,
    mapTileUrl: get("MAP_TILE_URL") ?? EMPTY.mapTileUrl,
    mapAttribution: get("MAP_ATTRIBUTION") ?? EMPTY.mapAttribution,
    facebookLogin: get("FACEBOOK_LOGIN") === "on",
  };
}

/** The public config on either side. */
export function publicEnv(): PublicEnv {
  if (typeof window !== "undefined") return window.__WFH_ENV__ ?? EMPTY;
  return readServerPublicEnv();
}

export function supabaseConfig(): { url: string; key: string } {
  const { supabaseUrl, supabasePublishableKey } = publicEnv();
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the server's environment. See apps/web/.env.example.",
    );
  }
  return { url: supabaseUrl, key: supabasePublishableKey };
}
