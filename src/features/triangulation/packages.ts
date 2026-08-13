// Investigator-triangulation packages: a "assignment" package hands a
// blinded copy of the project (codes/themes stripped) to a second coder;
// they code it independently and send back a "return" package containing
// only their codes/themes, which get compared against the main coder's own.
// Plain JSON files (not encrypted, not gzip-wrapped) — ported 1:1 from the
// legacy app's format so packages stay interchangeable either direction.

import { blobToBase64, fromBase64, stringHash } from '../../backup/crypto';
import type { AnalysisCanvas, GlobalArtifact, ProjectData, Tag, Transcript } from '../../data/types';
import { fileGetAllFiles, type ProjectDB } from '../../storage/projectDb';

export async function computeProjectFingerprint(data: ProjectData): Promise<string> {
  const stable = {
    transcripts: data.transcripts.map((t) => ({ id: t.id, title: t.title, folder: t.folder, content: t.content || '' })),
    artifacts: data.globalArtifacts.map((a) => ({ id: a.id, name: a.name, folder: a.folder || '', notes: a.notes || '' })),
    participants: data.participants.map((p) => ({ id: p.id, pseudonym: p.pseudonym || '' })),
  };
  return stringHash(JSON.stringify(stable));
}

interface SerializedFile {
  key: string;
  type: string;
  name: string | null;
  lastModified: number | null;
  bytes: string;
}

export interface AssignmentPackage {
  type: 'triangulation-assignment';
  version: 1;
  packageId: string;
  createdAt: string;
  projectFingerprint: string;
  data: {
    transcripts: Transcript[];
    folders: string[];
    tags: Tag[];
    globalArtifacts: GlobalArtifact[];
    activityTypes: string[];
    participants: Array<{ id: string; pseudonym: string }>;
    analysisCanvases: AnalysisCanvas[];
  };
  files: SerializedFile[];
}

export async function buildAssignmentPackage(db: ProjectDB, data: ProjectData): Promise<Blob> {
  const files = await fileGetAllFiles(db);
  const serializedFiles: SerializedFile[] = await Promise.all(
    files.map(async (f) => ({ key: f.key, type: f.type, name: f.name, lastModified: f.lastModified, bytes: await blobToBase64(f.blob) })),
  );
  const fingerprint = await computeProjectFingerprint(data);
  const payload: AssignmentPackage = {
    type: 'triangulation-assignment',
    version: 1,
    packageId: `tri_${Date.now()}`,
    createdAt: new Date().toISOString(),
    projectFingerprint: fingerprint,
    data: {
      transcripts: data.transcripts,
      folders: data.folders,
      tags: [],
      globalArtifacts: data.globalArtifacts.map((a) => ({ ...a, codes: [] })),
      activityTypes: data.activityTypes,
      participants: data.participants.map((p) => ({ id: p.id, pseudonym: p.pseudonym || `P-${p.id.slice(-4)}` })),
      analysisCanvases: [],
    },
    files: serializedFiles,
  };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export async function parseAssignmentPackage(file: Blob): Promise<AssignmentPackage> {
  const text = await file.text();
  const parsed = JSON.parse(text) as AssignmentPackage;
  if (parsed.type !== 'triangulation-assignment') throw new Error('Not a triangulation assignment package.');
  return parsed;
}

export interface ReturnPackage {
  type: 'triangulation-return';
  version: 1;
  packageId: string;
  projectFingerprint: string;
  coderId: string;
  createdAt: string;
  tags: Tag[];
  artifactCodes: Array<{ artifactId: string; artifactName: string; codes: string[] }>;
  analysisCanvases: AnalysisCanvas[];
}

export async function buildReturnPackage(
  data: ProjectData,
  assignmentMeta: { packageId: string; projectFingerprint: string },
  coderId: string,
): Promise<Blob> {
  const artifactCodes = data.globalArtifacts.map((a) => ({ artifactId: a.id, artifactName: a.name, codes: a.codes }));
  const payload: ReturnPackage = {
    type: 'triangulation-return',
    version: 1,
    packageId: assignmentMeta.packageId,
    projectFingerprint: assignmentMeta.projectFingerprint,
    coderId: coderId.trim(),
    createdAt: new Date().toISOString(),
    tags: data.tags,
    artifactCodes,
    analysisCanvases: data.analysisCanvases,
  };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export async function parseReturnPackage(file: Blob): Promise<ReturnPackage> {
  const text = await file.text();
  const parsed = JSON.parse(text) as ReturnPackage;
  if (parsed.type !== 'triangulation-return') throw new Error('Not a triangulation return package.');
  if (!parsed.coderId) throw new Error('Return package is missing a coder id.');
  return parsed;
}

export function decodeSerializedFileBytes(f: SerializedFile): Uint8Array {
  return fromBase64(f.bytes);
}
