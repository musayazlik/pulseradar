import fs from "node:fs";
import { getSqlite } from "../../database/client";
import { latestWorkerHeartbeat } from "../../database/repositories/scans";
import { loadConfig } from "../config/loader";
import { getDataDir, getProfileLockPath } from "../config/paths";

export interface HealthReport {
  database: { ok: boolean; path: string; error?: string };
  config: { ok: boolean; error?: string };
  worker: { active: boolean; workerId?: string; heartbeatAt?: string };
  profileLockHeld: boolean;
  browserMode: string;
  dataDir: string;
}

export function collectHealth(): HealthReport {
  const dataDir = getDataDir();
  let database: HealthReport["database"];
  try {
    getSqlite().prepare("select 1").get();
    database = { ok: true, path: getSqlite().name };
  } catch (err) {
    database = { ok: false, path: "", error: (err as Error).message };
  }

  let config: HealthReport["config"] = { ok: true };
  try {
    loadConfig();
  } catch (err) {
    config = { ok: false, error: (err as Error).message };
  }

  const heartbeat = latestWorkerHeartbeat();
  const heartbeatAt = heartbeat ? new Date(heartbeat.heartbeatAt).getTime() : 0;
  const active = Date.now() - heartbeatAt < 90 * 1000;

  return {
    database,
    config,
    worker: {
      active,
      workerId: active ? heartbeat?.workerId : undefined,
      heartbeatAt: heartbeat?.heartbeatAt,
    },
    profileLockHeld: fs.existsSync(getProfileLockPath()),
    browserMode: process.env.EVENT_RADAR_BROWSER_MODE ?? "persistent",
    dataDir,
  };
}
