import type { ResolvedDate } from "../utils/date";
import { addDays, formatDateParts, resolveRelativeDay } from "../utils/date";

const TURKISH_MONTHS: Record<string, number> = {
  ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3, mayıs: 4, mayis: 4,
  haziran: 5, temmuz: 6, ağustos: 7, agustos: 7, eylül: 8, eylul: 8,
  ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11,
};

const WEEKDAYS: Record<string, number> = {
  pazar: 0, pazartesi: 1, salı: 2, sali: 2, çarşamba: 3, carsamba: 3,
  perşembe: 4, persembe: 4, cuma: 5, cumartesi: 6,
};

function normalizeForParse(text: string): string {
  return text
    .replaceAll("İ", "i")
    .replaceAll("I", "ı")
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

/** Next occurrence year for month/day when the year is missing or in the past. */
function toNextOccurrenceYear(month0: number, day: number, now: Date): number {
  const candidate = Date.UTC(now.getUTCFullYear(), month0, day);
  const minPast = now.getTime() - 7 * 24 * 3600 * 1000;
  if (candidate < minPast) {
    return now.getUTCFullYear() + 1;
  }
  return now.getUTCFullYear();
}

export interface DateParseResult {
  dates: ResolvedDate[];
}

/**
 * Rule-based date extraction (to be deepened in Phase 4).
 * Desteklenenler: 12.10.2026, 12/10/2026, 12 Ekim 2026, 12 Ekim 2026 19:00,
 * "Ekim 2026" (month precision), "yarın"/"bugün" (when the post date is known).
 */
export function parseDateExpressions(
  rawText: string,
  publishedAt: string | null,
): DateParseResult {
  const text = normalizeForParse(rawText);
  const now = new Date();
  const dates: ResolvedDate[] = [];
  const seen = new Set<string>();

  const push = (candidate: ResolvedDate | null) => {
    if (!candidate) return;
    const key = `${candidate.date}|${candidate.time ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    dates.push(candidate);
  };

  // 12.10.2026 ve 12/10/2026 (opsiyonel saat)
  const numeric = text.matchAll(
    /\b(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2}))?\b/g,
  );
  for (const m of numeric) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const time = m[4] !== undefined ? `${m[4].padStart(2, "0")}:${m[5]}` : null;
    push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      time,
      precision: time ? "exact" : "day",
      evidence: m[0],
    });
  }

  // 12 Ekim 2026 (optional time) — weekday names ("12 Ekim Salı 2026") also accepted
  const named = text.matchAll(
    /\b(\d{1,2})\s+(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)(?:\s+(?:pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar))?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?\b/g,
  );
  for (const m of named) {
    const day = Number(m[1]);
    const month = TURKISH_MONTHS[m[2]];
    // A stated past year is moved to the next occurrence.
    const givenYear = Number(m[3]);
    const resolved = Date.UTC(givenYear, month, day);
    const year =
      resolved < now.getTime() - 7 * 24 * 3600 * 1000
        ? toNextOccurrenceYear(month, day, now)
        : givenYear;
    if (day < 1 || day > 31) continue;
    const time = m[4] !== undefined ? `${m[4].padStart(2, "0")}:${m[5]}` : null;
    push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      time,
      precision: time ? "exact" : "day",
      evidence: m[0],
    });
  }

  // Ekim 2026 — ay hassasiyeti
  const monthYear = text.matchAll(
    /\b(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)\s+(\d{4})\b/g,
  );
  for (const m of monthYear) {
    const month = TURKISH_MONTHS[m[1]];
    const year = toNextOccurrenceYear(month, 1, now);
    push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-01`,
      time: null,
      precision: "month",
      evidence: m[0],
    });
  }

  // relative: bugün (today) / yarın (tomorrow)
  if (/\bbugun\b/.test(text)) push(resolveRelativeDay(0, publishedAt));
  if (/\byarin\b/.test(text)) push(resolveRelativeDay(1, publishedAt));

  // "bu cuma", "bu cumartesi" — post date + weekday
  const weekday = text.matchAll(
    /\bbu\s+(pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar)\b/g,
  );
  for (const m of weekday) {
    if (!publishedAt) continue;
    const target = WEEKDAYS[m[1]];
    const base = new Date(publishedAt);
    if (Number.isNaN(base.getTime())) continue;
    const baseUtc = Date.UTC(
      base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(),
    );
    const baseDow = new Date(baseUtc).getUTCDay();
    let delta = (target - baseDow + 7) % 7;
    if (delta === 0) delta = 7; // "bu cuma" on the same day reads as next week; stays unambiguous
    push({
      date: formatDateParts(addDays(new Date(baseUtc), delta)),
      time: null,
      precision: "day",
      evidence: m[0],
    });
  }

  return { dates };
}
