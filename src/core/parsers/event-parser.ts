import type {
  AttendanceMode,
  DatePrecision,
} from "../types/event";
import type { SocialPostDraft } from "../types/platform";
import { parseDateExpressions } from "./date-parser";
import { parseLocation } from "./location-parser";
import { parseUrls } from "./url-parser";
import { normalizeTitle } from "../utils/normalize";
import { nowIso } from "../utils/date";

export const PARSER_VERSION = "event-parser/0.1.0";

/** Not sufficient on its own; multiple signals are evaluated together. */
const INTENT_SIGNALS = [
  "etkinlik", "etkinliği", "meetup", "konferans", "conference", "hackathon",
  "buluşuyoruz", "buluşma", "buluşması", "webinar", "workshop", "seminer",
  "bootcamp", "demo day", "pitch", "zirve", "summit", "kayıtlar açıldı",
  "kayitlar acildi", "katılın", "katilin", "davet", "invitation",
  "save the date", "networking", "söyleşi", "soylesi", "panel",
];

/** Rejection signals to tell apart job ads / promotions / past-event recaps. */
const NON_EVENT_SIGNALS = [
  "iş ilanı", "is ilani", "pozisyon", "ilanımız var", "ariyoruz",
  "hire", "hiring", "we are looking", "pozisyon arayışı",
];

/** Phrases that strengthen the announcement ("bu yıl ilk kez", "yakında", etc.). */
const ANNOUNCEMENT_AMPLIFIERS = [
  "geliyor", "bu yıl", "bu yil", "yakında", "yakinda", "ilk kez",
  "duyurduk", "duyuruyoruz", "takipte kalın", "detaylar yakında",
];

export interface ExtractedEventCandidate {
  title: string;
  normalizedTitle: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timeZone: string | null;
  datePrecision: DatePrecision;
  venue: string | null;
  city: string | null;
  country: string | null;
  attendanceMode: AttendanceMode;
  organizer: string | null;
  registrationUrl: string | null;
  confidence: number;
  evidenceJson: string;
  /** True when no explicit date exists; the record goes to review. */
  needsReview: boolean;
}

/**
 * A post may contain multiple events; that is why a list is returned.
 * For now the strongest candidate is extracted singly; multi-event parsing
 * is deepened in Phase 4.
 */
export function extractEventCandidates(
  post: SocialPostDraft,
  options: { defaultTimeZone: string },
): ExtractedEventCandidate[] {
  const text = post.rawText;
  const lowered = text.toLowerCase();

  const intentHits = INTENT_SIGNALS.filter((s) => lowered.includes(s));
  if (intentHits.length === 0) return [];
  if (NON_EVENT_SIGNALS.some((s) => lowered.includes(s))) return [];

  const { dates } = parseDateExpressions(text, post.publishedAt);
  const location = parseLocation(text);
  const { links, registrationCandidates } = parseUrls(text);

  const now = new Date();
  const futureDates = dates.filter(
    (d) => new Date(`${d.date}T00:00:00Z`).getTime() >=
      now.getTime() - 24 * 3600 * 1000,
  );

  // No explicit future event date: send strong announcements to review.
  if (futureDates.length === 0) {
    // Strong announcement: multiple signals together — event name + venue/time hint.
    const contextSignal =
      location.city !== null ||
      location.attendanceMode === "online" ||
      ANNOUNCEMENT_AMPLIFIERS.some((s) => lowered.includes(s));
    const strongAnnouncement =
      intentHits.length >= 2 || (intentHits.length === 1 && contextSignal);
    if (!strongAnnouncement) return [];
    return [buildCandidate(post, intentHits, dates[0] ?? null, location, registrationCandidates, {
      confidence: 20,
      needsReview: true,
      defaultTimeZone: options.defaultTimeZone,
    })];
  }

  const best = futureDates[0];
  const confidence = computeConfidence(intentHits, best, location);

  return [buildCandidate(post, intentHits, best, location, registrationCandidates, {
    confidence,
    needsReview: false,
    defaultTimeZone: options.defaultTimeZone,
  })];
}

function computeConfidence(
  intentHits: string[],
  date: { time: string | null; precision: string },
  location: { city: string | null; attendanceMode: string },
): number {
  let score = 30;
  score += Math.min(intentHits.length * 10, 30);
  if (date.time) score += 15;
  if (date.precision === "exact" || date.precision === "day") score += 10;
  if (location.city) score += 10;
  return Math.min(score, 95);
}

function buildCandidate(
  post: SocialPostDraft,
  intentHits: string[],
  date: { date: string; time: string | null; precision: string; evidence: string } | null,
  location: { city: string | null; venue: string | null; attendanceMode: string; evidence: string | null },
  registrationCandidates: string[],
  opts: { confidence: number; needsReview: boolean; defaultTimeZone: string },
): ExtractedEventCandidate {
  const title = deriveTitle(post.rawText, intentHits);
  const evidence = {
    intentSignals: intentHits,
    dateEvidence: date?.evidence ?? null,
    locationEvidence: location.evidence,
    registrationCandidates,
    publishedAt: post.publishedAt,
  };

  return {
    title,
    normalizedTitle: normalizeTitle(title),
    description: post.rawText.slice(0, 2000),
    startDate: date?.date ?? null,
    endDate: date?.date ?? null,
    startTime: date?.time ?? null,
    endTime: null,
    // Time zone assumption only with country context, marked as an inference.
    timeZone: post.publishedAt ? opts.defaultTimeZone : null,
    datePrecision: (date?.precision as DatePrecision) ?? "unknown",
    venue: location.venue,
    city: location.city,
    country: location.city ? "TR" : null,
    attendanceMode: location.attendanceMode as AttendanceMode,
    // The posting account is not automatically treated as the organizer.
    organizer: null,
    registrationUrl: registrationCandidates[0] ?? null,
    confidence: opts.confidence,
    evidenceJson: JSON.stringify(evidence),
    needsReview: opts.needsReview,
  };
}

function deriveTitle(rawText: string, intentHits: string[]): string {
  // The first sentence/line is the title candidate; registration links and long descriptions excluded.
  const firstLine = rawText
    .split(/\n+/)
    .map((l) => l.trim())
    .find((l) => l.length > 3);
  if (!firstLine) return intentHits[0] ?? "Bilinmeyen etkinlik";
  const firstSentence = firstLine.split(/[!?]/)[0].trim();
  const title = firstSentence.length >= 3 ? firstSentence : firstLine;
  return title.length <= 80 ? title : title.slice(0, 80).trim();
}
