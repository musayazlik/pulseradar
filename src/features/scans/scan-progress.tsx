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
  ["uniquePostsScanned", "taranan paylaşım", "primary"],
  ["eventsCreated", "eklenen etkinlik", "primary"],
  ["postsReseen", "yeniden görülen", "muted"],
  ["candidatesMerged", "birleşen aday", "muted"],
  ["reviewItems", "incelenecek", "amber"],
  ["filteredByDate", "tarihte elenen", "muted"],
  ["eventCandidates", "aday", "muted"],
  ["platformErrors", "platform hatası", "amber"],
];

export function ScanProgress({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["scan", runId],
    queryFn: () => api.scan(runId),
    // Yalnızca aktif taramada ~2 saniyede bir durum sorgusu.
    refetchInterval: (q) => (q.state.data && TERMINAL.has(q.state.data.status) ? false : 2000),
  });

  const cancel = async () => {
    try {
      await api.cancelScan(runId);
      toast.info("İptal talebi kaydedildi; worker adımlar arasında uygular.");
      await queryClient.invalidateQueries({ queryKey: ["scan", runId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (query.isLoading) return <p className="font-mono text-sm text-muted-foreground">yükleniyor…</p>;
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
              neden: {run.stopReason}
            </span>
          )}
        </div>
        {!isTerminal ? (
          <Button size="sm" variant="destructive" onClick={cancel}>
            İptal et
          </Button>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">tarama sonlandı</span>
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
                sorgu
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                durum
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                paylaşım
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                not
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
          sayaçlar ~2 saniyede bir yenileniyor; panel kapansa da worker devam eder
        </p>
      )}
    </div>
  );
}
