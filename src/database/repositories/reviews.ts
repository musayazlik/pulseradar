import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../client";
import { reviewItems } from "../schema";
import { nowIso } from "../../core/utils/date";

export type ReviewStatus = "open" | "resolved" | "dismissed";

export function insertReviewItem(input: {
  eventId: string | null;
  candidateEventId?: string | null;
  reason: string;
}): string {
  const id = randomUUID();
  getDb()
    .insert(reviewItems)
    .values({
      id,
      eventId: input.eventId,
      candidateEventId: input.candidateEventId ?? null,
      reason: input.reason,
      status: "open",
      createdAt: nowIso(),
    })
    .run();
  return id;
}

export function listReviewItems(status?: ReviewStatus) {
  const db = getDb();
  const where = status ? eq(reviewItems.status, status) : undefined;
  return db
    .select()
    .from(reviewItems)
    .where(where)
    .orderBy(desc(reviewItems.createdAt))
    .all();
}

export function resolveReviewItem(
  id: string,
  resolution: "resolved" | "dismissed",
): void {
  getDb()
    .update(reviewItems)
    .set({ status: resolution, resolvedAt: nowIso() })
    .where(and(eq(reviewItems.id, id), eq(reviewItems.status, "open")))
    .run();
}
