// Central project state: loads every ProjectData field from the project's
// Dexie `data` table on mount, holds it in React state, and persists each
// field back to IndexedDB whenever it changes — mirroring the legacy app's
// "one dbSet per field, on every mutation" pattern so behavior (autosave,
// per-field storage) stays the same.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { EMPTY_PROJECT_DATA, type ProjectData } from '../../data/types';
import { dataGet, dataSet, type ProjectDB } from '../../storage/projectDb';

type FieldSetter = <K extends keyof ProjectData>(key: K, value: ProjectData[K]) => Promise<void>;

export interface ProjectStoreValue {
  db: ProjectDB;
  data: ProjectData;
  set: FieldSetter;
}

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null);

async function loadProjectData(db: ProjectDB): Promise<ProjectData> {
  const entries = await Promise.all(
    (Object.keys(EMPTY_PROJECT_DATA) as Array<keyof ProjectData>).map(async (key) => {
      const value = await dataGet<ProjectData[typeof key]>(db, key);
      return [key, value] as const;
    }),
  );
  const loaded = { ...EMPTY_PROJECT_DATA };
  for (const [key, value] of entries) {
    if (value !== undefined) (loaded as Record<string, unknown>)[key] = value;
  }
  return loaded;
}

export function ProjectStoreProvider({ db, children }: { db: ProjectDB; children: ReactNode }) {
  const [data, setData] = useState<ProjectData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    void loadProjectData(db).then((loaded) => {
      if (!cancelled) setData(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const set = useCallback<FieldSetter>(
    async (key, value) => {
      setData((prev) => (prev ? { ...prev, [key]: value } : prev));
      await dataSet(db, key, value);
    },
    [db],
  );

  const value = useMemo<ProjectStoreValue | null>(() => (data ? { db, data, set } : null), [db, data, set]);

  if (!value) {
    return <div className="flex h-screen items-center justify-center text-sm text-ink-soft">Loading project…</div>;
  }

  return <ProjectStoreContext.Provider value={value}>{children}</ProjectStoreContext.Provider>;
}

export function useProjectStore(): ProjectStoreValue {
  const ctx = useContext(ProjectStoreContext);
  if (!ctx) throw new Error('useProjectStore must be used within a ProjectStoreProvider');
  return ctx;
}
