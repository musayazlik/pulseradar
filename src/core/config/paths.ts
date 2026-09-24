import os from "node:os";
import path from "node:path";
import fs from "node:fs";

/**
 * Veri kökü: ~/Library/Application Support/EventRadar/
 * EVENT_RADAR_DATA_DIR ile.override edilebilir.
 */
export function getDataDir(): string {
  const configured = process.env.EVENT_RADAR_DATA_DIR;
  if (configured && configured.trim().length > 0) {
    return path.resolve(configured.trim());
  }
  return path.join(os.homedir(), "Library", "Application Support", "EventRadar");
}

export function getDatabasePath(): string {
  return path.join(getDataDir(), "events.sqlite");
}

export function getBrowserProfileDir(): string {
  return path.join(getDataDir(), "browser-profile");
}

export function getLogsDir(): string {
  return path.join(getDataDir(), "logs");
}

export function getOcrCacheDir(): string {
  return path.join(getDataDir(), "ocr-cache");
}

export function getConfigPath(): string {
  return path.join(getDataDir(), "search.json");
}

export function getProfileLockPath(): string {
  return path.join(getDataDir(), "browser-profile.lock");
}

export function ensureDataDirs(): void {
  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.mkdirSync(getLogsDir(), { recursive: true });
}
