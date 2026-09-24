# tests/

- `fixtures/` — sample raw data for parser tests.
- `parsers/` — date/location/event/url parser tests.
- `dedup/` — duplicate decisions and DB-integrated ingest tests.
- `jobs/` — queue claiming, heartbeat and recovery tests (filled in Phase 6).
- `e2e/` — Playwright acceptance scenarios (live browser verification, Phase 3+).

Live browser tests are not marked "done" until verified on the user's MacBook.
