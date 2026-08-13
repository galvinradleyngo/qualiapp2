// A "source item" is anything codes can come from: a transcript, an
// artifact, or an observation. Shared by Codebook and Analysis Board so both
// filter against the same id scheme and saved presets.

import type { ProjectData } from '../../data/types';

export type SourceType = 'transcript' | 'artifact' | 'observation';

export interface SourceItem {
  id: string; // `${type}:${entityId}`
  type: SourceType;
  entityId: string;
  label: string;
  folder: string;
}

export const buildSourceId = (type: SourceType, entityId: string): string => `${type}:${entityId}`;

export function listSourceItems(data: ProjectData): SourceItem[] {
  return [
    ...data.transcripts.map((t) => ({ id: buildSourceId('transcript', t.id), type: 'transcript' as const, entityId: t.id, label: t.title, folder: t.folder })),
    ...data.globalArtifacts.map((a) => ({ id: buildSourceId('artifact', a.id), type: 'artifact' as const, entityId: a.id, label: a.name, folder: a.folder })),
    ...data.observations.map((o) => ({ id: buildSourceId('observation', o.id), type: 'observation' as const, entityId: o.id, label: o.title, folder: o.folder })),
  ];
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  transcript: 'Transcripts',
  artifact: 'Artifacts',
  observation: 'Observations',
};
