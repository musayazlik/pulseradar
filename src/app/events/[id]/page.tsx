"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { StatusChip } from "@/components/status-chip";
import { api } from "@/lib/api";

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <EventDetailContent id={id} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function EventDetailContent({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["event", id], queryFn: () => api.event(id) });

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [registrationUrl, setRegistrationUrl] = useState("");
  const [description, setDescription] = useState("");

  if (query.isLoading) return <p className="font-mono text-sm text-muted-foreground">yükleniyor…</p>;
  if (query.isError) return <p className="text-sm text-destructive">{(query.error as Error).message}</p>;
  const event = query.data!;

  const startEditing = () => {
    setTitle(event.title);
    setCity(event.city ?? "");
    setStartDate(event.startDate ?? "");
    setOrganizer(event.organizer ?? "");
    setRegistrationUrl(event.registrationUrl ?? "");
    setDescription(event.description ?? "");
    setEditing(true);
  };

  const save = async () => {
    try {
      await api.patchEvent(id, {
        title,
        city: city || null,
        startDate: startDate || null,
        organizer: organizer || null,
        registrationUrl: registrationUrl || null,
        description: description || null,
      });
      toast.success("Etkinlik güncellendi; bu alanlar taramalarda ezilmez.");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["event", id] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const reject = async () => {
    try {
      await api.patchEvent(id, { status: "rejected" });
      toast.success("Etkinlik reddedildi.");
      await queryClient.invalidateQueries({ queryKey: ["event", id] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="reveal">
        <Link href="/events" className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline">
          ← etkinlikler
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {event.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
              <StatusChip status={event.status} />
              <span className="tabular-nums">
                {event.startDate ?? "tarih belirsiz"}
                {event.startTime ? ` · ${event.startTime}` : ""}
              </span>
              {event.city && <span>· {event.city}</span>}
              {event.attendanceMode !== "unknown" && <span>· {event.attendanceMode}</span>}
              <span>· güven {event.confidence}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {!editing && (
              <Button size="sm" variant="outline" onClick={startEditing}>
                Düzelt
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={reject}>
              Reddet
            </Button>
          </div>
        </div>
      </div>

      {editing ? (
        <Card className="reveal-2">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              alanları düzelt
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ev-title">Başlık</Label>
              <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Başlangıç tarihi (YYYY-AA-GG)</Label>
              <Input id="ev-date" className="font-mono" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-city">Şehir</Label>
              <Input id="ev-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-org">Organizatör</Label>
              <Input id="ev-org" value={organizer} onChange={(e) => setOrganizer(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-url">Kayıt bağlantısı</Label>
              <Input id="ev-url" className="font-mono text-xs" value={registrationUrl} onChange={(e) => setRegistrationUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ev-desc">Açıklama</Label>
              <Textarea id="ev-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save}>Kaydet</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Vazgeç</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="reveal-2">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              bilgiler
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label="bitiş">{event.endDate ?? "—"}</Field>
            <Field label="mekân">{event.venue ?? "—"}</Field>
            <Field label="organizatör">{event.organizer ?? "—"}</Field>
            <Field label="kayıt">
              {event.registrationUrl ? (
                <a
                  href={event.registrationUrl}
                  className="font-mono text-xs text-primary hover:underline"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {event.registrationUrl}
                </a>
              ) : (
                "Bulunamadı"
              )}
            </Field>
            {event.description && (
              <p className="text-sm leading-relaxed text-muted-foreground sm:col-span-2">
                {event.description}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="reveal-3">
        <CardHeader>
          <CardTitle className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            kaynak paylaşımlar · {event.sources.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {event.sources.length === 0 && (
            <p className="text-sm text-muted-foreground">Kaynak yok.</p>
          )}
          {event.sources.map((source) => (
            <div key={source.postId} className="rounded-md border bg-background/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {source.platform}
                  </span>
                  {source.accountName && (
                    <span className="text-sm text-muted-foreground">{source.accountName}</span>
                  )}
                  <a
                    href={source.canonicalUrl}
                    className="font-mono text-xs text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    orijinal paylaşım ↗
                  </a>
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {source.publishedAt ?? "tarih yok"}
                </span>
              </div>
              {source.evidenceJson && (
                <>
                  <Separator className="my-2.5" />
                  <p className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                    <span className="text-primary">kanıt ›</span> {source.evidenceJson}
                  </p>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
