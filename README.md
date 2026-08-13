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

## Features

- **Projects** — a project switcher; each project is fully isolated (own
  database, own PIN/recovery, own auto-lock) instead of the single implicit
  workspace the legacy app had.
- **Transcripts** — folders, an editor with in-vivo text-selection coding,
  audio upload/playback with timecode bookmarks, memos, and an activity log.
- **Codebook** — aggregated code/category usage across transcripts,
  artifacts, and observations, with inline definitions, global cascading
  rename/merge, source filtering with saved presets, and CSV export.
- **Project Artifacts** — a folder-organized document/image library with
  preview, notes, and flat code tagging.
- **Onsite Observations** — the same in-vivo coding engine as Transcripts,
  reused rather than duplicated.
- **Participant Vault** — pseudonym records and consent-form storage behind
  its own separate password.
- **Analysis Canvas** — cluster in-vivo codes into categories (Step 2), then
  categories into themes (Step 3).
- **Connecting Analysis** — a guided pairwise prompt for how categories
  relate, a clickable matrix, an optional per-category narrative table, and
  a force-directed relational map where more-connected categories cluster
  visibly apart from unrelated ones. Clicking a category fades everything
  outside its connected cluster and opens a popup to name and explain that
  cluster as a theme, saved into a Themes section shared with Step 3's
  Thematic Analysis.
- **Triangulation** — export a blinded copy of a project for a second coder,
  import their return package, and see heuristic overlap-agreement stats.
- **Backup & Restore** — encrypted, password-protected, project-scoped
  snapshots (current format), plus a decoder for every `.qbk` format the
  legacy app ever wrote so old backups always import.
- **Rich text + Word export** — bold and interviewer-tag formatting in the
  editor, drag-and-drop clustering in the Analysis Canvas, APA-formatted
  Word (.doc) export everywhere CSV export exists, and audio compression
  on upload — see "Reincorporated features" below for how each of these
  was rebuilt with the original design risk addressed.

## Architecture

- `src/storage/` — IndexedDB (via Dexie). Each **project** is a fully
  isolated database (`qualiapp_project_<id>`), with its own PIN/recovery
  question and auto-lock setting. A separate `qualiapp_registry` database
  just lists projects.
- `src/backup/`
  - `legacyFormat.ts` decodes every `.qbk` format the old app ever wrote
    (v1–v4, QBK5, QBK6) — decode-only, kept working forever so old backups
    always import.
  - `importLegacy.ts` imports a legacy backup as a **new** project (old
    backups predate the project concept) and normalizes fields the legacy
    format didn't have (e.g. audio bookmarks) so nothing crashes on import.
  - `format.ts` is the current export format (`.qbk2`): an encrypted,
    project-scoped snapshot, restored in place within the same project.
- `src/features/` — one directory per feature area: `projects/`,
  `workspace/` (shared project store, folder/codebook actions, source
  filtering), `coding/` (the shared in-vivo coding engine used by both
  Transcripts and Observations), `transcripts/`, `observations/`,
  `participants/`, `artifacts/`, `codebook/`, `analysis/`, `triangulation/`.
- `src/ui/` — shared design-system components (Tailwind-based).

Production builds are bundled by `vite-plugin-singlefile` into one
self-contained `dist/index.html` — no server, no install.

## Deliberate differences from the legacy app

- **Per-code colors** in coded-text highlighting (the legacy app highlighted
  every code the same flat teal); overlapping highlights render as a
  visible gradient instead of silently failing to render.
- **Importing a triangulation assignment package creates a new project**
  instead of destructively overwriting whatever workspace happened to be
  open — this app has real multi-project isolation, so there's no reason to
  keep that footgun.
- **No file-optimization migration pass.** The legacy app had a one-time
  background job to compress already-stored files, needed only because
  uploads weren't compressed yet when it was built. This app compresses
  files at upload time from the start (see "Reincorporated features"
  below), so that migration has nothing to do and isn't ported.
- Audio timecodes are a discrete bookmark list rather than inline HTML
  spans in the transcript body — the one piece of legacy rich-text behavior
  not brought back, since it was the actual source of the legacy app's
  HTML/offset sync fragility (see below).

## Reincorporated features

Four things were initially simplified or cut during the rewrite, then
deliberately rebuilt after weighing the trade-off explicitly:

- **Rich text editing** (`src/features/coding/RichTextEditor.tsx`) — Bold
  and "Tag Interviewer" formatting in the Transcript/Observation editor.
  Both only ever wrap already-selected text (never insert/delete
  characters), so the plain-text mirror used for in-vivo coding offsets
  stays exactly consistent with what's displayed — Code mode never needs
  to know formatting exists. Timecode bookmarks deliberately stay a
  separate list rather than inline spans, since interleaving those with
  formatting spans in the same HTML blob was the actual source of the
  legacy app's offset fragility.
- **Drag-and-drop** (`src/features/analysis/AssignmentBoard.tsx`) — added
  alongside the dropdown (not replacing it) in the Analysis Canvas, for
  clustering codes into categories and categories into themes.
- **APA-formatted Word (.doc) export** (`src/features/workspace/docExport.ts`)
  — wired in everywhere CSV export already exists: Codebook, Analysis
  Canvas, Connecting Analysis (including the relational map as an embedded,
  rasterized figure), and Triangulation.
- **Audio compression on upload** (`src/features/coding/audioCompression.ts`)
  — re-encodes to Opus/WebM via MediaRecorder capturing a live AudioContext
  playback, always in the background so a long recording never blocks the
  UI on encoding (compression runs in real time — a 45-minute interview
  takes about 45 minutes to compress — which is exactly why it's
  backgrounded rather than synchronous). Falls back to the original file on
  any failure.
