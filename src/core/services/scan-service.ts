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
  countRuns,
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

/**
 * Sorgular bütün kelimeleri şehirlerle çarpmaz; limit dahilinde seçilir.
 * Sonraki çalıştırmalarda döndürülerek kapsama genişletilir (basit offset rotasyonu).
 */
function dedupe(list: string[]): string[] {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
}

function rotate(list: string[], offset: number): string[] {
  if (list.length === 0) return list;
  const o = ((offset % list.length) + list.length) % list.length;
  return [...list.slice(o), ...list.slice(0, o)];
}

export interface SelectQueriesInput {
  /** Kullanıcının bu tarama için yazdığı anahtar kelimeler. */
  customKeywords: string[];
  /** Kullanıcının bu tarama için yazdığı hashtag'ler (# eklenmeden). */
  customHashtags: string[];
  configKeywords: string[];
  configHashtags: string[];
  maxQueries: number;
  rotationOffset: number;
}

/**
 * Belge kuralı (§10): kullanıcı özel keyword/hashtag girdiyse ÖNCE o uygulanır;
 * kalan sorgu hakkı varsayılan havuzdan döndürülerek (kapsama genişletme) doldurulur.
 * Döndürme sayacı yalnızca scan türündeki işlerle ilerler.
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

  const customSelected = custom.slice(0, Math.max(input.maxQueries, 0));
  const remaining = input.maxQueries - customSelected.length;
  const configSelected =
    remaining > 0
      ? rotate(configPool, input.rotationOffset).slice(0, remaining)
      : [];

  return {
    queries: [...customSelected, ...configSelected],
    customCount: customSelected.length,
  };
}

export function createScanRun(input: CreateScanInput): ScanRunDetail {
  const config = loadConfig();

  const platforms = input.platforms.filter((p) =>
    (MVP_PLATFORMS as readonly string[]).includes(p),
  );
  if (platforms.length === 0) {
    throw new ScanValidationError(
      "MVP'de yalnızca linkedin ve x taraması yapılabilir (instagram/tiktok ikinci aşama).",
    );
  }

  const customKeywords = dedupe(input.keywords ?? []);
  const customHashtags = dedupe(input.hashtags ?? []);
  const city = normalizeCity(input.city ?? config.filters.city);
  const lastDays = input.lastDays ?? config.filters.lastDays;
  const includeOnline = input.includeOnline ?? config.filters.includeOnline;

  // Döndürme kapsaması yalnızca scan işleriyle ilerler; session_check/open_login
  // sayacı kaydırmamalı.
  const rotationOffset = countRuns("scan");
  const { queries, customCount } = selectQueries({
    customKeywords,
    customHashtags,
    configKeywords: config.keywords,
    configHashtags: config.hashtags,
    maxQueries: config.limits.maxQueriesPerPlatform,
    rotationOffset,
  });
  if (queries.length === 0) {
    throw new ScanValidationError(
      customCount === 0 && config.keywords.length === 0 && config.hashtags.length === 0
        ? "Ayarlarında anahtar kelime veya hashtag yok; Ayarlar ekranından ekle."
        : "Tarama için kullanılabilecek sorgu üretilemedi.",
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
