import { and, asc, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../client";
import { eventSources, events, socialPosts } from "../schema";
import type {
  AttendanceMode,
  DatePrecision,
  EventListRow,
  EventRecord,
  EventStatus,
  EventWithSources,
} from "../../core/types/event";
import { nowIso } from "../../core/utils/date";
import { normalizeCity, normalizeTitle } from "../../core/utils/normalize";

export function rowToRecord(row: typeof events.$inferSelect): EventRecord {
  return {
    id: row.id,
    title: row.title,
    normalizedTitle: row.normalizedTitle,
    description: row.description,
    startDate: row.startDate,
    endDate: row.endDate,
    startTime: row.startTime,
    endTime: row.endTime,
    timeZone: row.timeZone,
    datePrecision: row.datePrecision as DatePrecision,
    venue: row.venue,
    city: row.city,
    country: row.country,
    attendanceMode: row.attendanceMode as AttendanceMode,
    organizer: row.organizer,
    registrationUrl: row.registrationUrl,
    status: row.status as EventStatus,
    confidence: row.confidence,
    firstDiscoveredAt: row.firstDiscoveredAt,
    updatedAt: row.updatedAt,
    manuallyEditedFields: JSON.parse(row.manuallyEditedFields) as string[],
  };
}

export interface EventFilter {
  status?: EventStatus[];
  city?: string | null;
  upcomingOnly?: boolean;
  limit?: number;
  offset?: number;
}

export function insertEvent(
  record: Omit<EventRecord, "id" | "firstDiscoveredAt" | "updatedAt">,
): EventRecord {
  const db = getDb();
  const now = nowIso();
  const id = randomUUID();
  const row = {
    id,
    title: record.title,
    normalizedTitle: record.normalizedTitle,
    description: record.description,
    startDate: record.startDate,
    endDate: record.endDate,
    startTime: record.startTime,
    endTime: record.endTime,
    timeZone: record.timeZone,
    datePrecision: record.datePrecision,
    venue: record.venue,
    city: record.city,
    cityNormalized: normalizeCity(record.city),
    country: record.country,
    attendanceMode: record.attendanceMode,
    organizer: record.organizer,
    registrationUrl: record.registrationUrl,
    status: record.status,
    confidence: record.confidence,
    firstDiscoveredAt: now,
    updatedAt: now,
    manuallyEditedFields: JSON.stringify(record.manuallyEditedFields),
  };
  db.insert(events).values(row).run();
  return getEventById(row.id)!;
}

export function getEventById(id: string): EventRecord | null {
  const row = getDb().select().from(events).where(eq(events.id, id)).get();
  return row ? rowToRecord(row) : null;
}

export function updateEventFields(
  id: string,
  patch: Partial<typeof events.$inferInsert>,
): EventRecord | null {
  const db = getDb();
  db.update(events)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(events.id, id))
    .run();
  return getEventById(id);
}

export function listEvents(filter: EventFilter = {}): EventListRow[] {
  const db = getDb();
  const conditions = [];

  if (filter.status && filter.status.length > 0) {
    conditions.push(inArray(events.status, filter.status));
  }
  if (filter.city) {
    conditions.push(eq(events.cityNormalized, normalizeCity(filter.city) as string));
  }
  if (filter.upcomingOnly) {
    // Tarihi belirsiz kayıtlar listede kalır; "İncelenecek" filtresi status ile.
    const today = new Date().toISOString().slice(0, 10);
    conditions.push(or(sql`${events.startDate} IS NULL`, gte(events.startDate, today)));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = db
    .select()
    .from(events)
    .where(where)
    .orderBy(
      sql`CASE WHEN ${events.startDate} IS NULL THEN 1 ELSE 0 END`,
      asc(events.startDate),
      desc(events.confidence),
    )
    .limit(filter.limit ?? 100)
    .offset(filter.offset ?? 0)
    .all();

  return rows.map((row) => {
    const record = rowToRecord(row);
    return { ...record, platforms: listEventPlatforms(record.id) };
  });
}

export function listEventPlatforms(eventId: string): string[] {
  const rows = getDb()
    .selectDistinct({ platform: socialPosts.platform })
    .from(eventSources)
    .innerJoin(socialPosts, eq(eventSources.postId, socialPosts.id))
    .where(eq(eventSources.eventId, eventId))
    .all();
  return rows.map((r) => r.platform);
}

export function getEventWithSources(id: string): EventWithSources | null {
  const record = getEventById(id);
  if (!record) return null;
  const rows = getDb()
    .select({
      postId: eventSources.postId,
      platform: socialPosts.platform,
      canonicalUrl: socialPosts.canonicalUrl,
      accountName: socialPosts.accountName,
      publishedAt: socialPosts.publishedAt,
      evidenceJson: eventSources.evidenceJson,
      parserVersion: eventSources.parserVersion,
    })
    .from(eventSources)
    .innerJoin(socialPosts, eq(eventSources.postId, socialPosts.id))
    .where(eq(eventSources.eventId, id))
    .all();

  return { ...record, sources: rows };
}

/** Benzer başlık + aynı tarih: güçlü duplicate adayı. */
export function findDuplicateCandidate(
  normalizedTitle: string,
  startDate: string | null,
): EventRecord | null {
  const db = getDb();
  const conditions = [eq(events.normalizedTitle, normalizedTitle)];
  if (startDate) {
    conditions.push(eq(events.startDate, startDate));
  }
  const row = db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(desc(events.confidence))
    .get();
  return row ? rowToRecord(row) : null;
}

/** Aynı serinin farklı tarihleri ayrı etkinliktir: yalnızca tarih eşleşmesinde çağrılır. */
export function findEventByRegistrationUrl(url: string): EventRecord | null {
  const row = getDb()
    .select()
    .from(events)
    .where(eq(events.registrationUrl, url))
    .get();
  return row ? rowToRecord(row) : null;
}

export function countEventsByStatus(): Record<string, number> {
  const rows = getDb()
    .select({ status: events.status, count: sql<number>`count(*)` })
    .from(events)
    .groupBy(events.status)
    .all();
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
}

export function listCities(): string[] {
  const rows = getDb()
    .selectDistinct({ city: events.city })
    .from(events)
    .where(sql`${events.city} IS NOT NULL`)
    .all();
  return rows.map((r) => r.city!).sort();
}

/** Bir gönderiye bağlı etkinlik ID'leri (EventSource üzerinden). */
export function listEventIdsForPost(postId: string): string[] {
  return getDb()
    .select({ eventId: eventSources.eventId })
    .from(eventSources)
    .where(eq(eventSources.postId, postId))
    .all()
    .map((r) => r.eventId);
}

export function linkEventSource(input: {
  eventId: string;
  postId: string;
  evidenceJson: string | null;
  parserVersion: string;
}): boolean {
  try {
    getDb()
      .insert(eventSources)
      .values({
        eventId: input.eventId,
        postId: input.postId,
        evidenceJson: input.evidenceJson,
        parserVersion: input.parserVersion,
        createdAt: nowIso(),
      })
      .run();
    return true;
  } catch {
    return false;
  }
}

export { normalizeTitle };
