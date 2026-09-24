/** Folds Turkish characters to ASCII lowercase (İstanbul -> istanbul). */
export function normalizeTurkish(text: string): string {
  return text
    .replaceAll("İ", "i")
    .replaceAll("I", "ı")
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function normalizeCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const cleaned = normalizeTurkish(city).replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Title key for duplicate comparisons. */
export function normalizeTitle(title: string): string {
  return normalizeTurkish(title)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
