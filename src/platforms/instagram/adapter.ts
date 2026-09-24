import type {
  Author,
  PlatformScanner,
  RawPost,
  ScannerContext,
  SearchOptions,
  SessionResult,
  SocialPostDraft,
} from "../../core/types/platform";

/** Second-phase adapter: real search capability will be verified with a live test. */
export const instagramScanner: PlatformScanner = {
  platform: "instagram",
  capabilities: { keywordSearch: false, hashtagSearch: false, nativeDateFilter: false },
  implemented: false,

  async checkSession(_context: ScannerContext): Promise<SessionResult> {
    return {
      platform: "instagram",
      status: "unsupported",
      checkedAt: new Date().toISOString(),
      detail: "Instagram becomes active in a later phase.",
    };
  },

  async *search(_options: SearchOptions, _context: ScannerContext): AsyncIterable<RawPost> {
    return;
  },

  parsePost(_raw: RawPost): SocialPostDraft | null {
    return null;
  },

  getPostUrl(raw: RawPost): string | null {
    return raw.canonicalUrl;
  },

  getAuthor(_raw: RawPost): Author | null {
    return null;
  },
};
