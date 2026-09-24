import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { getProfileLockPath } from "../core/config/paths";

interface LockContents {
  pid: number;
  acquiredAt: string;
  host: string;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export class ProfileLockedError extends Error {
  constructor(public readonly contents: LockContents | null) {
    super(
      contents
        ? `Tarayıcı profili başka bir süreçte kullanılıyor (PID ${contents.pid}, ${contents.acquiredAt}). O süreç kapanana kadar bekleyin.`
        : "Tarayıcı profili kilitli.",
    );
  }
}

function readLock(path: string): LockContents | null {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8")) as LockContents;
  } catch {
    return null;
  }
}

/** Profil tek worker tarafından yönetilir; ikinci süreç anlaşılır hata alır. */
export function acquireProfileLock(): void {
  const lockPath = getProfileLockPath();

  if (fs.existsSync(lockPath)) {
    const existing = readLock(lockPath);
    if (existing && isProcessAlive(existing.pid)) {
      throw new ProfileLockedError(existing);
    }
    // Bayat kilit: süreç ölmüşse temizlenir.
    fs.rmSync(lockPath, { force: true });
  }

  const contents: LockContents = {
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    host: "local",
  };
  try {
    fs.writeFileSync(lockPath, JSON.stringify(contents), { flag: "wx" });
  } catch {
    throw new ProfileLockedError(readLock(lockPath));
  }
}

export function releaseProfileLock(): void {
  const lockPath = getProfileLockPath();
  if (!fs.existsSync(lockPath)) return;
  const contents = readLock(lockPath);
  if (contents && contents.pid !== process.pid) return;
  fs.rmSync(lockPath, { force: true });
}

export function isProfileLocked(): { locked: boolean; contents: LockContents | null } {
  const lockPath = getProfileLockPath();
  if (!fs.existsSync(lockPath)) return { locked: false, contents: null };
  const contents = readLock(lockPath);
  return { locked: contents ? isProcessAlive(contents.pid) : true, contents };
}

/** doctor için: Chrome kurulu mu? */
export function isChromeInstalled(): boolean {
  try {
    execFileSync("mdfind", ["kMDItemCFBundleIdentifier == 'com.google.Chrome'"], {
      timeout: 3000,
      stdio: "pipe",
    });
    return true;
  } catch {
    return fs.existsSync("/Applications/Google Chrome.app");
  }
}
