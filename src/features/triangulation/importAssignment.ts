// Importing an assignment package always creates a NEW project (this app
// has real multi-project isolation, unlike the legacy app, which destructively
// overwrote whatever workspace you happened to have open — a real risk if you
// forgot to use a dedicated browser profile). Nothing existing is ever touched.

import type { Participant, TriangulationAssignmentMeta } from '../../data/types';
import { createProjectRecord, type ProjectRecord } from '../../storage/registry';
import { dataSet, fileSet, openProjectDb } from '../../storage/projectDb';
import { decodeSerializedFileBytes, type AssignmentPackage } from './packages';

export async function importAssignmentAsNewProject(pkg: AssignmentPackage, projectTitle: string): Promise<ProjectRecord> {
  const project = await createProjectRecord(projectTitle.trim() || `Co-rater copy — ${pkg.packageId}`);
  const db = openProjectDb(project.id);

  const participants: Participant[] = pkg.data.participants.map((p) => ({
    id: p.id,
    pseudonym: p.pseudonym,
    actualName: '',
    interviewDate: '',
    notes: '',
    createdAt: new Date().toISOString(),
    consentFormId: null,
    consentFileName: null,
  }));

  const assignmentMeta: TriangulationAssignmentMeta = {
    packageId: pkg.packageId,
    projectFingerprint: pkg.projectFingerprint,
    importedAt: new Date().toISOString(),
  };

  await Promise.all([
    dataSet(db, 'transcripts', pkg.data.transcripts),
    dataSet(db, 'folders', pkg.data.folders),
    dataSet(db, 'tags', []),
    dataSet(db, 'globalArtifacts', pkg.data.globalArtifacts),
    dataSet(db, 'activityTypes', pkg.data.activityTypes),
    dataSet(db, 'participants', participants),
    dataSet(db, 'analysisCanvases', []),
    dataSet(db, 'triangulationAssignmentMeta', assignmentMeta),
  ]);

  for (const f of pkg.files) {
    const bytes = decodeSerializedFileBytes(f);
    const blob = f.name
      ? new File([bytes as BlobPart], f.name, { type: f.type || 'application/octet-stream', lastModified: f.lastModified ?? Date.now() })
      : new Blob([bytes as BlobPart], { type: f.type || 'application/octet-stream' });
    await fileSet(db, f.key, blob, { name: f.name, lastModified: f.lastModified });
  }

  return project;
}
