import { randomUUID } from "node:crypto";
import {
  claimNextRun,
  getRunDetail,
  heartbeatRun,
} from "../database/repositories/scans";
import { getDb, getSqlite } from "../database/client";
import { loadConfig } from "../core/config/loader";
import { runJob } from "./job-runner";
import { markInterruptedRuns } from "./recovery";
import {
  acquireProfileLock,
  isProfileLocked,
  releaseProfileLock,
} from "../browser/profile-lock";

const LEASE_MS = 60_000;
const HEARTBEAT_MS = 15_000;
const POLL_MS = 2_000;

async function main(): Promise<void> {
  const workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
  const logger = {
    info: (msg: string) => console.log(`[${workerId}] ${msg}`),
    warn: (msg: string) => console.warn(`[${workerId}] ${msg}`),
  };

  // DB + config are validated early.
  getDb();
  const config = loadConfig();
  logger.info(`data directory ready; platforms: ${config.enabledPlatforms.join(", ")}`);

  const lock = isProfileLocked();
  if (lock.locked) {
    console.error(
      `Browser profile is locked (PID ${lock.contents?.pid}). A second worker cannot open the same profile.`,
    );
    process.exit(1);
  }
  acquireProfileLock();

  const interrupted = markInterruptedRuns();
  if (interrupted > 0) {
    logger.info(`${interrupted} interrupted job(s) marked as 'interrupted'.`);
  }

  let stopping = false;
  const heartbeatTimer = setInterval(() => {}, HEARTBEAT_MS);
  heartbeatTimer.unref?.();

  const onSignal = (signal: NodeJS.Signals) => {
    if (stopping) {
      // Second signal: force exit instead of waiting on a stuck step.
      // The lock file persists; the next worker sees the dead PID and cleans it up.
      logger.warn(`${signal} received again; forcing exit.`);
      process.exit(1);
    }
    stopping = true;
    logger.info("shutdown signal; exiting after the current step (second signal forces exit).");
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    while (!stopping) {
      const run = claimNextRun(workerId, LEASE_MS);
      if (!run) {
        await sleep(POLL_MS);
        continue;
      }
      logger.info(`job claimed: ${run.kind} ${run.id}`);

      const beat = setInterval(() => {
        heartbeatRun(run.id, workerId, LEASE_MS);
      }, HEARTBEAT_MS);
      beat.unref?.();

      try {
        const detail = getRunDetail(run.id);
        if (detail) {
          const result = await runJob(detail);
          logger.info(`job finished: ${run.id} -> ${result.status}${result.stopReason ? ` (${result.stopReason})` : ""}`);
        }
      } catch (err) {
        logger.warn(`job error: ${(err as Error).message}`);
      } finally {
        clearInterval(beat);
      }
    }
  } finally {
    releaseProfileLock();
    getSqlite().close();
    logger.info("worker shut down.");
  }
}

function sleep(ms: number): Promise<void> {
  // NO unref: keeps the event loop alive while waiting.
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
