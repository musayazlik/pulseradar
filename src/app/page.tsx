"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarPlus, ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/stat-tile";
import { RadarMark } from "@/components/radar-mark";
import { StatusChip } from "@/components/status-chip";
import { api } from "@/lib/api";

export default function OverviewPage() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 5000 });
  const upcoming = useQuery({ queryKey: ["events", "overview"], queryFn: () => api.events("status=upcoming&limit=6") });
  const review = useQuery({ queryKey: ["events", "review"], queryFn: () => api.events("status=needs_review&limit=200") });
  const scans = useQuery({ queryKey: ["scans"], queryFn: api.scans });

  const lastScan = scans.data?.runs.find((r) => r.kind === "scan");
  const workerActive = health.data?.worker.active ?? false;

  return (
    <div className="space-y-6">
      {/* ——— Radar hero ——— */}
      <section className="reveal radar-grid relative overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">
              kişisel keşif istasyonu
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Etkinlik <span className="text-primary phosphor-glow">Radarı</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              LinkedIn ve X'i tarar; Türkiye'deki yazılım, girişim ve yapay zekâ
              etkinliklerini kaynaklarıyla birlikte toplar. Tüm veri bu
              bilgisayarda kalır.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/scans" className={buttonVariants({ size: "lg" })}>
                <CalendarPlus className="size-4" />
                Yeni tarama başlat
              </Link>
              <Link
                href="/events"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Etkinlikleri gör
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* canlı radar göstergesi */}
          <div className="flex items-center gap-5 sm:flex-col sm:items-end">
            <div className="relative">
              <RadarMark size={120} active={workerActive} />
            </div>
            <div className="text-left sm:text-right">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                istasyon durumu
              </p>
              <p
                className={`font-display text-lg font-semibold tracking-wide ${
                  workerActive ? "text-primary phosphor-glow" : "text-muted-foreground"
                }`}
              >
                {health.isLoading ? "—" : workerActive ? "TARANIYOR" : "BEKLEMEDE"}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                mod: {health.data?.browserMode ?? "—"} · db {health.data?.database.ok ? "hazır" : "hata"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ——— Okuma karoları ——— */}
      <section className="reveal-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="yaklaşan etkinlik" value={upcoming.data?.count ?? "…"} />
        <StatTile label="incelenecek" value={review.data?.count ?? "…"} accent="amber" />
        <StatTile label="son tarama" accent="muted">
          {lastScan ? (
            <>
              <p className="mt-2">
                <StatusChip status={lastScan.status} />
              </p>
              <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
                {lastScan.counters.eventsCreated} etkinlik · {lastScan.counters.uniquePostsScanned} paylaşım
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">henüz yok</p>
          )}
        </StatTile>
        <StatTile label="worker" accent={workerActive ? "primary" : "muted"}>
          <p className="mt-2 font-display text-lg font-semibold">
            {health.isLoading ? "…" : workerActive ? "aktif" : "beklemede"}
          </p>
          <p className="mt-1.5 font-mono text-xs text-muted-foreground">
            {health.data?.worker.heartbeatAt
              ? `sinyal: ${new Date(health.data.worker.heartbeatAt).toLocaleTimeString("tr-TR")}`
              : "sinyal yok"}
          </p>
        </StatTile>
      </section>

      {/* ——— Listeler ——— */}
      <section className="reveal-3 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              yaklaşan etkinlikler
            </CardTitle>
            <Link
              href="/events"
              className="cursor-pointer font-mono text-xs text-primary hover:underline"
            >
              tümü →
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {upcoming.data?.events.length ? (
              <ul className="divide-y divide-border">
                {upcoming.data.events.map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/events/${event.id}`}
                      className="group flex cursor-pointer items-center gap-4 py-3 transition-colors hover:bg-accent/50"
                    >
                      <span className="w-20 shrink-0 text-center">
                        <span className="block font-display text-lg font-semibold leading-none tabular-nums">
                          {event.startDate ? event.startDate.slice(8, 10) : "—"}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {event.startDate
                            ? new Date(event.startDate + "T00:00:00Z").toLocaleDateString("tr-TR", { month: "short", timeZone: "UTC" })
                            : "?"}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium group-hover:text-primary">
                          {event.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {event.city ?? (event.attendanceMode === "online" ? "online" : "yer belirsiz")}
                          {event.startTime ? ` · ${event.startTime}` : ""}
                        </span>
                      </span>
                      <span className="hidden shrink-0 gap-1 sm:flex">
                        {event.platforms.map((p) => (
                          <span
                            key={p}
                            className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                          >
                            {p}
                          </span>
                        ))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Henüz yaklaşan etkinlik yok —{" "}
                <Link href="/scans" className="text-primary hover:underline">
                  ilk taramayı başlat
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              son taramalar
            </CardTitle>
            <Link
              href="/scans"
              className="cursor-pointer font-mono text-xs text-primary hover:underline"
            >
              tümü →
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {scans.data?.runs.length ? (
              <ul className="divide-y divide-border">
                {scans.data.runs.slice(0, 6).map((run) => (
                  <li key={run.id}>
                    <Link
                      href={`/scans/${run.id}`}
                      className="group flex cursor-pointer items-center justify-between gap-3 py-2.5 transition-colors hover:bg-accent/50"
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-xs text-muted-foreground group-hover:text-primary">
                          {run.id.slice(0, 8)} · {run.kind}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {new Date(run.createdAt).toLocaleString("tr-TR")}
                        </span>
                      </span>
                      <StatusChip status={run.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Tarama geçmişi boş.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
