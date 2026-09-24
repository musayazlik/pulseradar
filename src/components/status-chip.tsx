import { cn } from "@/lib/utils";

/**
 * Semantic status chip: color alone never carries meaning; the label is
 * always present. Lowercase · mono · wide letter spacing keeps the console
 * reading style.
 */
const STATUS_MAP: Record<string, { label: string; className: string; live?: boolean }> = {
  // event
  upcoming: { label: "upcoming", className: "text-primary border-primary/40 bg-primary/10" },
  ongoing: { label: "ongoing", className: "text-cyan-300 border-cyan-300/40 bg-cyan-300/10", live: true },
  expired: { label: "past", className: "text-muted-foreground border-border bg-muted" },
  needs_review: { label: "needs review", className: "text-amber-300 border-amber-300/40 bg-amber-300/10" },
  rejected: { label: "rejected", className: "text-red-300 border-red-300/40 bg-red-300/10" },
  // scan job
  queued: { label: "queued", className: "text-cyan-300 border-cyan-300/40 bg-cyan-300/10" },
  running: { label: "running", className: "text-primary border-primary/40 bg-primary/10", live: true },
  completed: { label: "done", className: "text-primary border-primary/40 bg-primary/10" },
  partial: { label: "partial", className: "text-amber-300 border-amber-300/40 bg-amber-300/10" },
  failed: { label: "failed", className: "text-red-300 border-red-300/40 bg-red-300/10" },
  cancelled: { label: "cancelled", className: "text-muted-foreground border-border bg-muted" },
  interrupted: { label: "interrupted", className: "text-red-300 border-red-300/40 bg-red-300/10" },
  skipped: { label: "skipped", className: "text-muted-foreground border-border bg-muted" },
  // session
  ready: { label: "ready", className: "text-primary border-primary/40 bg-primary/10", live: true },
  login_required: { label: "login required", className: "text-amber-300 border-amber-300/40 bg-amber-300/10" },
  challenge: { label: "challenge", className: "text-amber-300 border-amber-300/40 bg-amber-300/10" },
  unsupported: { label: "unsupported", className: "text-muted-foreground border-border bg-muted" },
  error: { label: "error", className: "text-red-300 border-red-300/40 bg-red-300/10" },
  unknown: { label: "unknown", className: "text-muted-foreground border-border bg-muted" },
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
