import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../client";
import { socialPosts } from "../schema";
import type { SocialPostRecord } from "../../core/types/post";
import type { Platform } from "../../core/types/platform";
import { nowIso } from "../../core/utils/date";

function rowToRecord(row: typeof socialPosts.$inferSelect): SocialPostRecord {
  return {
    id: row.id,
    platform: row.platform as Platform,
    platformPostId: row.platformPostId,
    canonicalUrl: row.canonicalUrl,
    accountName: row.accountName,
    accountUrl: row.accountUrl,
    publishedAt: row.publishedAt,
    publishedAtPrecision: row.publishedAtPrecision as SocialPostRecord["publishedAtPrecision"],
    rawText: row.rawText,
    extractedLinks: JSON.parse(row.extractedLinks) as string[],
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
  };
}

export interface UpsertPostInput {
  platform: Platform;
  platformPostId: string | null;
  canonicalUrl: string;
  accountName: string | null;
  accountUrl: string | null;
  publishedAt: string | null;
  publishedAtPrecision: "exact" | "day" | "unknown";
  rawText: string;
  extractedLinks: string[];
}

export type UpsertPostResult =
  | { outcome: "created"; post: SocialPostRecord }
  | { outcome: "reseen"; post: SocialPostRecord };

/**
 * Source post deduplication: on a (platform, platformPostId) or
 * (platform, canonicalUrl) match, no new record is opened; lastSeenAt is updated.
 */
export function upsertPost(input: UpsertPostInput): UpsertPostResult {
  const db = getDb();

  const existing = input.platformPostId
    ? db
        .select()
        .from(socialPosts)
        .where(
          and(
            eq(socialPosts.platform, input.platform),
            eq(socialPosts.platformPostId, input.platformPostId),
          ),
        )
        .get()
    : db
        .select()
        .from(socialPosts)
        .where(
          and(
            eq(socialPosts.platform, input.platform),
            eq(socialPosts.canonicalUrl, input.canonicalUrl),
          ),
        )
        .get();

  if (existing) {
    db.update(socialPosts)
      .set({ lastSeenAt: nowIso() })
      .where(eq(socialPosts.id, existing.id))
      .run();
    return { outcome: "reseen", post: rowToRecord({ ...existing, lastSeenAt: nowIso() }) };
  }

  const id = randomUUID();
  const now = nowIso();
  db.insert(socialPosts)
    .values({
      id,
      platform: input.platform,
      platformPostId: input.platformPostId,
      canonicalUrl: input.canonicalUrl,
      accountName: input.accountName,
      accountUrl: input.accountUrl,
      publishedAt: input.publishedAt,
      publishedAtPrecision: input.publishedAtPrecision,
      rawText: input.rawText,
      extractedLinks: JSON.stringify(input.extractedLinks),
      firstSeenAt: now,
      lastSeenAt: now,
    })
    .run();

  const row = db.select().from(socialPosts).where(eq(socialPosts.id, id)).get()!;
  return { outcome: "created", post: rowToRecord(row) };
}

export function getPostById(id: string): SocialPostRecord | null {
  const row = getDb().select().from(socialPosts).where(eq(socialPosts.id, id)).get();
  return row ? rowToRecord(row) : null;
}

export function listRecentPosts(limit = 50): SocialPostRecord[] {
  return getDb()
    .select()
    .from(socialPosts)
    .orderBy(desc(socialPosts.firstSeenAt))
    .limit(limit)
    .all()
    .map(rowToRecord);
}

export function countPosts(): number {
  const row = getDb().select({ count: sql<number>`count(*)` }).from(socialPosts).get();
  return Number(row?.count ?? 0);
}
