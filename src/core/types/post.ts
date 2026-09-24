import type { Platform } from "./platform";

export interface SocialPostRecord {
  id: string;
  platform: Platform;
  platformPostId: string | null;
  canonicalUrl: string;
  accountName: string | null;
  accountUrl: string | null;
  publishedAt: string | null;
  publishedAtPrecision: "exact" | "day" | "unknown";
  rawText: string;
  extractedLinks: string[];
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface PostWithPlatformRef {
  post: SocialPostRecord;
  /** Events linked to this post. */
  eventIds: string[];
}
