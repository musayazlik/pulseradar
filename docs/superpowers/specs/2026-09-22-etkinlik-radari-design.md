# Etkinlik Radarı — MVP Tasarım Spesifikasyonu

**Tarih:** 2026-09-22
**Durum:** Kullanıcı onaylı
**Kaynak doküman:** `etkinlik-radari-nextjs-mimari.md` (ayrıntılı mimari ve geliştirme planı; bu spec onun bağlayıcı kararlarını ve onaylı uyarlamaları sabitler)

## 1. Amaç

MacBook üzerinde çalışan kişisel etkinlik keşif uygulaması. LinkedIn ve X paylaşımlarını Playwright + Chrome ile tarar, yazılım/girişimcilik etkinliklerini kural tabanlı çıkarır, SQLite'a kanıt bağlantılarıyla kaydeder. Tüm veri yerelde kalır; panel yalnızca `127.0.0.1` üzerinden sunulur.

## 2. Bağlayıcı mimari kararlar

| Katman | Seçim |
| --- | --- |
| Panel | Next.js App Router, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Form/doğrulama | React Hook Form, Zod |
| Canlı durum | TanStack Query, ~2 sn polling (yalnızca aktif taramada) |
| API | Route Handlers, Node.js runtime |
| Worker | Ayrı Node.js + TypeScript süreç (tsx) |
| Tarayıcı | Playwright, görünür Chrome; varsayılan `persistent`, opsiyonel `cdp` |
| DB | SQLite + Drizzle ORM + better-sqlite3 (WAL, foreign_keys, busy_timeout) |
| Log | Pino |
| Test | Vitest (parser/dedup), Playwright (e2e) |
| Paket yöneticisi | npm, lockfile ile sabit |
| Node | v22 (makinede 22.13.1 mevcut) |

`src/core` HTTP, React veya Next.js'e bağımlı olmaz. Tarayıcı/DB erişen modüller Client Component'lere import edilmez. İş mantığı route dosyalarında tekrarlanmaz; ortak servisler çağrılır.

## 3. Veri kökü ve güvenlik

- macOS veri kökü: `~/Library/Application Support/EventRadar/`
  - `browser-profile/`, `events.sqlite`, `logs/`, `search.json`
- Profil tek worker'a kilitli (`profile-lock`); çatışmada anlaşılır hata.
- CDP yalnızca loopback; worker sadece kendi açtığı sekmeleri/context'i kapatır.
- Cookie/session değerleri kod, log, API yanıtı veya export dosyasına yazılmaz.
- Değişiklik yapan API uçlarında Host/Origin kontrolü + yerel oturum/CSRF.
- Post metni veri kabul edilir; HTML olarak çalıştırılmaz; dış bağlantılar yalnızca `http`/`https`.

## 4. Veri modeli

Tablolar: `Event`, `SocialPost`, `EventSource`, `ScanRun`, `ScanTask`, `ScanObservation`, `ReviewItem` — alanlar ve unique kurallar kaynak doküman bölüm 5 ile birebir:

- `(platform, platformPostId)` ve `(platform, canonicalUrl)` unique; `EventSource(eventId, postId)` ve `ScanObservation(taskId, postId)` unique; başlık tek başına unique değil.
- `Event.status` (`upcoming/ongoing/expired/needs_review/rejected`) okuma anında güncel saate göre hesaplanır.
- Tarih/saat ayrı saklanır; saat bilinmiyorsa uydurulmaz; keşif/işlem zamanları UTC.
- `ScanRun.kind`: `scan | session_check | open_login`.

## 5. Adapter sözleşmesi

`src/core/types` altında `PlatformScanner` sözleşmesi (kaynak bölüm 6). Adapter kendi browser instance'ını açmaz; `ScannerContext` sayfa/context, limiter, logger, iptal sinyali taşır.

