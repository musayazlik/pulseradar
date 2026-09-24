import { normalizeUrl } from "../utils/url";
import type { EventRecord } from "../types/event";
import type { SocialPostRecord } from "../types/post";

export type DuplicateAction =
  | "skip" // aynı kaynak gönderi: gözlem ilişkisi güncellenir
  | "merge" // güçlü eşleşme: kaynak bağlantıları korunarak birleştirilir
  | "review" // otomatik kararı güvenli değil: ReviewItem
  | "create"; // yeni etkinlik

export type DuplicateDecision =
  | { action: "skip" | "review" | "create"; reason: string; existingEventId: null }
  | { action: "merge"; reason: string; existingEventId: string };

export interface DuplicateInputs {
  /** Bu paylaşım daha önce kaydedilmiş mi? */
  sourcePost: SocialPostRecord | null;
  /** Kaynak gönderinin bağlı olduğu etkinlikler. */
  postEventIds: string[];
  /** Kayıt URL'siyle bulunan aday. */
  existingByRegistrationUrl: EventRecord | null;
  /** normalizedTitle (+ tarih) ile bulunan aday. */
  existingByTitleAndDate: EventRecord | null;
  candidateStartDate: string | null;
}

function datesCompatible(
  existing: EventRecord | null,
  startDate: string | null,
): boolean {
  if (!existing || !existing.startDate || !startDate) return true; // eksik bilgi çelişki sayılmaz
  return existing.startDate === startDate;
}

/**
 * Saf karar fonksiyonu; DB erişimi çağıran taraftadır (test edilebilirlik için).
 * Sıra: aynı kaynak gönderi → kayıt URL'si → başlık+tarih → inceleme → yeni.
 */
export function decideDuplicate(inputs: DuplicateInputs): DuplicateDecision {
  // 1) Aynı kaynak gönderi: yeni etkinlik açılmaz, gözlem güncellenir.
  if (inputs.sourcePost && inputs.postEventIds.length > 0) {
    return { action: "skip", reason: "same_source_post", existingEventId: null };
  }

  // 2) Etkinliğe özel kayıt URL'si ve uyumlu tarih: güçlü eşleşme.
  if (
    inputs.existingByRegistrationUrl &&
    datesCompatible(inputs.existingByRegistrationUrl, inputs.candidateStartDate)
  ) {
    return {
      action: "merge",
      reason: "same_registration_url",
      existingEventId: inputs.existingByRegistrationUrl.id,
    };
  }

  // 3) Benzer başlık + aynı tarih: güçlü eşleşme adayı.
  if (
    inputs.existingByTitleAndDate &&
    datesCompatible(inputs.existingByTitleAndDate, inputs.candidateStartDate)
  ) {
    return {
      action: "merge",
      reason: "same_title_and_date",
      existingEventId: inputs.existingByTitleAndDate.id,
    };
  }

  // 4) Benzer başlık ama eksik/çelişen tarih: otomatik birleştirme yapılmaz.
  if (inputs.existingByTitleAndDate) {
    return { action: "review", reason: "title_matches_date_differs", existingEventId: null };
  }

  // 5) Aynı seri adı ve farklı tarihler ayrı etkinliktir → create zaten düşer.
  return { action: "create", reason: "no_match", existingEventId: null };
}

/** UTM temizlenmiş karşılaştırma URL'si. */
export function comparableRegistrationUrl(url: string | null): string | null {
  return normalizeUrl(url);
}
