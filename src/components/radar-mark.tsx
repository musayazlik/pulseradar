import { cn } from "@/lib/utils";

/**
 * Radar mark: console logo with a rotating scan beam. Pure CSS; the beam
 * spins unless prefers-reduced-motion is set.
 */
export function RadarMark({
  size = 40,
  active = true,
  className,
}: {
  size?: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "radar-scope relative inline-grid shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/5",
        className,
      )}
    >
      {active && <span className="radar-scope absolute inset-0 rounded-full" />}
      {/* rings */}
      <span className="absolute inset-[18%] rounded-full border border-primary/25" />
      <span className="absolute inset-[38%] rounded-full border border-primary/25" />
      {/* center + target dot */}
      <span className="relative size-1 rounded-full bg-primary phosphor-ring" />
      <span className="absolute left-[30%] top-[26%] size-1 rounded-full bg-primary/90" />
    </span>
  );
}
