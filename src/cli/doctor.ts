import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { getDb } from "../database/client";
import { events } from "../database/schema";
import { loadConfig } from "../core/config/loader";
import {
  getDatabasePath,
  getDataDir,
  getLogsDir,
} from "../core/config/paths";
import { isProfileLocked } from "../browser/profile-lock";
import { latestWorkerHeartbeat } from "../database/repositories/scans";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export async function runDoctorCommand(): Promise<number> {
  const checks: Check[] = [];

  // Node version
  const major = Number(process.version.slice(1).split(".")[0]);
  checks.push({
    name: "Node >= 22",
    ok: major >= 22,
    detail: process.version,
  });

  // Veri dizini ve izinler
  try {
    fs.mkdirSync(getDataDir(), { recursive: true });
    fs.accessSync(getDataDir(), fs.constants.W_OK);
    fs.mkdirSync(getLogsDir(), { recursive: true });
    checks.push({ name: "Veri dizini", ok: true, detail: getDataDir() });
  } catch (err) {
    checks.push({ name: "Veri dizini", ok: false, detail: (err as Error).message });
  }

  // Config
  try {
    const config = loadConfig();
    checks.push({
      name: "search.json",
      ok: true,
      detail: `${config.keywords.length} kelime, ${config.hashtags.length} hashtag, OCR ${
        config.ocr.enabled ? `on (≤${config.ocr.maxImagesPerPost} images/post)` : "off"
      }`,
    });
  } catch (err) {
    checks.push({ name: "search.json", ok: false, detail: (err as Error).message });
  }

  // DB + migration durumu
  try {
    const db = getDb();
    db.select().from(events).limit(1).all();
    checks.push({ name: "SQLite", ok: true, detail: getDatabasePath() });
  } catch (err) {
    checks.push({ name: "SQLite", ok: false, detail: (err as Error).message });
  }

  // Profil kilidi
  const lock = isProfileLocked();
  checks.push({
    name: "Profil kilidi",
    ok: !lock.locked,
    detail: lock.locked ? `locked (PID ${lock.contents?.pid})` : "idle",
  });

  // Worker durumu
  const heartbeat = latestWorkerHeartbeat();
  const age = heartbeat ? Date.now() - new Date(heartbeat.heartbeatAt).getTime() : Infinity;
  checks.push({
    name: "Worker",
    ok: true,
    detail:
      age < 90_000
        ? `aktif (${heartbeat?.workerId})`
        : "no active worker (start it with npm run worker)",
  });

  // Chrome availability
  const chromePath = "/Applications/Google Chrome.app";
  let chromeOk = fs.existsSync(chromePath);
  if (!chromeOk) {
    try {
      execFileSync("mdfind", ["kMDItemCFBundleIdentifier == 'com.google.Chrome'"], {
        timeout: 3000,
        stdio: "pipe",
      });
      chromeOk = true;
    } catch {
      chromeOk = false;
    }
  }
  checks.push({
    name: "Chrome",
    ok: chromeOk,
    detail: chromeOk ? "installed" : "not found (required for persistent mode)",
  });

  // CDP modu
  const cdpUrl = process.env.EVENT_RADAR_CDP_URL;
  if (process.env.EVENT_RADAR_BROWSER_MODE === "cdp") {
    checks.push({
      name: "CDP",
      ok: Boolean(cdpUrl && /^https?:\/\/(127\.0\.0\.1|localhost)/.test(cdpUrl)),
      detail: cdpUrl ?? "EVENT_RADAR_CDP_URL not set",
    });
  }

  console.log("Event Radar — doctor\n");
  let failures = 0;
  for (const check of checks) {
    const mark = check.ok ? "✓" : "✗";
    if (!check.ok) failures += 1;
    console.log(`${mark} ${check.name}: ${check.detail}`);
  }

  console.log(
    failures === 0
      ? "\nAll checks passed."
      : `\n${failures} check(s) failed.`,
  );
  return failures === 0 ? 0 : 1;
}
