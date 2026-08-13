// Imports a legacy `.qbk` backup as a brand-new project. Old backups predate
// the project concept, so this always asks the caller for a project title
// and always creates a fresh project — it never merges into or overwrites an
// existing one, even if the title matches.

import { createProjectRecord, type ProjectRecord } from '../storage/registry';
import { dataSet, fileSet, openProjectDb } from '../storage/projectDb';
import { SEC_APP_PIN_KEY, SEC_PARTICIPANT_PIN_KEY, SEC_RECOVERY_KEY } from '../storage/securityKeys';
import { secPbkdf2Hash } from './crypto';
import { parseLegacyBackup, type LegacyBackupPayload, type LegacyFileEntry } from './legacyFormat';

interface LegacyAudioTrackShape {
  id?: string;
  bookmarks?: unknown;
  audioFiles?: unknown;
  hasAudio?: boolean;
  content?: unknown;
  contentHtml?: unknown;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

/**
 * Legacy backups predate a field the new app relies on: `bookmarks`
 * (previously just inline HTML spans, never a discrete array). Without
 * this, an imported transcript/observation missing `bookmarks` would crash
 * the Editor the first time it renders the audio panel. Also backfills
 * `contentHtml` (should already be present on legacy transcripts, but not
 * guaranteed on every historical format) and, for transcripts recorded
 * before multi-track audio existed, recovers `audioFiles` from the legacy
 * single-track key `audio_<transcriptId>` (the blob was already being
 * imported correctly — it just wasn't referenced by anything).
 */
export function normalizeLegacyDocs(docs: unknown[] | undefined, files: LegacyFileEntry[], legacyAudioKey?: (doc: { id?: string }) => string): void {
  if (!docs) return;
  const fileByKey = new Map(files.map((f) => [f.key, f]));
  for (const raw of docs) {
    const doc = raw as LegacyAudioTrackShape & { id?: string };
    if (!Array.isArray(doc.bookmarks)) doc.bookmarks = [];
    if (typeof doc.contentHtml !== 'string') doc.contentHtml = escapeHtml(typeof doc.content === 'string' ? doc.content : '');
    if (Array.isArray(doc.audioFiles) && doc.audioFiles.length > 0) continue;
    if (!Array.isArray(doc.audioFiles)) doc.audioFiles = [];
    if (doc.hasAudio && legacyAudioKey) {
      const key = legacyAudioKey(doc);
      const file = fileByKey.get(key);
      if (file) doc.audioFiles = [{ id: `${doc.id}_legacy_audio`, key, name: file.name ?? 'audio' }];
    }
  }
}

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
  normalizeLegacyDocs(payload.data.transcripts, payload.files, (doc) => `audio_${doc.id}`);
  normalizeLegacyDocs(payload.data.observations, payload.files);

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
