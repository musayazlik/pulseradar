import { cn } from "@/lib/utils";

/**
 * Semantik durum çipi: renk tek başına anlam taşımaz; metin her zaman var.
 * Küçük harf · mono · geniş harf aralığı ile konsol okuması sağlar.
 */
const STATUS_MAP: Record<string, { label: string; className: string; live?: boolean }> = {
  // etkinlik
  upcoming: { label: "yaklaşan", className: "text-primary border-primary/40 bg-primary/10" },
  ongoing: { label: "devam ediyor", className: "text-cyan-300 border-cyan-300/40 bg-cyan-300/10", live: true },
  expired: { label: "geçmiş", className: "text-muted-foreground border-border bg-muted" },
  needs_review: { label: "incelenecek", className: "text-amber-300 border-amber-300/40 bg-amber-300/10" },
  rejected: { label: "reddedildi", className: "text-red-300 border-red-300/40 bg-red-300/10" },
  // tarama işi
  queued: { label: "kuyrukta", className: "text-cyan-300 border-cyan-300/40 bg-cyan-300/10" },
  running: { label: "çalışıyor", className: "text-primary border-primary/40 bg-primary/10", live: true },
  completed: { label: "tamam", className: "text-primary border-primary/40 bg-primary/10" },
  partial: { label: "kısmi", className: "text-amber-300 border-amber-300/40 bg-amber-300/10" },
  failed: { label: "hata", className: "text-red-300 border-red-300/40 bg-red-300/10" },
  cancelled: { label: "iptal", className: "text-muted-foreground border-border bg-muted" },
  interrupted: { label: "kesildi", className: "text-red-300 border-red-300/40 bg-red-300/10" },
  skipped: { label: "atlandı", className: "text-muted-foreground border-border bg-muted" },
  // oturum
  ready: { label: "hazır", className: "text-primary border-primary/40 bg-primary/10", live: true },
  login_required: { label: "giriş gerek", className: "text-amber-300 border-amber-300/40 bg-amber-300/10" },
  challenge: { label: "challenge", className: "text-amber-300 border-amber-300/40 bg-amber-300/10" },
  unsupported: { label: "desteklenmiyor", className: "text-muted-foreground border-border bg-muted" },
  error: { label: "hata", className: "text-red-300 border-red-300/40 bg-red-300/10" },
  unknown: { label: "bilinmiyor", className: "text-muted-foreground border-border bg-muted" },
};

export function StatusChip({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const meta = STATUS_MAP[status] ?? STATUS_MAP.unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider",
        meta.className,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full bg-current",
          meta.live && "signal-dot",
        )}
      />
      {meta.label}
    </span>
  );
}
