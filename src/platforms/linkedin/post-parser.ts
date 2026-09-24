import type { RawPost, SocialPostDraft } from "../../core/types/platform";
import { extractUrls } from "../../core/utils/url";

/** Builds a draft from platform-agnostic raw data; DOM extraction lives in the adapter. */
export function parseLinkedInPost(raw: RawPost): SocialPostDraft | null {
  if (!raw.text || raw.text.trim().length === 0) return null;
  const permalink = raw.canonicalUrl ?? (raw.platformPostId
    ? `https://www.linkedin.com/feed/update/urn:li:activity:${raw.platformPostId}/`
    : null);
  if (!permalink) return null;

  return {
    platform: "linkedin",
    platformPostId: raw.platformPostId,
    canonicalUrl: permalink,
    accountName: null,
    accountUrl: null,
    publishedAt: raw.publishedAt,
    publishedAtPrecision: raw.publishedAt ? "day" : "unknown",
    rawText: raw.text,
    extractedLinks: extractUrls(raw.text),
  };
}

/** Permalink extraction from a post. */
export function getLinkedInPostUrl(raw: RawPost): string | null {
  return raw.canonicalUrl;
}
