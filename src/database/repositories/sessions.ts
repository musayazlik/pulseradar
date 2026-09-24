import { randomUUID } from "node:crypto";
import { getDb } from "../client";
import { sessionChecks } from "../schema";
import type { Platform, SessionStatus } from "../../core/types/platform";
import { nowIso } from "../../core/utils/date";

export function recordSessionCheck(input: {
  platform: Platform;
  status: SessionStatus;
  detail?: string;
}): void {
  getDb()
    .insert(sessionChecks)
    .values({
      id: randomUUID(),
      platform: input.platform,
      status: input.status,
      detail: input.detail ?? null,
      checkedAt: nowIso(),
    })
    .run();
}

/** Latest result per platform. */
export function latestSessionChecks(): Array<{
  platform: string;
  status: string;
  detail: string | null;
  checkedAt: string;
}> {
  const rows = getDb()
    .select()
    .from(sessionChecks)
    .all();
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const existing = latest.get(row.platform);
    if (!existing || existing.checkedAt < row.checkedAt) {
      latest.set(row.platform, row);
    }
  }
  return [...latest.values()].map((r) => ({
    platform: r.platform,
    status: r.status,
    detail: r.detail,
    checkedAt: r.checkedAt,
  }));
}
