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

  // DB + config erken doğrulanır.
  getDb();
  const config = loadConfig();
  logger.info(`veri dizini hazır; platformlar: ${config.enabledPlatforms.join(", ")}`);

  const lock = isProfileLocked();
  if (lock.locked) {
    console.error(
      `Tarayıcı profili kilitli (PID ${lock.contents?.pid}). İkinci worker aynı profili açamaz.`,
    );
    process.exit(1);
  }
  acquireProfileLock();

  const interrupted = markInterruptedRuns();
  if (interrupted > 0) {
    logger.info(`${interrupted} yarıda kalmış iş 'interrupted' işaretlendi.`);
  }

  let stopping = false;
  const heartbeatTimer = setInterval(() => {}, HEARTBEAT_MS);
  heartbeatTimer.unref?.();

  const onSignal = (signal: NodeJS.Signals) => {
    if (stopping) {
      // İkinci sinyal: askıda kalan adımı beklemek yerine zorla çık.
      // Kilit dosyası kalıcı; bir sonraki worker ölü PID'yi görüp temizler.
      logger.warn(`${signal} tekrar alındı; zorla çıkılıyor.`);
      process.exit(1);
    }
    stopping = true;
    logger.info("kapatma sinyali; mevcut adım bitince çıkılacak (ikinci sinyal zorla kapatır).");
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
      logger.info(`iş alındı: ${run.kind} ${run.id}`);

      const beat = setInterval(() => {
        heartbeatRun(run.id, workerId, LEASE_MS);
      }, HEARTBEAT_MS);
      beat.unref?.();

      try {
        const detail = getRunDetail(run.id);
        if (detail) {
          const result = await runJob(detail);
          logger.info(`iş bitti: ${run.id} -> ${result.status}${result.stopReason ? ` (${result.stopReason})` : ""}`);
        }
      } catch (err) {
        logger.warn(`iş hatası: ${(err as Error).message}`);
      } finally {
        clearInterval(beat);
      }
    }
  } finally {
    releaseProfileLock();
    getSqlite().close();
    logger.info("worker kapandı.");
  }
}

function sleep(ms: number): Promise<void> {
  // unref YOK: bekleme sırasında olay döngüsünü canlı tutar.
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
