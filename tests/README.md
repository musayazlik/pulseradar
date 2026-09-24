# tests/

- `fixtures/` — parser testleri için örnek ham veriler.
- `parsers/` — date/location/event/url parser testleri.
- `dedup/` — duplicate kararları ve DB entegre ingest testleri.
- `jobs/` — kuyruk sahiplenme, heartbeat, kurtarma testleri (Aşama 6'da dolacak).
- `e2e/` — Playwright kabul senaryoları (canlı tarayıcı doğrulaması, Aşama 3+).

Canlı tarayıcı testleri kullanıcı MakBook'unda doğrulanmadan "tamamlandı" işaretlenmez.
