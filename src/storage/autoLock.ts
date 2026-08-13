import { dataGet, dataSet, type ProjectDB } from './projectDb';

const AUTO_LOCK_KEY = 'auto_lock_enabled';
export const IDLE_LOCK_MS = 20 * 60 * 1000;

export async function getAutoLockEnabled(db: ProjectDB): Promise<boolean> {
  const value = await dataGet<boolean>(db, AUTO_LOCK_KEY);
  return value ?? true;
}

export async function setAutoLockEnabled(db: ProjectDB, enabled: boolean): Promise<void> {
  await dataSet(db, AUTO_LOCK_KEY, enabled);
}
