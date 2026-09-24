import type {
  Author,
  PlatformScanner,
  RawPost,
  ScannerContext,
  SearchOptions,
  SessionResult,
  SocialPostDraft,
} from "../../core/types/platform";

/** İkinci aşama adapterı. */
export const tiktokScanner: PlatformScanner = {
  platform: "tiktok",
  capabilities: { keywordSearch: false, hashtagSearch: false, nativeDateFilter: false },
  implemented: false,

  async checkSession(_context: ScannerContext): Promise<SessionResult> {
    return {
      platform: "tiktok",
      status: "unsupported",
      checkedAt: new Date().toISOString(),
      detail: "TikTok ikinci aşamada etkin olacak.",
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
