"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusChip } from "@/components/status-chip";
import { api } from "@/lib/api";
import type { EventStatus } from "@/core/types/event";

export function EventsTable({ initialStatus }: { initialStatus?: string }) {
  const [status, setStatus] = useState<string>(initialStatus ?? "upcoming,needs_review");
  const [city, setCity] = useState("");

  const params = new URLSearchParams();
  if (status) status.split(",").forEach((s) => params.append("status", s));
  if (city.trim()) params.set("city", city.trim());
  params.set("limit", "200");

  const query = useQuery({
    queryKey: ["events", params.toString()],
    queryFn: () => api.events(params.toString()),
  });

  return (
    <div className="space-y-4">
      {/* filtre çubuğu */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3">
        <div className="space-y-1">
          <Label htmlFor="status-filter" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            durum
          </Label>
          <Select value={status} onValueChange={(value) => setStatus(value ?? "")}>
            <SelectTrigger className="w-48 font-mono text-xs" id="status-filter">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming,needs_review">yaklaşan + inceleme</SelectItem>
              <SelectItem value="upcoming">yaklaşan</SelectItem>
              <SelectItem value="needs_review">incelenecek</SelectItem>
              <SelectItem value="expired">geçmiş</SelectItem>
              <SelectItem value="rejected">reddedilenler</SelectItem>
              <SelectItem value="">tümü</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="city-filter" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            şehir
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="city-filter"
              placeholder="örn. istanbul"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-44 pl-8 font-mono text-xs"
            />
          </div>
        </div>
        <span aria-live="polite" className="ml-auto pb-2 font-mono text-xs text-muted-foreground">
          {query.isFetching ? "tarıyor…" : `${query.data?.count ?? 0} kayıt`}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                tarih
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                başlık
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                yer
              </TableHead>
              <TableHead className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:table-cell">
                organizatör
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                kaynak
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                durum
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data?.events.map((event) => (
              <TableRow key={event.id} className="group">
                <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                  {event.startDate ?? "belirsiz"}
                  {event.startTime ? ` ${event.startTime}` : ""}
                </TableCell>
                <TableCell className="max-w-72">
                  <Link
                    href={`/events/${event.id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {event.title}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {event.attendanceMode === "online" ? "online" : (event.city ?? "—")}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {event.organizer ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {event.platforms.map((p) => (
                      <span
                        key={p}
                        className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusChip status={event.status} />
                </TableCell>
              </TableRow>
            ))}
            {query.data && query.data.events.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Radar bu filtrede kayıt bulamadı.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
