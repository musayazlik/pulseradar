/** Keşif/işlem zamanları UTC ISO string tutulur. */
export function nowIso(): string {
  return new Date().toISOString();
}

export function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export interface ResolvedDate {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string | null;
  precision: "exact" | "day" | "month" | "year";
  evidence: string;
}

export function formatDateParts(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * Paylaşım tarihine göre "bugün"/"yarın" gibi göreli ifadeleri çözer.
 * Paylaşım tarihi yoksa null döner; çağıran taraf kaydı incelemeye alır.
 */
export function resolveRelativeDay(
  dayOffset: number,
  publishedAt: string | null,
): ResolvedDate | null {
  if (!publishedAt) return null;
  const base = new Date(publishedAt);
  if (Number.isNaN(base.getTime())) return null;
  const target = addDays(base, dayOffset);
  return {
    date: formatDateParts(target),
    time: null,
    precision: "day",
    evidence: dayOffset === 0 ? "bugün" : "yarın",
  };
}
