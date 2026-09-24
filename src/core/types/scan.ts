import type { Platform } from "./platform";

export type ScanKind = "scan" | "session_check" | "open_login";

export type ScanRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled"
  | "interrupted";

export type ScanTaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

export interface ScanCounters {
  uniquePostsScanned: number;
  postsReseen: number;
  eventCandidates: number;
  eventsCreated: number;
  candidatesMerged: number;
  reviewItems: number;
  filteredByDate: number;
  platformErrors: number;
}

export function emptyCounters(): ScanCounters {
  return {
    uniquePostsScanned: 0,
    postsReseen: 0,
    eventCandidates: 0,
    eventsCreated: 0,
    candidatesMerged: 0,
    reviewItems: 0,
    filteredByDate: 0,
    platformErrors: 0,
  };
}

export function mergeCounters(
  base: ScanCounters,
  delta: Partial<ScanCounters>,
): ScanCounters {
  return {
    uniquePostsScanned: base.uniquePostsScanned + (delta.uniquePostsScanned ?? 0),
    postsReseen: base.postsReseen + (delta.postsReseen ?? 0),
    eventCandidates: base.eventCandidates + (delta.eventCandidates ?? 0),
    eventsCreated: base.eventsCreated + (delta.eventsCreated ?? 0),
    candidatesMerged: base.candidatesMerged + (delta.candidatesMerged ?? 0),
    reviewItems: base.reviewItems + (delta.reviewItems ?? 0),
    filteredByDate: base.filteredByDate + (delta.filteredByDate ?? 0),
    platformErrors: base.platformErrors + (delta.platformErrors ?? 0),
  };
}

export interface ScanLimits {
  maxQueriesPerPlatform: number;
  maxPostsPerQuery: number;
  maxPostsPerPlatform: number;
  maxPostsPerRun: number;
  maxScrollsPerQuery: number;
  minDelayMs: number;
  maxDelayMs: number;
  maxRunMinutes: number;
}

export interface CreateScanInput {
  platforms: Platform[];
  city?: string | null;
  keywords?: string[];
  hashtags?: string[];
  lastDays?: number | null;
  includeOnline?: boolean;
}

export interface ScanRunRecord {
  id: string;
  kind: ScanKind;
  status: ScanRunStatus;
  configSnapshot: unknown;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelRequestedAt: string | null;
  workerId: string | null;
  heartbeatAt: string | null;
  leaseExpiresAt: string | null;
  counters: ScanCounters;
  stopReason: string | null;
}

export interface ScanTaskRecord {
  id: string;
  runId: string;
  platform: Platform;
  query: string;
  status: ScanTaskStatus;
  attempt: number;
  checkpointJson: string | null;
  lastError: string | null;
  reasonCode: string | null;
  postsScanned: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ScanRunDetail extends ScanRunRecord {
  tasks: ScanTaskRecord[];
}
