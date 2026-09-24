"use client";

import { use } from "react";
import Link from "next/link";
import { ScanProgress } from "@/features/scans/scan-progress";

export default function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="space-y-6">
      <div className="reveal">
        <Link href="/scans" className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline">
          ← scans
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Scan detail</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{id}</p>
      </div>
      <ScanProgress runId={id} />
    </div>
  );
}
