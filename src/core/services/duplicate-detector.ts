import { normalizeUrl } from "../utils/url";
import type { EventRecord } from "../types/event";
import type { SocialPostRecord } from "../types/post";

export type DuplicateAction =
  | "skip" // same source post: the observation relation is updated
  | "merge" // strong match: merged with source links preserved
  | "review" // automatic decision is not safe: ReviewItem
  | "create"; // yeni etkinlik

export type DuplicateDecision =
  | { action: "skip" | "review" | "create"; reason: string; existingEventId: null }
  | { action: "merge"; reason: string; existingEventId: string };

export interface DuplicateInputs {
  /** Has this post been recorded before? */
  sourcePost: SocialPostRecord | null;
  /** Events the source post is linked to. */
  postEventIds: string[];
  /** Candidate found via the registration URL. */
  existingByRegistrationUrl: EventRecord | null;
  /** normalizedTitle (+ tarih) ile bulunan aday. */
  existingByTitleAndDate: EventRecord | null;
  candidateStartDate: string | null;
}

function datesCompatible(
  existing: EventRecord | null,
  startDate: string | null,
): boolean {
  if (!existing || !existing.startDate || !startDate) return true; // missing info is not a conflict
  return existing.startDate === startDate;
}

/**
 * Pure decision function; DB access belongs to the caller (for testability).
 * Order: same source post → registration URL → title+date → review → new.
 */
export function decideDuplicate(inputs: DuplicateInputs): DuplicateDecision {
  // 1) Same source post: no new event, update the observation.
  if (inputs.sourcePost && inputs.postEventIds.length > 0) {
    return { action: "skip", reason: "same_source_post", existingEventId: null };
  }

  // 2) Event-specific registration URL and compatible date: strong match.
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

  // 3) Similar title + same date: strong match candidate.
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

  // 4) Similar title but missing/conflicting date: no automatic merge.
  if (inputs.existingByTitleAndDate) {
    return { action: "review", reason: "title_matches_date_differs", existingEventId: null };
  }

  // 5) Same series name with different dates is a separate event → create handles it.
  return { action: "create", reason: "no_match", existingEventId: null };
}

/** Comparison URL with UTM stripped. */
export function comparableRegistrationUrl(url: string | null): string | null {
  return normalizeUrl(url);
}
