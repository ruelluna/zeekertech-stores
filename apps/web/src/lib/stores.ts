import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { MENU_TAG } from "./menu-tag";
import { createSupabasePublicClient } from "./supabase/server";

/** Where "/" and the old single-store links (/checkout, /account, /login) go. */
export const DEFAULT_STORE_SLUG = "weekendfoodhub";

export interface Store {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  /** How customers reach the store (Facebook Page link or mobile number). */
  contact: string | null;
  /** The store's one accent colour (hex), see DESIGN.md "Storefront theme". */
  accent_color: string;
  /** Optional logo shown instead of the name in script. */
  logo_url: string | null;
  active: boolean;
}

/** Every store, active or not, in display order. Cached until a store or menu change. */
export async function listStores(): Promise<Store[]> {
  "use cache";
  cacheTag(MENU_TAG);
  cacheLife("minutes");

  const { data, error } = await createSupabasePublicClient()
    .schema("store")
    .from("stores")
    .select("id, slug, name, tagline, contact, accent_color, logo_url, active")
    .order("sort_order");
  if (error) throw error;
  return data;
}

/** The active store at /s/<slug>, or a 404. */
export async function getStore(slug: string): Promise<Store> {
  const store = (await listStores()).find((s) => s.slug === slug && s.active);
  if (!store) notFound();
  return store;
}

export async function getStoreById(id: string): Promise<Store | null> {
  return (await listStores()).find((s) => s.id === id) ?? null;
}

/** Storefront path inside a store, e.g. storePath("treatsbyyang", "/checkout"). */
export function storePath(slug: string, path = ""): string {
  return `/s/${slug}${path}`;
}
