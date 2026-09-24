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
    console.log(`Tarama kuyruğa alındı: ${runId}`);
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
    // Mevcut worker yok: tek seferlik worker'ı profil kilidiyle dene.
    let ownsLock = false;
    try {
      acquireProfileLock();
      ownsLock = true;
    } catch (err) {
      console.log(`Profil kilidi alınamadı: ${(err as Error).message}`);
      console.log("İş kuyrukta; panel çalışıyorsa worker'ı işleyecek.");
    }

    if (ownsLock) {
      markInterruptedRuns();
      console.log("Tek seferlik worker: iş bu süreçte yürütülecek.");
      await executeRunsUntilTerminal(runId);
      releaseProfileLock();
      getSqlite().close();
      return 0;
    }
  } else {
    console.log("Mevcut worker çalışıyor; ilerleme izleniyor…");
  }

  await waitForTerminal(runId);
  getSqlite().close();
  return 0;
}

let isLockOwnedByUs = false;

/** Kuyruktaki işleri sırayla yürütür; hedef iş terminal olana dek. */
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
    console.log(`İş yürütülüyor: ${detail.kind} ${detail.id.slice(0, 8)}`);
    try {
      const result = await runJob(detail);
      console.log(`İş bitti: ${result.status}${result.stopReason ? ` (${result.stopReason})` : ""}`);
    } catch (err) {
      console.error(`İş hatası: ${(err as Error).message}`);
    }
    const target = getRunDetail(targetRunId);
    if (target && TERMINAL.has(target.status)) return;
  }
}

async function waitForTerminal(runId: string): Promise<void> {
  for (;;) {
    const detail = getRunDetail(runId);
    if (!detail) {
      console.error("Tarama bulunamadı.");
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
  console.log(`Sonuç: ${detail.status}${detail.stopReason ? ` (${detail.stopReason})` : ""}`);
  const c = detail.counters;
  console.log(
    `Paylaşımlar: ${c.uniquePostsScanned} benzersiz, ${c.postsReseen} yeniden; ` +
      `etkinlik: ${c.eventsCreated} yeni, ${c.candidatesMerged} birleşen, ${c.reviewItems} inceleme; ` +
      `platform hataları: ${c.platformErrors}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}
