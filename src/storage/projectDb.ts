// Per-project storage. Each project gets its own Dexie database, fully
// isolated from every other project (separate IndexedDB database per id),
// with a `data` table for JSON-serializable state (keyed by field name,
// e.g. "transcripts", "tags") and a `files` table for binary blobs
// (audio, images, artifacts) — mirroring the legacy app's two-store
// layout so legacy backups map onto it directly.

import Dexie, { type Table } from 'dexie';

export interface DataRow {
  key: string;
  value: unknown;
}

export interface FileRow {
  key: string;
  blob: Blob;
  type: string;
  name: string | null;
  lastModified: number | null;
}

export class ProjectDB extends Dexie {
  data!: Table<DataRow, string>;
  files!: Table<FileRow, string>;

  constructor(public readonly projectId: string) {
    super(`qualiapp_project_${projectId}`);
    this.version(1).stores({
      data: 'key',
      files: 'key',
    });
  }
}

const openDbs = new Map<string, ProjectDB>();

export function openProjectDb(projectId: string): ProjectDB {
  let db = openDbs.get(projectId);
  if (!db) {
    db = new ProjectDB(projectId);
    openDbs.set(projectId, db);
  }
  return db;
}

export async function closeProjectDb(projectId: string): Promise<void> {
  const db = openDbs.get(projectId);
  if (db) {
    db.close();
    openDbs.delete(projectId);
  }
}

export async function deleteProjectDb(projectId: string): Promise<void> {
  await closeProjectDb(projectId);
  await Dexie.delete(`qualiapp_project_${projectId}`);
}

export async function dataGet<T>(db: ProjectDB, key: string): Promise<T | undefined> {
  const row = await db.data.get(key);
  return row?.value as T | undefined;
}

export async function dataSet(db: ProjectDB, key: string, value: unknown): Promise<void> {
  await db.data.put({ key, value });
}

export async function dataGetAll(db: ProjectDB): Promise<Record<string, unknown>> {
  const rows = await db.data.toArray();
  const out: Record<string, unknown> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function fileSet(
  db: ProjectDB,
  key: string,
  blob: Blob,
  meta?: { name?: string | null; lastModified?: number | null },
): Promise<void> {
  await db.files.put({
    key,
    blob,
    type: blob.type || 'application/octet-stream',
    name: meta?.name ?? null,
    lastModified: meta?.lastModified ?? null,
  });
}

export async function fileGet(db: ProjectDB, key: string): Promise<FileRow | undefined> {
  return db.files.get(key);
}

export async function fileClearAll(db: ProjectDB): Promise<void> {
  await db.files.clear();
}

export async function fileGetAllFiles(db: ProjectDB): Promise<FileRow[]> {
  return db.files.toArray();
}
