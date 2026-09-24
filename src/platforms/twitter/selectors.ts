import type { PlatformCapabilities } from "../../core/types/platform";

/**
 * X (Twitter) search and session markers. The platform key is `x`;
 * `twitter` is only a CLI alias.
 */
export const X_SELECTORS = {
  tweetArticle: 'article[data-testid="tweet"], article',
  tweetText: 'div[data-testid="tweetText"], article div[lang]',
  time: "time[datetime]",
  statusLink: 'a[href*="/status/"]',
  userNameLink: 'a[data-testid="User-Name"]',
  /** The Log in button in the header when there is no session. */
  loginButton: '[data-testid="loginButton"], a[href="/login"]',
  primaryColumn: '[data-testid="primaryColumn"]',
  emptyResultMarker: "[data-testid='emptyState']",
} as const;

export const X_CAPABILITIES: PlatformCapabilities = {
  keywordSearch: true,
  hashtagSearch: true,
  nativeDateFilter: false,
};

export const X_BASE_URL = "https://x.com";
