"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EventsTable } from "@/features/events/events-table";

export default function EventsPage() {
  return (
    <div className="space-y-6">
      <div className="reveal">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">keşif kayıtları</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Etkinlikler</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gelecek tarihe göre sıralı; geçmiş kayıtlar ayrı filtrede
        </p>
      </div>
      <div className="reveal-2">
        <Suspense>
          <EventsTableWithParams />
        </Suspense>
      </div>
    </div>
  );
}

function EventsTableWithParams() {
  const params = useSearchParams();
  return <EventsTable initialStatus={params.get("status") ?? undefined} />;
}
