"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/status-chip";
import { api } from "@/lib/api";
import { NewScanForm } from "@/features/scans/new-scan-form";

export default function ScansPage() {
  const history = useQuery({ queryKey: ["scans"], queryFn: api.scans });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });

  return (
    <div className="space-y-6">
      <div className="reveal">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">scan console</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Scans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order a new scan and follow its history
        </p>
      </div>

      <Card className="reveal-2">
        <CardHeader>
          <CardTitle className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            new scan order
          </CardTitle>
        </CardHeader>
        <CardContent>
          {settings.data ? (
            <NewScanForm defaultLastDays={settings.data.filters.lastDays} />
          ) : (
            <p className="font-mono text-sm text-muted-foreground">loading settings…</p>
          )}
        </CardContent>
      </Card>

      <div className="reveal-3 overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                started
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                kind
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                status
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                id
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.data?.runs.map((run) => (
              <TableRow key={run.id} className="group">
                <TableCell className="font-mono text-xs tabular-nums">
                  {new Date(run.createdAt).toLocaleString("en-US")}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {run.kind}
                </TableCell>
                <TableCell>
                  <StatusChip status={run.status} />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/scans/${run.id}`}
                    className="font-mono text-xs text-muted-foreground group-hover:text-primary hover:underline"
                  >
                    {run.id.slice(0, 8)}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {history.data && history.data.runs.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  No scans yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
