// Lists known projects. Each project's actual data lives in its own
// isolated Dexie database (see projectDb.ts) — this registry only tracks
// which projects exist, so it must never hold project content or security
// material itself.

import Dexie, { type Table } from 'dexie';

export interface ProjectRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

class RegistryDB extends Dexie {
  projects!: Table<ProjectRecord, string>;
  constructor() {
    super('qualiapp_registry');
    this.version(1).stores({
      projects: 'id, title, createdAt, updatedAt',
    });
  }
}

export const registryDb = new RegistryDB();

const newProjectId = (): string =>
  `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export async function listProjects(): Promise<ProjectRecord[]> {
  const all = await registryDb.projects.toArray();
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createProjectRecord(title: string): Promise<ProjectRecord> {
  const now = new Date().toISOString();
  const record: ProjectRecord = { id: newProjectId(), title, createdAt: now, updatedAt: now };
  await registryDb.projects.add(record);
  return record;
}

export async function renameProjectRecord(id: string, title: string): Promise<void> {
  await registryDb.projects.update(id, { title, updatedAt: new Date().toISOString() });
}

export async function touchProjectRecord(id: string): Promise<void> {
  await registryDb.projects.update(id, { updatedAt: new Date().toISOString() });
}

export async function deleteProjectRecord(id: string): Promise<void> {
  await registryDb.projects.delete(id);
}
