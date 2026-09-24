import type { RawPost, SocialPostDraft } from "../../core/types/platform";
import { extractUrls } from "../../core/utils/url";

export function parseXPost(raw: RawPost): SocialPostDraft | null {
  if (!raw.text || raw.text.trim().length === 0) return null;
  if (!raw.canonicalUrl) return null;
  return {
    platform: "x",
    platformPostId: raw.platformPostId,
    canonicalUrl: raw.canonicalUrl,
    accountName: null,
    accountUrl: null,
    publishedAt: raw.publishedAt,
    publishedAtPrecision: raw.publishedAt ? "exact" : "unknown",
    rawText: raw.text,
    extractedLinks: extractUrls(raw.text),
  };
}
