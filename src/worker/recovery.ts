import {
  finishRun,
  listExpiredRunningRuns,
  listStaleRunningTasks,
  updateTask,
} from "../database/repositories/scans";
import type { ScanRunStatus } from "../core/types/scan";

/**
 * After a crash/sleep, jobs whose lease expired are marked `interrupted`;
 * tasks can be retried idempotently from their last checkpoint.
 */
export function markInterruptedRuns(): number {
  const expired = listExpiredRunningRuns();
  for (const run of expired) {
    for (const task of listStaleRunningTasks(run.id)) {
      updateTask(task.id, {
        status: "failed",
        lastError: "worker_interrupted",
        finishedAt: new Date().toISOString(),
      });
    }
    const status: ScanRunStatus = "interrupted";
    finishRun(run.id, status, "lease_expired");
  }
  return expired.length;
}
