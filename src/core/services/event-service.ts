import { randomUUID } from "node:crypto";
import type {
  EventListRow,
  EventRecord,
  EventStatus,
  EventWithSources,
} from "../types/event";
import type { SocialPostDraft } from "../types/platform";
import {
  findDuplicateCandidate,
  findEventByRegistrationUrl,
  getEventById,
  getEventWithSources,
  insertEvent,
  linkEventSource,
  listEventIdsForPost,
  listEvents,
  updateEventFields,
  type EventFilter,
} from "../../database/repositories/events";
import { upsertPost } from "../../database/repositories/posts";
import { recordObservation } from "../../database/repositories/scans";
import { insertReviewItem } from "../../database/repositories/reviews";
import { decideDuplicate } from "./duplicate-detector";
import {
  extractEventCandidates,
  PARSER_VERSION,
} from "../parsers/event-parser";
import { normalizeTitle } from "../utils/normalize";
import { normalizeUrl } from "../utils/url";
import { nowIso } from "../utils/date";

/**
 * Status is recomputed against the current clock when read, so stale `upcoming`
 * values are not shown weeks later. Manually edited/rejected records
 * never have their status overwritten.
 */
export function computeDynamicStatus(event: EventRecord, now = new Date()): EventStatus {
  if (event.status === "rejected" || event.status === "needs_review") {
    return event.status;
  }
  if (!event.startDate) return event.status === "expired" ? "needs_review" : event.status;

  const today = now.toISOString().slice(0, 10);
  const endDate = event.endDate ?? event.startDate;
  if (endDate < today) return "expired";
  if (event.startDate <= today && today <= endDate) {
    return event.status === "expired" ? "expired" : "ongoing";
  }
  return event.status === "ongoing" ? "upcoming" : event.status;
}

function withDynamicStatus<T extends EventRecord>(event: T): T {
  return { ...event, status: computeDynamicStatus(event) };
}

export function listEventsWithStatus(filter: EventFilter = {}): EventListRow[] {
  return listEvents(filter).map((row) => withDynamicStatus(row));
}

export function getEventDetail(id: string): EventWithSources | null {
  const detail = getEventWithSources(id);
  if (!detail) return null;
  return withDynamicStatus(detail);
}

export interface EventPatch {
  title?: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  city?: string | null;
  organizer?: string | null;
  registrationUrl?: string | null;
  status?: "upcoming" | "needs_review" | "rejected";
}

/** Fields the user edited manually are never overwritten by later scans. */
export function applyEventPatch(id: string, patch: EventPatch): EventRecord | null {
  const existing = getEventById(id);
  if (!existing) return null;

  const manuallyEdited = new Set(existing.manuallyEditedFields);
  const dbPatch: Record<string, unknown> = {};

  const directFields = [
    "title",
    "description",
    "startDate",
    "endDate",
    "startTime",
    "endTime",
    "venue",
    "city",
    "organizer",
    "registrationUrl",
    "status",
  ] as const;

  for (const field of directFields) {
    if (patch[field] !== undefined) {
      dbPatch[field] = patch[field];
      if (field !== "status") manuallyEdited.add(field);
    }
  }
  if (patch.title !== undefined) {
    dbPatch.normalizedTitle = normalizeTitle(patch.title);
  }
  dbPatch.manuallyEditedFields = JSON.stringify([...manuallyEdited]);

  return updateEventFields(id, dbPatch);
}

export function rejectEvent(id: string): EventRecord | null {
  return applyEventPatch(id, { status: "rejected" });
}

export interface IngestResult {
  outcome: "created" | "merged" | "reseen" | "review" | "no_event" | "filtered";
  eventId: string | null;
  reviewItemId: string | null;
}

export interface IngestOptions {
  defaultTimeZone: string;
  /** Strict last-X-days filter; records with unknown publishedAt are counted separately. */
  lastDays: number | null;
  taskId: string | null;
}

/**
 * Heart of the scan stream: persist the post, extract events,
 * apply the duplicate decision and link the source.
 */
