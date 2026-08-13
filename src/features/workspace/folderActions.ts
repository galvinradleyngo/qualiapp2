// Folders are a single flat list of names shared by transcripts, global
// artifacts, and observations (not per-type). Renaming/deleting a folder
// cascades across all three collections at once, matching the legacy app.

import { useCallback } from 'react';
import { useProjectStore } from './ProjectStore';

export const UNCATEGORIZED = 'Uncategorized';

export function useFolderActions() {
  const { data, set } = useProjectStore();

  const createFolder = useCallback(
    async (name: string) => {
      const clean = name.trim();
      if (!clean || data.folders.includes(clean)) return;
      await set('folders', [...data.folders, clean]);
    },
    [data.folders, set],
  );

  const renameFolder = useCallback(
    async (oldName: string, newName: string) => {
      const clean = newName.trim();
      if (!clean || clean === oldName) return;
      const nextFolders = Array.from(new Set(data.folders.map((f) => (f === oldName ? clean : f))));
      await Promise.all([
        set('folders', nextFolders),
        set(
          'transcripts',
          data.transcripts.map((t) => (t.folder === oldName ? { ...t, folder: clean } : t)),
        ),
        set(
          'globalArtifacts',
          data.globalArtifacts.map((a) => (a.folder === oldName ? { ...a, folder: clean } : a)),
        ),
        set(
          'observations',
          data.observations.map((o) => (o.folder === oldName ? { ...o, folder: clean } : o)),
        ),
      ]);
    },
    [data.folders, data.transcripts, data.globalArtifacts, data.observations, set],
  );

  const deleteFolder = useCallback(
    async (name: string) => {
      await Promise.all([
        set(
          'folders',
          data.folders.filter((f) => f !== name),
        ),
        set(
          'transcripts',
          data.transcripts.map((t) => (t.folder === name ? { ...t, folder: UNCATEGORIZED } : t)),
        ),
        set(
          'globalArtifacts',
          data.globalArtifacts.map((a) => (a.folder === name ? { ...a, folder: UNCATEGORIZED } : a)),
        ),
        set(
          'observations',
          data.observations.map((o) => (o.folder === name ? { ...o, folder: UNCATEGORIZED } : o)),
        ),
      ]);
    },
    [data.folders, data.transcripts, data.globalArtifacts, data.observations, set],
  );

  const moveTranscriptToFolder = useCallback(
    async (transcriptId: string, folder: string) => {
      await set(
        'transcripts',
        data.transcripts.map((t) => (t.id === transcriptId ? { ...t, folder } : t)),
      );
    },
    [data.transcripts, set],
  );

  const moveArtifactToFolder = useCallback(
    async (artifactId: string, folder: string) => {
      await set(
        'globalArtifacts',
        data.globalArtifacts.map((a) => (a.id === artifactId ? { ...a, folder } : a)),
      );
    },
    [data.globalArtifacts, set],
  );

  const moveObservationToFolder = useCallback(
    async (observationId: string, folder: string) => {
      await set(
        'observations',
        data.observations.map((o) => (o.id === observationId ? { ...o, folder } : o)),
      );
    },
    [data.observations, set],
  );

  return { createFolder, renameFolder, deleteFolder, moveTranscriptToFolder, moveArtifactToFolder, moveObservationToFolder };
}
