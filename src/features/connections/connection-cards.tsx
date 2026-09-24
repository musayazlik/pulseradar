"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, type ConnectionInfo } from "@/lib/api";
import { StatusChip } from "@/components/status-chip";

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
};

const PLATFORM_GLYPH: Record<string, string> = {
  linkedin: "in",
  x: "𝕏",
  instagram: "ig",
  tiktok: "tt",
};

function ConnectionCard({ connection }: { connection: ConnectionInfo }) {
  const queryClient = useQueryClient();

  const check = async () => {
    try {
      await api.checkConnections([connection.platform]);
      toast.success("Kontrol işi kuyruğa alındı; worker çalışıyorsa sonuç kısa sürede gelir.");
      await queryClient.invalidateQueries({ queryKey: ["connections"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const open = async () => {
    try {
      await api.openConnection(connection.platform);
      toast.info("Giriş ekranı worker tarafından açılıyor; tarayıcı penceresine bakın.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const disabled = connection.platform === "instagram" || connection.platform === "tiktok";

  return (
    <Card className={disabled ? "opacity-60" : undefined}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid size-10 place-items-center rounded-sm border border-border bg-muted font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {PLATFORM_GLYPH[connection.platform]}
            </span>
            <div>
              <p className="font-display font-semibold">
                {PLATFORM_LABELS[connection.platform] ?? connection.platform}
              </p>
              {disabled && (
                <p className="font-mono text-[11px] text-muted-foreground">ikinci aşama</p>
              )}
            </div>
          </div>
          <StatusChip status={connection.status} />
        </div>

        <p className="mt-3 min-h-8 text-xs leading-relaxed text-muted-foreground">
          {connection.detail ?? "Henüz kontrol edilmedi."}
        </p>
        {connection.checkedAt && (
          <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
            son kontrol: {new Date(connection.checkedAt).toLocaleString("tr-TR")}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" onClick={check} disabled={disabled}>
            Oturumu kontrol et
          </Button>
          <Button size="sm" variant="ghost" onClick={open} disabled={disabled}>
            Giriş ekranını aç
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ConnectionCards() {
  const query = useQuery({
    queryKey: ["connections"],
    queryFn: api.connections,
    refetchInterval: 4000,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(query.data?.connections ?? []).map((connection) => (
        <ConnectionCard key={connection.platform} connection={connection} />
      ))}
    </div>
  );
}
