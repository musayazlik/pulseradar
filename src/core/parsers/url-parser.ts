import { extractUrls, normalizeUrl } from "../utils/url";

/** Hints for links that may be registration/event pages. */
const REGISTRATION_HINTS = [
  "lu.ma", "luma.com", "eventbrite.com", "meetup.com", "kommunity.com",
  "forms.gle", "docs.google.com/forms", "zoom.us", "register", "kayit",
  "bilet", "ticket", "event", "etkinlik",
];

export interface UrlParseResult {
  links: string[];
  /** Candidates that may be registration links (off-field guess, with evidence). */
  registrationCandidates: string[];
}

export function parseUrls(rawText: string): UrlParseResult {
  const links = extractUrls(rawText);
  const registrationCandidates = links.filter((link) => {
    const lowered = link.toLowerCase();
    return REGISTRATION_HINTS.some((hint) => lowered.includes(hint));
  });
  return { links, registrationCandidates };
}

export { normalizeUrl };
