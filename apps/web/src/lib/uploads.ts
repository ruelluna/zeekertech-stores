import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Uploads an image to the public bucket and returns its public URL. */
export async function uploadPublicImage(file: File, folder: "gcash" | "products"): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Image is too big (max 5 MB)" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "That file isn't an image" };

  const ext = file.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const storage = createSupabaseAdminClient().storage.from("store-public");
  const { error } = await storage.upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: storage.getPublicUrl(path).data.publicUrl };
}
