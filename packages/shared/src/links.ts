/**
 * A store's Facebook Page link as owners paste it ("facebook.com/weekendfoodhub", "m.facebook.com/...",
 * "https://www.facebook.com/profile.php?id=123") → "https://www.facebook.com/...". Null if it isn't a
 * Facebook link. Matches the database check on store.stores.facebook_url.
 */
export function normalizeFacebookUrl(value: string): string | null {
  const text = value.trim();
  if (!text || /\s/.test(text)) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const facebook = /^([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)$/.test(host);
  if (!facebook || url.pathname === "/" || url.pathname === "") {
    // A bare facebook.com is not a Page; profile.php keeps its id in the query.
    if (!(facebook && url.searchParams.has("id"))) return null;
  }
  const canonicalHost = host === "fb.me" || host.endsWith(".fb.me") ? host : "www.facebook.com";
  const out = `https://${canonicalHost}${url.pathname}${url.search}`;
  return out.length <= 200 ? out : null;
}
