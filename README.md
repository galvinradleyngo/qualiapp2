# QualiApp 2

A ground-up rewrite of QualiApp — a qualitative research tool for coding
transcripts, running analysis boards, triangulation, and observations — as a
typed, tested, modular codebase.

## Why a rewrite

The original app (`qualiapp`) is a single 5MB/13k-line `index.html` with no
build step, no types, and no tests. This repo replaces it entirely: same
zero-install, offline, double-click-to-open experience for end users, but
built from a normal source tree with CI.

## Using the app

No installation needed. Download the built `index.html` from the latest
[Release](../../releases) (or a CI run's artifacts) and open it in a modern
browser (Chrome, Edge, or Firefox — offline, no server required).

## Development

```sh
npm install
npm run dev        # local dev server
npm test           # vitest
npm run typecheck
npm run lint
npm run build       # produces dist/index.html — the entire shippable app
```

## Architecture

- `src/storage/` — IndexedDB (via Dexie). Each **project** is a fully
  isolated database (`qualiapp_project_<id>`), with its own PIN/recovery
  question. A separate `qualiapp_registry` database just lists projects.
- `src/backup/` — backup import/export.
  - `legacyFormat.ts` decodes every `.qbk` format the old app ever wrote
    (v1–v4, QBK5, QBK6). This must keep working forever so old backups
    always import — it's decode-only, no new export uses these formats.
  - `importLegacy.ts` imports a legacy backup as a **new** project (old
    backups predate the project concept, so you're always asked for a
    project title; imports never merge into or overwrite an existing
    project).
- `src/features/` — one directory per feature area (`projects/` today;
  `editor/`, `analysis/`, `connecting/`, `codebook/`, `triangulation/`,
  `observations/`, `participants/` follow in later phases).
- `src/ui/` — shared design-system components.

Production builds are bundled by `vite-plugin-singlefile` into one
self-contained `dist/index.html` — no server, no install.
