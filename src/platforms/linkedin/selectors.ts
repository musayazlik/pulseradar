import type { PlatformCapabilities } from "../../core/types/platform";

/**
 * LinkedIn içerik araması ve feed bileşen selector'ları.
 * Probe/deneme koşularında gözlemlenir; boş sonuçda logs/ altına kanıt düşer.
 */
export const LINKEDIN_SELECTORS = {
  /** Her sonuç bir feed-update bileşenidir; data-urn activity URN'i taşır. */
  resultContainer: 'div[data-urn^="urn:li:activity"], div.feed-shared-update-v2',
  postText: "div.update-components-text",
  permalink: 'a[href*="/feed/update/urn:li:activity:"], a[href*="/posts/"]',
  actorName:
    ".update-components-actor__name span, .update-components-actor__title span, .update-components-actor__single-line span",
  actorLink: "a.update-components-actor",
  time: "time[datetime]",
  /** Oturum yoksa: login formu veya authwall. */
  loginMarker: "form#login, .authwall-join-form, [data-test-id='login-form']",
  feedMarker:
    ".feed-shared-update-v2, .share-box, .feed-identity-module, [data-urn^='urn:li:activity']",
  emptyResultMarker:
    ".search-no-results, .empty-state, .artdeco-empty-state",
} as const;

export const LINKEDIN_CAPABILITIES: PlatformCapabilities = {
  keywordSearch: true,
  hashtagSearch: true,
  nativeDateFilter: true,
};

export const LINKEDIN_BASE_URL = "https://www.linkedin.com";
