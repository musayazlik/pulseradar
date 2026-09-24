"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatTile } from "@/components/stat-tile";
import { StatusChip } from "@/components/status-chip";
import { api } from "@/lib/api";
import type { ScanCounters } from "@/core/types/scan";

const TERMINAL = new Set(["completed", "partial", "failed", "cancelled", "interrupted"]);

const COUNTER_LABELS: Array<[keyof ScanCounters, string, "primary" | "amber" | "muted"]> = [
  ["uniquePostsScanned", "posts scanned", "primary"],
  ["eventsCreated", "events added", "primary"],
  ["postsReseen", "seen again", "muted"],
  ["candidatesMerged", "merged candidates", "muted"],
  ["reviewItems", "needs review", "amber"],
  ["filteredByDate", "filtered by date", "muted"],
  ["eventCandidates", "candidates", "muted"],
  ["platformErrors", "platform errors", "amber"],
];

export function ScanProgress({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["scan", runId],
    queryFn: () => api.scan(runId),
    // Poll status every ~2 seconds only while the scan is active.
    refetchInterval: (q) => (q.state.data && TERMINAL.has(q.state.data.status) ? false : 2000),
  });

  const cancel = async () => {
    try {
      await api.cancelScan(runId);
      toast.info("Cancel requested; the worker applies it between steps.");
      await queryClient.invalidateQueries({ queryKey: ["scan", runId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (query.isLoading) return <p className="font-mono text-sm text-muted-foreground">loading…</p>;
  if (query.isError) return <p className="text-sm text-destructive">{(query.error as Error).message}</p>;
  const run = query.data!;
  const isTerminal = TERMINAL.has(run.status);

  return (
    <div className="space-y-5">
      <div className="reveal-2 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <StatusChip status={run.status} />
          {run.stopReason && (
            <span className="font-mono text-xs text-muted-foreground">
              reason: {run.stopReason}
            </span>
          )}
        </div>
        {!isTerminal ? (
          <Button size="sm" variant="destructive" onClick={cancel}>
            Cancel
          </Button>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">scan finished</span>
        )}
      </div>

      <div className="reveal-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COUNTER_LABELS.map(([key, label, accent]) => (
          <StatTile key={key} label={label} value={run.counters[key]} accent={accent} />
        ))}
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                platform
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                query
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                status
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                posts
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                note
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-mono text-xs uppercase">{task.platform}</TableCell>
                <TableCell className="max-w-64 truncate text-sm">{task.query}</TableCell>
                <TableCell>
                  <StatusChip status={task.status} />
                </TableCell>
                <TableCell className="font-mono text-xs tabular-nums">
                  {task.postsScanned}
                </TableCell>
                <TableCell className="max-w-64 truncate font-mono text-[11px] text-muted-foreground">
                  {task.reasonCode ?? task.lastError ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!isTerminal && (
        <p className="font-mono text-[11px] text-muted-foreground">
          counters refresh every ~2 seconds; the worker continues even if the panel closes
        </p>
      )}
    </div>
  );
}
