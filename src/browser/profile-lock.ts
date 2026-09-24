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
        ? `Browser profile is in use by another process (PID ${contents.pid}, ${contents.acquiredAt}). Wait until that process exits.`
        : "Browser profile is locked.",
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

/** The profile is managed by a single worker; a second process gets a clear error. */
export function acquireProfileLock(): void {
  const lockPath = getProfileLockPath();

  if (fs.existsSync(lockPath)) {
    const existing = readLock(lockPath);
    if (existing && isProcessAlive(existing.pid)) {
      throw new ProfileLockedError(existing);
    }
    // Stale lock: cleaned up when the owning process is dead.
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

/** For doctor: is Chrome installed? */
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
