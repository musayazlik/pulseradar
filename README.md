# Etkinlik Radarı

MacBook'ta çalışan kişisel etkinlik keşif uygulaması. Next.js paneli, API katmanı,
CLI ve worker aynı TypeScript tiplerini paylaşır; tüm veri ve tarayıcı oturumu
bilgisayarda kalır. Mimari kararlar için `etkinlik-radari-nextjs-mimari.md`
belgesine bakın.

## Kurulum

```bash
npm install
npm run db:migrate   # veri dizininde şemayı oluşturur
npm run doctor       # ortam kontrolü
```

Veri köğü: `~/Library/Application Support/EventRadar/`
(`EVENT_RADAR_DATA_DIR` ile değiştirilebilir, bkz. `.env.example`).

## Çalıştırma

```bash
npm run dev      # Next.js paneli + tek worker birlikte
npm run start    # production paneli + worker birlikte
npm run worker   # yalnızca worker (ayrı terminal)
```

Panel `http://127.0.0.1:3000` adresinde yayınlanır; MVP internete açılmaz.

## CLI

```bash
npm run search -- --platform=linkedin
npm run search -- --platform=x --city=istanbul --keyword=startup --days=14
npm run search -- --hashtag=hackathon
npm run events -- --city=eskisehir
npm run doctor
```

`--platform=twitter` değeri `x` için alias kabul edilir. Mevcut worker yoksa
`search` tek seferlik worker'ı profil kilidiyle başlatır.

## Komutlar

| Komut | İşlev |
| --- | --- |
| `npm run dev` / `start` | Panel + worker koordinatörü |
| `npm run worker` | Tek başına worker |
| `npm run doctor` | Node/Chrome/DB/config/kilit/worker kontrolü |
| `npm run search` | Tarama kuyruğa alma + ilerleme izleme |
| `npm run events` | Etkinlikleri listeleme |
| `npm run db:generate` | Drizzle migration üretme |
| `npm run db:migrate` | Şemayı veri dizinine uygula |
| `npm test` | Vitest (parser/dedup) |

## Durum

Aşama 1 tamamlandı: panel ekranları, API uçları, SQLite şeması/migration,
worker kuyruğu (atomik sahiplenme + heartbeat + kurtarma), profil kilidi ve CLI
iskeleti. LinkedIn/X adapter'ları ile gerçek arama (Aşama 3-5) henüz bağlı değil;
görevler `not_implemented` olarak atlanır. Instagram/TikTok ikinci aşamadadır.
