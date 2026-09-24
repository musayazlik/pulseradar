"use client";

import { ConnectionCards } from "@/features/connections/connection-cards";

export default function ConnectionsPage() {
  return (
    <div className="space-y-6">
      <div className="reveal">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">session line</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Chrome mode, profile status and platform sessions. Passwords are never
          entered into the app; sign-in happens in the browser window and the
          profile keeps it.
        </p>
      </div>
      <div className="reveal-2">
        <ConnectionCards />
      </div>
    </div>
  );
}
