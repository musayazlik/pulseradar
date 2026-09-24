import {
  createScanRun,
  ScanValidationError,
} from "../core/services/scan-service";
import {
  claimNextRun,
  getRunDetail,
  latestWorkerHeartbeat,
} from "../database/repositories/scans";
import { normalizePlatform } from "../core/types/platform";
import {
  acquireProfileLock,
  releaseProfileLock,
} from "../browser/profile-lock";
import { markInterruptedRuns } from "../worker/recovery";
import { runJob } from "../worker/job-runner";
import { getSqlite } from "../database/client";
const TERMINAL = new Set(["completed", "partial", "failed", "cancelled", "interrupted"]);

export async function runSearchCommand(flags: Record<string, string>): Promise<number> {
  const platforms: string[] = [];
  if (flags.platform) {
    for (const part of flags.platform.split(",")) {
      const normalized = normalizePlatform(part);
      if (!normalized) {
        console.error(`Bilinmeyen platform: ${part} (linkedin, x, instagram, tiktok)`);
        return 1;
      }
      platforms.push(normalized);
    }
  }
  if (platforms.length === 0) platforms.push("linkedin", "x");

  let runId: string;
  try {
    const run = createScanRun({
      platforms: platforms as never,
      city: flags.city ?? null,
      keywords: flags.keyword ? [flags.keyword] : undefined,
      hashtags: flags.hashtag ? [flags.hashtag] : undefined,
      lastDays: flags.days ? Number(flags.days) : undefined,
    });
    runId = run.id;
    console.log(`Scan queued: ${runId}`);
  } catch (err) {
    if (err instanceof ScanValidationError) {
      console.error(err.message);
      return 1;
    }
    throw err;
  }

  const heartbeat = latestWorkerHeartbeat();
  const heartbeatAge = heartbeat
    ? Date.now() - new Date(heartbeat.heartbeatAt).getTime()
    : Infinity;

  if (heartbeatAge >= 90_000) {
    // No existing worker: try a one-shot worker under the profile lock.
    let ownsLock = false;
    try {
      acquireProfileLock();
      ownsLock = true;
    } catch (err) {
      console.log(`Could not acquire the profile lock: ${(err as Error).message}`);
      console.log("Job stays queued; the panel worker will pick it up if running.");
    }

    if (ownsLock) {
      markInterruptedRuns();
      console.log("One-shot worker: the job will run in this process.");
      await executeRunsUntilTerminal(runId);
      releaseProfileLock();
      getSqlite().close();
      return 0;
    }
  } else {
    console.log("Existing worker is running; following progress…");
  }

  await waitForTerminal(runId);
  getSqlite().close();
  return 0;
}

let isLockOwnedByUs = false;

/** Executes queued jobs in order until the target job reaches a terminal state. */
async function executeRunsUntilTerminal(targetRunId: string): Promise<void> {
  for (;;) {
    const run = claimNextRun(`cli-${process.pid}`, 5 * 60_000);
    if (!run) {
      await sleep(1000);
      const detail = getRunDetail(targetRunId);
      if (detail && TERMINAL.has(detail.status)) return;
      continue;
    }
    const detail = getRunDetail(run.id);
    if (!detail) continue;
    console.log(`Running job: ${detail.kind} ${detail.id.slice(0, 8)}`);
    try {
      const result = await runJob(detail);
      console.log(`Job finished: ${result.status}${result.stopReason ? ` (${result.stopReason})` : ""}`);
    } catch (err) {
      console.error(`Job error: ${(err as Error).message}`);
    }
    const target = getRunDetail(targetRunId);
    if (target && TERMINAL.has(target.status)) return;
  }
}

async function waitForTerminal(runId: string): Promise<void> {
  for (;;) {
    const detail = getRunDetail(runId);
    if (!detail) {
      console.error("Scan not found.");
      return;
    }
    if (TERMINAL.has(detail.status)) {
      printSummary(detail);
      return;
    }
    await sleep(2000);
  }
}

function printSummary(detail: NonNullable<ReturnType<typeof getRunDetail>>): void {
  console.log(`Result: ${detail.status}${detail.stopReason ? ` (${detail.stopReason})` : ""}`);
  const c = detail.counters;
  console.log(
    `Posts: ${c.uniquePostsScanned} unique, ${c.postsReseen} seen again; ` +
      `events: ${c.eventsCreated} new, ${c.candidatesMerged} merged, ${c.reviewItems} review; ` +
      `platform errors: ${c.platformErrors}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}
