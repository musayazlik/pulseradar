export const PLATFORMS = ["linkedin", "x", "instagram", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** MVP'de etkin olan platformlar; instagram/tiktok ikinci aşama. */
export const MVP_PLATFORMS: readonly Platform[] = ["linkedin", "x"];

export const SECOND_PHASE_PLATFORMS: readonly Platform[] = ["instagram", "tiktok"];

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

/** `twitter` -> `x` alias'ını da kabul eder. */
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

/** Adapter'ın platformdan ham okuduğu birim; henüz normalize edilmemiş. */
export interface RawPost {
  platformPostId: string | null;
  canonicalUrl: string | null;
  text: string;
  publishedAt: string | null;
  extractedLinks: string[];
  authorName?: string | null;
  authorUrl?: string | null;
  /** Paylaşıma iliştirilmiş görseller (afiş adayları); avatar/logo hariç. */
  imageUrls?: string[];
}

/** Adapter'ın parsePost çıktısı; DB'ye yazılmadan önceki taslak. */
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
  maxPostsPerPlatform: number;
  lastDays: number | null;
  city: string | null;
}

export interface ScannerContext {
  /** Worker tarafından verilen tek sekme; adapter kendi browser'ını açmaz. */
  page: unknown;
  limiter: { wait(reason?: string): Promise<void> };
  logger: { info(msg: string, ...args: unknown[]): void; warn(msg: string, ...args: unknown[]): void; error(msg: string, ...args: unknown[]): void };
  signal: AbortSignal;
}

export interface PlatformScanner {
  readonly platform: Platform;
  readonly capabilities: PlatformCapabilities;
  /** Selector'lar gerçek tarayıcıda gözlemlenmeden true dönmez. */
  readonly implemented: boolean;
  checkSession(context: ScannerContext): Promise<SessionResult>;
  search(options: SearchOptions, context: ScannerContext): AsyncIterable<RawPost>;
  parsePost(raw: RawPost): SocialPostDraft | null;
  getPostUrl(raw: RawPost): string | null;
  getAuthor(raw: RawPost): Author | null;
}
