/** Bilinen takip parametreleri temizlenir; diğer query parametreleri korunur. */
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "igshid",
  "igsh",
  "si",
  "ref",
  "ref_src",
  "s",
  "t",
]);

/**
 * Geçerli http/https URL'sini normalize eder; geçersizse null döner.
 * Etkinlik ID'si taşıyan bilinmeyen parametreler korunur.
 */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  let out = parsed.toString();
  if (out.endsWith("/") && parsed.pathname === "/" && parsed.search === "") {
    out = out.slice(0, -1);
  }
  return out;
}

/** Serbest metinden http/https bağlantılarını çıkarır. */
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of matches) {
    const normalized = normalizeUrl(match);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}
