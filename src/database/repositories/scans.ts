import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "../client";
import { scanObservations, scanRuns, scanTasks } from "../schema";
import type {
  ScanCounters,
  ScanKind,
  ScanRunDetail,
  ScanRunRecord,
  ScanRunStatus,
  ScanTaskRecord,
  ScanTaskStatus,
} from "../../core/types/scan";
import { emptyCounters, mergeCounters } from "../../core/types/scan";
import type { Platform } from "../../core/types/platform";
import { nowIso } from "../../core/utils/date";

function countersFrom(json: string): ScanCounters {
  try {
    return { ...emptyCounters(), ...(JSON.parse(json) as Partial<ScanCounters>) };
  } catch {
    return emptyCounters();
  }
}

function runToRecord(row: typeof scanRuns.$inferSelect): ScanRunRecord {
  return {
    id: row.id,
    kind: row.kind as ScanKind,
    status: row.status as ScanRunStatus,
    configSnapshot: row.configSnapshot ? JSON.parse(row.configSnapshot) : null,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    cancelRequestedAt: row.cancelRequestedAt,
    workerId: row.workerId,
    heartbeatAt: row.heartbeatAt,
    leaseExpiresAt: row.leaseExpiresAt,
    counters: countersFrom(row.countersJson),
    stopReason: row.stopReason,
  };
}

