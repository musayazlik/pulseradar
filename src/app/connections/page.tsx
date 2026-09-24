"use client";

import { ConnectionCards } from "@/features/connections/connection-cards";

export default function ConnectionsPage() {
  return (
    <div className="space-y-6">
      <div className="reveal">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">oturum hattı</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Bağlantılar</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Chrome modu, profil durumu ve platform oturumları. Şifreler uygulamaya
          girilmez; giriş tarayıcı penceresinde yapılır ve profil saklanır.
        </p>
      </div>
      <div className="reveal-2">
        <ConnectionCards />
      </div>
    </div>
  );
}
