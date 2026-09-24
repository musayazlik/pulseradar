import { randomUUID } from "node:crypto";
import { MVP_PLATFORMS } from "../types/platform";
import type { Platform, SessionStatus } from "../types/platform";
import type {
  CreateScanInput,
  ScanCounters,
  ScanKind,
  ScanRunDetail,
  ScanRunRecord,
} from "../types/scan";
import {
  getRunDetail,
  insertRun,
  insertTasks,
  listRuns,
  requestCancel,
} from "../../database/repositories/scans";
import { loadConfig } from "../config/loader";
import { nowIso } from "../utils/date";
import { normalizeCity } from "../utils/normalize";

export class ScanValidationError extends Error {}

export interface ScanRunSummary {
  id: string;
  kind: ScanKind;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  stopReason: string | null;
  counters: ScanCounters;
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
}

export interface SelectQueriesInput {
  /** Keywords the user wrote for this scan. */
  customKeywords: string[];
  /** Hashtags the user wrote for this scan (without #). */
  customHashtags: string[];
  configKeywords: string[];
  configHashtags: string[];
}

/**
 * Every word the user provides is scanned: custom inputs are never trimmed,
 * the rest is completed from the Settings list. No trimming or deferring
 * to a later run (rotation) happens.
 */
export function selectQueries(input: SelectQueriesInput): {
  queries: string[];
  customCount: number;
} {
  const custom = dedupe([
    ...input.customKeywords,
    ...input.customHashtags.map((tag) => `#${tag}`),
  ]);
  const configPool = dedupe([
    ...input.configKeywords,
    ...input.configHashtags.map((tag) => `#${tag}`),
  ]).filter((q) => !custom.includes(q));

  return {
    queries: [...custom, ...configPool],
    customCount: custom.length,
  };
}

export function createScanRun(input: CreateScanInput): ScanRunDetail {
  const config = loadConfig();

  const platforms = input.platforms.filter((p) =>
    (MVP_PLATFORMS as readonly string[]).includes(p),
  );
  if (platforms.length === 0) {
    throw new ScanValidationError(
      "The MVP can only scan linkedin and x (instagram/tiktok are a later phase).",
    );
  }

  const customKeywords = dedupe(input.keywords ?? []);
  const customHashtags = dedupe(input.hashtags ?? []);
  const city = normalizeCity(input.city ?? config.filters.city);
  const lastDays = input.lastDays ?? config.filters.lastDays;
  const includeOnline = input.includeOnline ?? config.filters.includeOnline;

  // Every user-provided word is scanned in this run.
  const { queries, customCount } = selectQueries({
    customKeywords,
    customHashtags,
    configKeywords: config.keywords,
    configHashtags: config.hashtags,
  });
  if (queries.length === 0) {
    throw new ScanValidationError(
      customCount === 0 && config.keywords.length === 0 && config.hashtags.length === 0
        ? "No keywords or hashtags in Settings; add them on the Settings screen."
        : "Could not produce a query usable for scanning.",
    );
  }

  const configSnapshot = {
    ...config,
    keywords: customKeywords.length > 0 ? customKeywords : config.keywords,
    hashtags: customHashtags.length > 0 ? customHashtags : config.hashtags,
    selectedQueries: queries,
    filters: { ...config.filters, city, lastDays, includeOnline },
  };

  const runId = randomUUID();
  insertRun({ id: runId, kind: "scan", configSnapshot });

  const now = nowIso();
  const tasks = platforms.flatMap((platform) =>
    queries.map((query) => ({
      id: randomUUID(),
      runId,
      platform,
      query,
      createdAt: now,
    })),
  );
  insertTasks(tasks);

  return getRunDetail(runId)!;
}

export function enqueueSessionCheck(
  platforms: Platform[],
): ScanRunRecord {
  const runId = randomUUID();
  return insertRun({
    id: runId,
    kind: "session_check",
    configSnapshot: { platforms },
  });
}

export function enqueueOpenLogin(platform: Platform): ScanRunRecord {
  return insertRun({
    id: randomUUID(),
    kind: "open_login",
    configSnapshot: { platform },
  });
}

export function getScanDetail(id: string): ScanRunDetail | null {
  return getRunDetail(id);
}

export function listScanHistory(): ScanRunSummary[] {
  return listRuns(100).map((run) => ({
    id: run.id,
    kind: run.kind,
    status: run.status,
    createdAt: run.createdAt,
    finishedAt: run.finishedAt,
    stopReason: run.stopReason,
    counters: run.counters,
  }));
}

export function cancelScan(id: string): boolean {
  return requestCancel(id);
}

export type { SessionStatus };