function taskToRecord(row: typeof scanTasks.$inferSelect): ScanTaskRecord {
  return {
    id: row.id,
    runId: row.runId,
    platform: row.platform as Platform,
    query: row.query,
    status: row.status as ScanTaskStatus,
    attempt: row.attempt,
    checkpointJson: row.checkpointJson,
    lastError: row.lastError,
    reasonCode: row.reasonCode,
    postsScanned: row.postsScanned,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

export function insertRun(input: {
  id: string;
  kind: ScanKind;
  configSnapshot: unknown;
}): ScanRunRecord {
  const db = getDb();
  db.insert(scanRuns)
    .values({
      id: input.id,
      kind: input.kind,
      status: "queued",
      configSnapshot: JSON.stringify(input.configSnapshot),
      createdAt: nowIso(),
      countersJson: JSON.stringify(emptyCounters()),
    })
    .run();
  return getRun(input.id)!;
}

export function insertTasks(
  tasks: Array<{ id: string; runId: string; platform: Platform; query: string }>,
): void {
  const db = getDb();
  const now = nowIso();
  db.insert(scanTasks)
    .values(tasks.map((t) => ({ ...t, status: "queued" as const, createdAt: now })))
    .run();
}

export function getRun(id: string): ScanRunRecord | null {
  const row = getDb().select().from(scanRuns).where(eq(scanRuns.id, id)).get();
  return row ? runToRecord(row) : null;
}

export function getRunDetail(id: string): ScanRunDetail | null {
  const run = getRun(id);
  if (!run) return null;
  const tasks = getDb()
    .select()
    .from(scanTasks)
    .where(eq(scanTasks.runId, id))
    .orderBy(asc(scanTasks.createdAt))
    .all()
    .map(taskToRecord);
  return { ...run, tasks };
}

export function listRuns(limit = 50): ScanRunRecord[] {
  return getDb()
    .select()
    .from(scanRuns)
    .orderBy(desc(scanRuns.createdAt))
    .limit(limit)
    .all()
    .map(runToRecord);
}

/** Job counter by kind (for query rotation coverage). */
export function countRuns(kind?: ScanKind): number {
  const db = getDb();
  const query = db.select({ count: sql<number>`count(*)` }).from(scanRuns);
  const row = kind ? query.where(eq(scanRuns.kind, kind)).get() : query.get();
  return Number(row?.count ?? 0);
}

/**
 * Atomic job claiming: only one worker sees `changes=1`.
 * Returns the next queued job; null when the queue is empty.
 */
export function claimNextRun(
  workerId: string,
  leaseMs: number,
  kinds: ScanKind[] = ["scan", "session_check", "open_login"],
): ScanRunRecord | null {
  const db = getDb();
  const now = nowIso();
  const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();

  return db.transaction(() => {
    const candidate = db
      .select()
      .from(scanRuns)
      .where(
        and(
          inArray(scanRuns.kind, kinds),
          or(
            eq(scanRuns.status, "queued"),
            and(
              eq(scanRuns.status, "running"),
              lt(scanRuns.leaseExpiresAt, now),
            ),
          ),
        ),
      )
      .orderBy(asc(scanRuns.createdAt))
      .get();

    if (!candidate) return null;

    const result = db
      .update(scanRuns)
      .set({
        status: "running",
        workerId,
        startedAt: candidate.startedAt ?? now,
        heartbeatAt: now,
        leaseExpiresAt,
      })
      .where(
        and(
          eq(scanRuns.id, candidate.id),
          or(
            eq(scanRuns.status, "queued"),
            and(
              eq(scanRuns.status, "running"),
              lt(scanRuns.leaseExpiresAt, now),
            ),
          ),
        ),
      )
      .run();

    if (result.changes === 0) return null;
    return getRun(candidate.id);
  });
}

export function heartbeatRun(
  runId: string,
  workerId: string,
  leaseMs: number,
): boolean {
  const now = nowIso();
  const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
  const result = getDb()
    .update(scanRuns)
    .set({ heartbeatAt: now, leaseExpiresAt })
    .where(and(eq(scanRuns.id, runId), eq(scanRuns.workerId, workerId)))
    .run();
  return result.changes > 0;
}

export function isCancelRequested(runId: string): boolean {
  const row = getDb()
    .select({ cancelRequestedAt: scanRuns.cancelRequestedAt })
    .from(scanRuns)
    .where(eq(scanRuns.id, runId))
    .get();
  return row?.cancelRequestedAt != null;
}

export function requestCancel(runId: string): boolean {
  const result = getDb()
    .update(scanRuns)
    .set({ cancelRequestedAt: nowIso() })
    .where(and(eq(scanRuns.id, runId), sql`${scanRuns.finishedAt} IS NULL`))
    .run();
  return result.changes > 0;
}

export function mergeRunCounters(
  runId: string,
  delta: Partial<ScanCounters>,
): void {
  const db = getDb();
  const run = getRun(runId);
  if (!run) return;
  const merged = mergeCounters(run.counters, delta);
  db.update(scanRuns)
    .set({ countersJson: JSON.stringify(merged) })
    .where(eq(scanRuns.id, runId))
    .run();
}

export function finishRun(
  runId: string,
  status: ScanRunStatus,
  stopReason: string | null,
): void {
  getDb()
    .update(scanRuns)
    .set({ status, finishedAt: nowIso(), stopReason })
    .where(eq(scanRuns.id, runId))
    .run();
}

export function updateTask(
  taskId: string,
  patch: Partial<typeof scanTasks.$inferInsert>,
): void {
  getDb().update(scanTasks).set(patch).where(eq(scanTasks.id, taskId)).run();
}

export function listTasks(runId: string): ScanTaskRecord[] {
  return getDb()
    .select()
    .from(scanTasks)
    .where(eq(scanTasks.runId, runId))
    .all()
    .map(taskToRecord);
}

export function claimTask(
  runId: string,
  taskId: string,
): ScanTaskRecord | null {
  const db = getDb();
  return db.transaction(() => {
    const result = db
      .update(scanTasks)
      .set({ status: "running", startedAt: nowIso(), attempt: sql`${scanTasks.attempt} + 1` })
      .where(and(eq(scanTasks.id, taskId), eq(scanTasks.status, "queued")))
      .run();
    if (result.changes === 0) return null;
    const row = db.select().from(scanTasks).where(eq(scanTasks.id, taskId)).get();
    return row ? taskToRecord(row) : null;
  });
}

export function recordObservation(taskId: string, postId: string): boolean {
  try {
    getDb()
      .insert(scanObservations)
      .values({ taskId, postId, observedAt: nowIso() })
      .run();
    return true;
  } catch {
    return false; // already recorded
  }
}

export function hasObservation(postId: string): boolean {
  const row = getDb()
    .select({ postId: scanObservations.postId })
    .from(scanObservations)
    .where(eq(scanObservations.postId, postId))
    .get();
  return row != null;
}

/** Recovery: finds running jobs whose lease has expired. */
export function listExpiredRunningRuns(): ScanRunRecord[] {
  const now = nowIso();
  return getDb()
    .select()
    .from(scanRuns)
    .where(
      and(eq(scanRuns.status, "running"), lt(scanRuns.leaseExpiresAt, now)),
    )
    .all()
    .map(runToRecord);
}

export function listStaleRunningTasks(runId: string): ScanTaskRecord[] {
  return getDb()
    .select()
    .from(scanTasks)
    .where(and(eq(scanTasks.runId, runId), eq(scanTasks.status, "running")))
    .all()
    .map(taskToRecord);
}

/** Worker heartbeat: the heartbeat of the most recent running job. */
export function latestWorkerHeartbeat(): { workerId: string; heartbeatAt: string } | null {
  const row = getDb()
    .select({ workerId: scanRuns.workerId, heartbeatAt: scanRuns.heartbeatAt })
    .from(scanRuns)
    .where(and(eq(scanRuns.status, "running"), sql`${scanRuns.workerId} IS NOT NULL`))
    .orderBy(desc(scanRuns.heartbeatAt))
    .get();
  return row ? { workerId: row.workerId!, heartbeatAt: row.heartbeatAt! } : null;
}
