import type { EventListRow, EventWithSources } from "@/core/types/event";
import type { ScanRunDetail } from "@/core/types/scan";
import type { SearchConfig } from "@/core/config/schema";

export interface HealthReport {
  database: { ok: boolean; path: string; error?: string };
  config: { ok: boolean; error?: string };
  worker: { active: boolean; workerId?: string; heartbeatAt?: string };
  profileLockHeld: boolean;
  browserMode: string;
  dataDir: string;
}

export interface ConnectionInfo {
  platform: string;
  status: string;
  detail: string | null;
  checkedAt: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthReport>("/api/health"),
  events: (params: string) =>
    request<{ events: EventListRow[]; count: number }>(`/api/events${params ? `?${params}` : ""}`),
  event: (id: string) => request<EventWithSources>(`/api/events/${id}`),
  patchEvent: (id: string, patch: Record<string, unknown>) =>
    request<EventWithSources>(`/api/events/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  scans: () =>
    request<{
      runs: Array<{
        id: string;
        kind: string;
        status: string;
        createdAt: string;
        finishedAt: string | null;
        stopReason: string | null;
        counters: {
          uniquePostsScanned: number;
          eventsCreated: number;
          reviewItems: number;
          candidatesMerged: number;
          postsReseen: number;
          filteredByDate: number;
          platformErrors: number;
          eventCandidates: number;
        };
      }>;
    }>("/api/scans"),
  scan: (id: string) => request<ScanRunDetail>(`/api/scans/${id}`),
  createScan: (input: Record<string, unknown>) =>
    request<{ runId: string }>("/api/scans", { method: "POST", body: JSON.stringify(input) }),
  cancelScan: (id: string) =>
    request<{ cancelRequested: boolean }>(`/api/scans/${id}/cancel`, { method: "POST" }),
  connections: () => request<{ connections: ConnectionInfo[] }>("/api/connections"),
  checkConnections: (platforms: string[]) =>
    request<{ runId: string }>("/api/connections/check", {
      method: "POST",
      body: JSON.stringify({ platforms }),
    }),
  openConnection: (platform: string) =>
    request<{ runId: string }>("/api/connections/open", {
      method: "POST",
      body: JSON.stringify({ platform }),
    }),
  settings: () => request<SearchConfig>("/api/settings"),
  saveSettings: (config: SearchConfig) =>
    request<SearchConfig>("/api/settings", { method: "PUT", body: JSON.stringify(config) }),
};