- **LinkedIn:** gerçek implementasyon; selector'lar canlı testte doğrulanacak şekilde `selectors.ts`'te toplanır, doğrulanana kadar `unverified` işaretli.
- **X (platform anahtarı `x`, `twitter` alias kabul edilir):** LinkedIn ile aynı yapı.
- **Instagram / TikTok (kullanıcı kararı):** stub + selector taslağı. Sözleşmeyi gerçekler, arama URL'si/selector adayları içerir ama `unverified` işaretlidir, UI'da seçilemez, registry'de `enabled: false`. Canlı test doğrulanınca aktifleşir.

Worker önce LinkedIn, sonra X görevlerini sırayla yürütür; bir platformun hatası kalanı durdurmaz (`partial` sonuç). "Sonuç yok" ile "DOM değişti" ayrı sonuçlardır.

## 6. Parser, dedup ve kuyruk

- Kural tabanlı `EventCandidate[]`; bulut LLM yok. Çoklu sinyal (meetup/konferans/kayıt açıldı/yer/tarih) gerekli; iş ilanı ve reklam ayırt edilir. Her çıkarımın kanıt metni saklanır; confidence kural puanıdır.
- Tarih kuralları (kaynak bölüm 7 tablosu): "yarın/bu cuma" çözümlemesi, yıl taşımaları, kayıt son tarihi ayrıştırması, aralık koruma; çözülemeyenler `needs_review`.
- Dedup (kaynak bölüm 8 tablosu): önce post tekilleştirme, sonra etkinlik eşleştirme; UTM temizliği; elle düzeltilen alanlar ezilmez; belirsizlik `ReviewItem`.
- Kuyruk: atomik sahiplenme + `heartbeatAt`/lease, recovery → `interrupted`, idempotent yeniden deneme, dokümandaki limit tablosu `search.json`'dan. İptal DB'ye yazılır, gezinme/scroll adımları arasında kontrol edilir.

## 7. API, CLI ve panel

API uçları kaynak bölüm 11 tablosu ile birebir (`POST /api/scans` → `202` + `runId`; `GET /api/health` DB/config/heartbeat döndürür).

CLI komutları: `dev`, `start`, `worker`, `doctor`, `search` (`--platform/--city/--keyword/--hashtag/--days`), `events`. `dev`/`start` Next.js + tek worker'ı koordine eder; `search` mevcut worker yoksa tek seferlik worker'ı profil kilidiyle başlatır.

Panel ekranları: Genel bakış, Etkinlikler (+detay), Yeni tarama (+detay), Bağlantılar, Ayarlar.

## 8. Uygulama sırası ve kabul ölçütleri

Kaynak bölüm 13 birebir, kullanıcı kararıyla:

1. Next.js iskeleti, sayfalar, ortak tipler, SQLite migration
2. Worker kuyruğu, profil yöneticisi, bağlantılar ekranı
3. LinkedIn adapter'ı (canlı test kullanıcıda; kod `unverified` işaretli teslim edilir)
4. Tarih/etkinlik parser'ı, kayıt ve dedup (Vitest ile)
5. X adapter'ı (aynı canlı test şartı)
6. Panel filtreleri, CLI, iptal ve kurtarma
7. Instagram, ardından TikTok — stub + unverified selector taslağı

Her aşama tamamlandıkça git commit. Canlı tarayıcı kabul testleri (aşama 3, 5) kullanıcının makinesinde; kullanıcı test etmeden o kısımlar "tamamlandı" işaretlenmez. Parser/dedup testleri kaynak bölüm 13'teki senaryoları kapsar (Türkçe ay adları, yıl sınırı, "yarın", kayıt son tarihi, aynı post içinde iki etkinlik vb.).

## 9. Kapsam dışı (ilk teslimatta)

OCR/video çözümleme, yerel LLM, zamanlanmış tarama, Instagram/TikTok canlı tarama, internete yayılma.

## 10. Ortam doğrulaması (2026-09-22)

- Node v22.13.1, npm 11.12.1 — mevcut.
- Google Chrome — `/Applications/Google Chrome.app` — mevcut.
- macOS (darwin), working dir `~/Projects/botsearch`.
