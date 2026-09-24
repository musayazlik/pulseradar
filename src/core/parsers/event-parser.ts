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

/** Tek başına yeterli değildir; birden fazla sinyal birlikte değerlendirilir. */
const INTENT_SIGNALS = [
  "etkinlik", "etkinliği", "meetup", "konferans", "conference", "hackathon",
  "buluşuyoruz", "buluşma", "buluşması", "webinar", "workshop", "seminer",
  "bootcamp", "demo day", "pitch", "zirve", "summit", "kayıtlar açıldı",
  "kayitlar acildi", "katılın", "katilin", "davet", "invitation",
  "save the date", "networking", "söyleşi", "soylesi", "panel",
];

/** İş ilanı / reklam / geçmiş özeti ayrımı için red sinyalleri. */
const NON_EVENT_SIGNALS = [
  "iş ilanı", "is ilani", "pozisyon", "ilanımız var", "ariyoruz",
  "hire", "hiring", "we are looking", "pozisyon arayışı",
];

/** Duyuru gücünü artıran ifadeler ("bu yıl ilk kez", "yakında" vb.). */
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
  /** Açık tarih yoksa true; kayıt incelemeye düşer. */
  needsReview: boolean;
}

/**
 * Bir paylaşım birden çok etkinlik içerebilir; bu yüzden liste döner.
 * Şimdilik en güçlü aday tekil çıkarılır; çoklu etkinlik ayrıştırması
 * Aşama 4'te derinleştirilir.
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

  // Açık gelecek etkinlik tarihi yoksa: güçlü duyurusa incelemeye bırak.
  if (futureDates.length === 0) {
    // Güçlü duyuru: birden fazla sinyal birlikte — etkinlik adı + yer/zaman ipucu.
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
    // Saat dilimi varsayımı yalnızca ülke bağlamıyla ve çıkarım olarak.
    timeZone: post.publishedAt ? opts.defaultTimeZone : null,
    datePrecision: (date?.precision as DatePrecision) ?? "unknown",
    venue: location.venue,
    city: location.city,
    country: location.city ? "TR" : null,
    attendanceMode: location.attendanceMode as AttendanceMode,
    // Paylaşan hesap otomatik organizatör kabul edilmez.
    organizer: null,
    registrationUrl: registrationCandidates[0] ?? null,
    confidence: opts.confidence,
    evidenceJson: JSON.stringify(evidence),
    needsReview: opts.needsReview,
  };
}

function deriveTitle(rawText: string, intentHits: string[]): string {
  // İlk cümle/ilk satır başlık adayıdır; kayıt bağlantısı ve uzun açıklama hariç.
  const firstLine = rawText
    .split(/\n+/)
    .map((l) => l.trim())
    .find((l) => l.length > 3);
  if (!firstLine) return intentHits[0] ?? "Bilinmeyen etkinlik";
  const firstSentence = firstLine.split(/[!?]/)[0].trim();
  const title = firstSentence.length >= 3 ? firstSentence : firstLine;
  return title.length <= 80 ? title : title.slice(0, 80).trim();
}
