import { useEffect } from 'react';
import { getAutoLockEnabled, IDLE_LOCK_MS } from '../../storage/autoLock';
import type { ProjectDB } from '../../storage/projectDb';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'] as const;

/** Locks the project (returns to the password screen) after IDLE_LOCK_MS of inactivity, if the project has a password and auto-lock is on. */
export function useIdleLock(db: ProjectDB, hasPassword: boolean, onLock: () => void): void {
  useEffect(() => {
    if (!hasPassword) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let autoLockEnabled = true;

    const reset = () => {
      if (!autoLockEnabled) return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!cancelled) onLock();
      }, IDLE_LOCK_MS);
    };

    void getAutoLockEnabled(db).then((enabled) => {
      autoLockEnabled = enabled;
      if (!cancelled && enabled) reset();
    });

    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, reset);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, reset);
    };
  }, [db, hasPassword, onLock]);
}
