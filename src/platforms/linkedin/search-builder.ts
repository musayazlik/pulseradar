import type { SearchOptions } from "../../core/types/platform";
import { LINKEDIN_BASE_URL } from "./selectors";

/** LinkedIn content search URL; live results are re-checked against publishedAt. */
export function buildLinkedInSearchUrl(options: SearchOptions): string {
  const keyword = options.queries[0] ?? "";
  const params = new URLSearchParams({
    keywords: keyword,
    origin: "SWITCH_SEARCH_VERTICAL",
  });
  if (options.lastDays) {
    params.set(
      "datePosted",
      options.lastDays <= 7 ? '%5B"past-week"%5D' : '%5B"past-month"%5D',
    );
  }
  return `${LINKEDIN_BASE_URL}/search/results/content/?${params.toString()}`;
}
