"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarRange,
  Cable,
  LayoutDashboard,
  Radar,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { RadarMark } from "@/components/radar-mark";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: CalendarRange },
  { href: "/scans", label: "Scans", icon: Radar },
  { href: "/connections", label: "Connections", icon: Cable },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
] as const;

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-sm border px-3 py-2 text-sm transition-colors duration-200",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
      {active && (
        <span aria-hidden className="ml-auto size-1.5 rounded-full bg-primary signal-dot" />
      )}
    </Link>
  );
}

function WorkerPill() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 5000,
  });
  const active = health.data?.worker.active ?? false;
  return (
    <div className="flex items-center gap-2 rounded-sm border bg-card px-2.5 py-2">
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-primary signal-dot" : "bg-muted-foreground/50",
        )}
      />
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        worker · {active ? "active" : "standby"}
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh">
      {/* ——— Sidebar (≥lg) ——— */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex">
        <Link href="/" className="mb-8 flex cursor-pointer items-center gap-3 px-1">
          <RadarMark size={38} />
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-semibold tracking-wide">
              EVENT
            </span>
            <span className="block font-mono text-[11px] uppercase tracking-[0.3em] text-primary">
              radar
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <WorkerPill />
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            Local app — all data stays on this machine.
          </p>
        </div>
      </aside>

      {/* ——— Main column ——— */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" className="flex cursor-pointer items-center gap-2">
            <RadarMark size={26} />
            <span className="font-display text-sm font-semibold tracking-wide">
              EVENT RADAR
            </span>
          </Link>
        </header>
        <nav
          aria-label="Main navigation"
          className="flex gap-1 overflow-x-auto border-b px-3 py-2 lg:hidden"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>

        <footer className="border-t px-4 py-3 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          local station · the signal stays on this machine
        </footer>
      </div>
    </div>
  );
}
