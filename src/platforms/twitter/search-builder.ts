import type { SearchOptions } from "../../core/types/platform";
import { X_BASE_URL } from "./selectors";

/**
 * X'te native tarih filtresi yok; `since:` operatörü kullanılır ve
 * sonuçlar publishedAt ile de kontrol edilir.
 */
export function buildXSearchUrl(options: SearchOptions): string {
  const query = options.queries[0] ?? "";
  const parts = [query];
  if (options.lastDays) {
    const since = new Date(Date.now() - options.lastDays * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    parts.push(`since:${since}`);
  }
  const params = new URLSearchParams({ q: parts.join(" "), f: "live" });
  return `${X_BASE_URL}/search?${params.toString()}`;
}
