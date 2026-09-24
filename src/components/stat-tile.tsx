import { cn } from "@/lib/utils";

/**
 * Konsol okuma karo: mono Büyük harf etiket + büyük tabular sayı.
 */
export function StatTile({
  label,
  value,
  hint,
  accent,
  className,
  children,
}: {
  label: string;
  value?: string | number;
  hint?: string;
  accent?: "primary" | "amber" | "muted";
  className?: string;
  children?: React.ReactNode;
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-300"
      : accent === "muted"
        ? "text-muted-foreground"
        : "text-primary";
  return (
    <div
      className={cn(
        "relative rounded-md border bg-card p-4",
        className,
      )}
    >
      {/* köşe imi: konsol paneli hissi */}
      <span
        aria-hidden
        className="absolute right-0 top-0 h-2 w-2 border-b border-r border-primary/30"
      />
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      {value !== undefined && (
        <p className={cn("mt-2 font-display text-2xl font-semibold tabular-nums", accentClass)}>
          {value}
        </p>
      )}
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
