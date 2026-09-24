export const PLATFORMS = ["linkedin", "x", "instagram", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Platforms active in the MVP; instagram/tiktok are a later phase. */
export const MVP_PLATFORMS: readonly Platform[] = ["linkedin", "x"];

export const SECOND_PHASE_PLATFORMS: readonly Platform[] = ["instagram", "tiktok"];

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

/** Also accepts the `twitter` -> `x` alias. */
export function normalizePlatform(value: string): Platform | null {
  const lowered = value.toLowerCase();
  if (lowered === "twitter") return "x";
  return isPlatform(lowered) ? lowered : null;
}

export type SessionStatus =
  | "ready"
  | "login_required"
  | "challenge"
  | "unsupported"
  | "error";

export interface SessionResult {
  platform: Platform;
  status: SessionStatus;
  checkedAt: string;
  detail?: string;
}

export interface PlatformCapabilities {
  keywordSearch: boolean;
  hashtagSearch: boolean;
  nativeDateFilter: boolean;
}

export interface Author {
  name: string;
  url: string | null;
}

/** Raw unit read from the platform by the adapter; not normalized yet. */
export interface RawPost {
  platformPostId: string | null;
  canonicalUrl: string | null;
  text: string;
  publishedAt: string | null;
  extractedLinks: string[];
  authorName?: string | null;
  authorUrl?: string | null;
  /** Images attached to the post (poster candidates); avatars/logos excluded. */
  imageUrls?: string[];
}

/** Output of the adapter's parsePost; the draft before it is written to the DB. */
export interface SocialPostDraft {
  platform: Platform;
  platformPostId: string | null;
  canonicalUrl: string | null;
  accountName: string | null;
  accountUrl: string | null;
  publishedAt: string | null;
  publishedAtPrecision: "exact" | "day" | "unknown";
  rawText: string;
  extractedLinks: string[];
}

export interface SearchOptions {
  queries: string[];
  maxPostsPerQuery: number;
  maxScrollsPerQuery: number;
  lastDays: number | null;
  city: string | null;
}

export interface ScannerContext {
  /** Single page handed over by the worker; the adapter never opens its own browser. */
  page: unknown;
  limiter: { wait(reason?: string): Promise<void> };
  logger: { info(msg: string, ...args: unknown[]): void; warn(msg: string, ...args: unknown[]): void; error(msg: string, ...args: unknown[]): void };
  signal: AbortSignal;
}

export interface PlatformScanner {
  readonly platform: Platform;
  readonly capabilities: PlatformCapabilities;
  /** Never returns true before selectors are observed in a real browser. */
  readonly implemented: boolean;
  checkSession(context: ScannerContext): Promise<SessionResult>;
  search(options: SearchOptions, context: ScannerContext): AsyncIterable<RawPost>;
  parsePost(raw: RawPost): SocialPostDraft | null;
  getPostUrl(raw: RawPost): string | null;
  getAuthor(raw: RawPost): Author | null;
}