export function ingestPost(
  draft: SocialPostDraft,
  options: IngestOptions,
): IngestResult {
  const postResult = upsertPost({
    platform: draft.platform,
    platformPostId: draft.platformPostId,
    canonicalUrl: draft.canonicalUrl ?? `urn:unknown:${randomUUID()}`,
    accountName: draft.accountName,
    accountUrl: draft.accountUrl,
    publishedAt: draft.publishedAt,
    publishedAtPrecision: draft.publishedAtPrecision,
    rawText: draft.rawText,
    extractedLinks: draft.extractedLinks,
  });

  if (options.taskId) {
    recordObservation(options.taskId, postResult.post.id);
  }

  const candidates = extractEventCandidates(draft, {
    defaultTimeZone: options.defaultTimeZone,
  });
  if (candidates.length === 0) {
    return { outcome: "no_event", eventId: null, reviewItemId: null };
  }

  const candidate = candidates[0];
  const postEventIds = listEventIdsForPost(postResult.post.id);

  const existingByRegistrationUrl = candidate.registrationUrl
    ? findEventByRegistrationUrl(normalizeUrl(candidate.registrationUrl) ?? candidate.registrationUrl)
    : null;
  const existingByTitleAndDate = findDuplicateCandidate(
    candidate.normalizedTitle,
    candidate.startDate,
  );

  const decision = decideDuplicate({
    sourcePost: postResult.outcome === "reseen" ? postResult.post : null,
    postEventIds,
    existingByRegistrationUrl,
    existingByTitleAndDate,
    candidateStartDate: candidate.startDate,
  });

  switch (decision.action) {
    case "skip":
      return { outcome: "reseen", eventId: postEventIds[0] ?? decision.existingEventId, reviewItemId: null };

    case "create": {
      if (candidate.needsReview || !candidate.startDate) {
        const record = insertEvent({
          title: candidate.title,
          normalizedTitle: candidate.normalizedTitle,
          description: candidate.description,
          startDate: candidate.startDate,
          endDate: candidate.endDate,
          startTime: candidate.startTime,
          endTime: candidate.endTime,
          timeZone: candidate.timeZone,
          datePrecision: candidate.datePrecision,
          venue: candidate.venue,
          city: candidate.city,
          country: candidate.country,
          attendanceMode: candidate.attendanceMode,
          organizer: candidate.organizer,
          registrationUrl: candidate.registrationUrl,
          status: "needs_review",
          confidence: candidate.confidence,
          manuallyEditedFields: [],
        });
        linkSource(record.id, postResult.post.id, candidate.evidenceJson);
        const reviewId = insertReviewItem({
          eventId: record.id,
          reason: candidate.startDate
            ? "date_in_past_or_uncertain"
            : "strong_announcement_without_date",
        });
        return { outcome: "review", eventId: record.id, reviewItemId: reviewId };
      }

      const record = insertEvent({
        title: candidate.title,
        normalizedTitle: candidate.normalizedTitle,
        description: candidate.description,
        startDate: candidate.startDate,
        endDate: candidate.endDate,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        timeZone: candidate.timeZone,
        datePrecision: candidate.datePrecision,
        venue: candidate.venue,
        city: candidate.city,
        country: candidate.country,
        attendanceMode: candidate.attendanceMode,
        organizer: candidate.organizer,
        registrationUrl: candidate.registrationUrl,
        status: "upcoming",
        confidence: candidate.confidence,
        manuallyEditedFields: [],
      });
      linkSource(record.id, postResult.post.id, candidate.evidenceJson);
      return { outcome: "created", eventId: record.id, reviewItemId: null };
    }

    case "merge": {
      linkSource(decision.existingEventId, postResult.post.id, candidate.evidenceJson);
      return { outcome: "merged", eventId: decision.existingEventId, reviewItemId: null };
    }

    case "review": {
      const reviewId = insertReviewItem({
        eventId: decision.existingEventId,
        reason: decision.reason,
      });
      return { outcome: "review", eventId: decision.existingEventId, reviewItemId: reviewId };
    }
  }
}

function linkSource(eventId: string, postId: string, evidenceJson: string): void {
  linkEventSource({
    eventId,
    postId,
    evidenceJson,
    parserVersion: PARSER_VERSION,
  });
}

export { nowIso };
