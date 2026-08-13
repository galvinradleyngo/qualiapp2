// Imports a legacy `.qbk` backup as a brand-new project. Old backups predate
// the project concept, so this always asks the caller for a project title
// and always creates a fresh project — it never merges into or overwrites an
// existing one, even if the title matches.

import { createProjectRecord, type ProjectRecord } from '../storage/registry';
import { dataSet, fileSet, openProjectDb } from '../storage/projectDb';
import { SEC_APP_PIN_KEY, SEC_PARTICIPANT_PIN_KEY, SEC_RECOVERY_KEY } from '../storage/securityKeys';
import { secPbkdf2Hash } from './crypto';
import { parseLegacyBackup, type LegacyBackupPayload } from './legacyFormat';

export interface ImportLegacyBackupOptions {
  file: Blob;
  password: string;
  projectTitle: string;
  onProgress?: (step: string, pct: number) => void;
}

/** Parses a legacy `.qbk` file and writes it into a newly created project. */
export async function importLegacyBackup({
  file,
  password,
  projectTitle,
  onProgress,
}: ImportLegacyBackupOptions): Promise<ProjectRecord> {
  const payload = await parseLegacyBackup(file, password, onProgress);
  const project = await createProjectRecord(projectTitle.trim() || 'Imported project');
  const db = openProjectDb(project.id);

  onProgress?.('Writing project data…', 96);
  for (const [key, value] of Object.entries(payload.data)) {
    if (value !== undefined) await dataSet(db, key, value);
  }
  await writeLegacySecurity(db, project.id, payload);

  onProgress?.('Writing files…', 98);
  for (const f of payload.files) {
    const blob = f.name
      ? new File([f.bytes as BlobPart], f.name, { type: f.type || 'application/octet-stream', lastModified: f.lastModified ?? Date.now() })
      : new Blob([f.bytes as BlobPart], { type: f.type || 'application/octet-stream' });
    await fileSet(db, f.key, blob, { name: f.name, lastModified: f.lastModified });
  }

  onProgress?.('Done', 100);
  return project;
}

async function writeLegacySecurity(
  db: ReturnType<typeof openProjectDb>,
  _projectId: string,
  payload: LegacyBackupPayload,
): Promise<void> {
  const security = payload.security;
  if (!security) return;

  if (security.appPinV2) {
    await dataSet(db, SEC_APP_PIN_KEY, security.appPinV2);
  } else if (security.appPin) {
    // Very old backups stored an unsalted PIN string directly; re-hash it
    // into the current PBKDF2 format so it's never persisted in plain form.
    await dataSet(db, SEC_APP_PIN_KEY, await secPbkdf2Hash(security.appPin));
  }

  if (security.participantPinV2) {
    await dataSet(db, SEC_PARTICIPANT_PIN_KEY, security.participantPinV2);
  }

  if (security.recoveryV2) {
    await dataSet(db, SEC_RECOVERY_KEY, security.recoveryV2);
  } else if (security.recoveryQuestion && security.recoveryAnswerHash) {
    // Legacy recovery answers were hashed with plain SHA-256 and no
    // per-record salt; carry them forward as-is rather than guessing at a
    // migration, since we don't have the original plaintext to re-hash.
    await dataSet(db, SEC_RECOVERY_KEY, {
      question: security.recoveryQuestion,
      legacyAnswerHash: security.recoveryAnswerHash,
    });
  }
}
