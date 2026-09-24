# Event Radar

A personal event-discovery app that runs on a MacBook. The Next.js panel, the
API layer, the CLI and the worker all share the same TypeScript types; all data
and browser sessions stay on your machine. See `architecture.md` for the
architecture decisions.

## Setup

```bash
npm install
npm run db:migrate   # creates the schema in the data directory
npm run doctor       # environment check
```

Data root: `~/Library/Application Support/EventRadar/`
(override with `EVENT_RADAR_DATA_DIR`, see `.env.example`).

## Running

```bash
npm run dev      # Next.js panel + single worker together
npm run start    # production panel + worker together
npm run worker   # worker only (separate terminal)
```

The panel is served at `http://127.0.0.1:3000`; the MVP is not exposed to the
internet.

## CLI

```bash
npm run search -- --platform=linkedin
npm run search -- --platform=x --city=istanbul --keyword=startup --days=14
npm run search -- --hashtag=hackathon
npm run events -- --city=eskisehir
npm run doctor
```

`--platform=twitter` is accepted as an alias for `x`. If no worker is running,
`search` starts a one-shot worker guarded by the profile lock.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` / `start` | Panel + worker coordinator |
| `npm run worker` | Standalone worker |
| `npm run doctor` | Node/Chrome/DB/config/lock/worker check |
| `npm run search` | Queue scans + follow progress |
| `npm run events` | List events |
| `npm run db:generate` | Generate a Drizzle migration |
| `npm run db:migrate` | Apply the schema to the data directory |
| `npm test` | Vitest (parsers/dedup) |

## Status

Phase 1 is complete: panel screens, API endpoints, SQLite schema/migration,
worker queue (atomic claiming + heartbeat + recovery), profile lock and the
CLI skeleton. Real search with the LinkedIn/X adapters (Phases 3-5) is wired
in for LinkedIn and X; unsupported jobs are skipped as `not_implemented`.
Instagram/TikTok are stubs for a later phase.
