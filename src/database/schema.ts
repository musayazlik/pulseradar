import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    description: text("description"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    startTime: text("start_time"),
    endTime: text("end_time"),
    timeZone: text("time_zone"),
    datePrecision: text("date_precision").notNull().default("unknown"),
    venue: text("venue"),
    city: text("city"),
    cityNormalized: text("city_normalized"),
    country: text("country"),
    attendanceMode: text("attendance_mode").notNull().default("unknown"),
    organizer: text("organizer"),
    registrationUrl: text("registration_url"),
    status: text("status").notNull().default("needs_review"),
    confidence: integer("confidence").notNull().default(0),
    firstDiscoveredAt: text("first_discovered_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    manuallyEditedFields: text("manually_edited_fields").notNull().default("[]"),
  },
  (table) => [
    index("idx_events_start_date").on(table.startDate),
    index("idx_events_status").on(table.status),
    index("idx_events_city_normalized").on(table.cityNormalized),
  ],
);

export const socialPosts = sqliteTable(
  "social_posts",
  {
    id: text("id").primaryKey(),
    platform: text("platform").notNull(),
    platformPostId: text("platform_post_id"),
    canonicalUrl: text("canonical_url").notNull(),
    accountName: text("account_name"),
    accountUrl: text("account_url"),
    publishedAt: text("published_at"),
    publishedAtPrecision: text("published_at_precision").notNull().default("unknown"),
    rawText: text("raw_text").notNull(),
    extractedLinks: text("extracted_links").notNull().default("[]"),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [
    uniqueIndex("uq_posts_platform_post_id").on(table.platform, table.platformPostId),
    uniqueIndex("uq_posts_platform_url").on(table.platform, table.canonicalUrl),
  ],
);

export const eventSources = sqliteTable(
  "event_sources",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    evidenceJson: text("evidence_json"),
    parserVersion: text("parser_version").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.postId] })],
);

export const scanRuns = sqliteTable(
  "scan_runs",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull().default("scan"),
    status: text("status").notNull().default("queued"),
    configSnapshot: text("config_snapshot"),
    createdAt: text("created_at").notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    cancelRequestedAt: text("cancel_requested_at"),
    workerId: text("worker_id"),
    heartbeatAt: text("heartbeat_at"),
    leaseExpiresAt: text("lease_expires_at"),
    countersJson: text("counters_json").notNull().default("{}"),
    stopReason: text("stop_reason"),
  },
  (table) => [index("idx_runs_status").on(table.status)],
);

export const scanTasks = sqliteTable(
  "scan_tasks",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => scanRuns.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    query: text("query").notNull(),
    status: text("status").notNull().default("queued"),
    attempt: integer("attempt").notNull().default(0),
    checkpointJson: text("checkpoint_json"),
    lastError: text("last_error"),
    reasonCode: text("reason_code"),
    postsScanned: integer("posts_scanned").notNull().default(0),
    createdAt: text("created_at").notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
  },
  (table) => [index("idx_tasks_run").on(table.runId)],
);

export const scanObservations = sqliteTable(
  "scan_observations",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => scanTasks.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    observedAt: text("observed_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.postId] })],
);

export const reviewItems = sqliteTable(
  "review_items",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
    candidateEventId: text("candidate_event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull(),
    resolvedAt: text("resolved_at"),
  },
  (table) => [index("idx_reviews_status").on(table.status)],
);

/** Bağlantılar ekranı için son oturum kontrol sonuçları. */
export const sessionChecks = sqliteTable(
  "session_checks",
  {
    id: text("id").primaryKey(),
    platform: text("platform").notNull(),
    status: text("status").notNull(),
    detail: text("detail"),
    checkedAt: text("checked_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (table) => [
    index("idx_session_checks_platform").on(table.platform, table.checkedAt),
  ],
);
