// Renaming a code or category is a global cascading operation: it rewrites
// every tag/observationTag/artifact-code that used the old name, and merges
// the codeDefinitions/categoryDefinitions record if the new name already
// exists (the app's only "merge codes" mechanism — ported from the legacy
// rename-to-existing-name behavior).

import { useCallback } from 'react';
import type { CodeDefinitionRecord, CodeDefinitions } from '../../data/types';
import { useProjectStore } from './ProjectStore';

const mergeDefinitionRecords = (
  target: CodeDefinitionRecord | undefined,
  source: CodeDefinitionRecord | undefined,
): CodeDefinitionRecord => ({
  definition: target?.definition || source?.definition || '',
  inclusion: target?.inclusion || source?.inclusion || '',
  exclusion: target?.exclusion || source?.exclusion || '',
  exemplars: target?.exemplars || source?.exemplars || '',
});

function renameDefinitionKey(defs: CodeDefinitions, oldName: string, newName: string): CodeDefinitions {
  if (!(oldName in defs) && !(newName in defs)) return defs;
  const next = { ...defs };
  const merged = mergeDefinitionRecords(next[newName], next[oldName]);
  delete next[oldName];
  next[newName] = merged;
  return next;
}

export function useCodebookActions() {
  const { data, set } = useProjectStore();

  const renameCodeLabel = useCallback(
    async (oldName: string, newName: string) => {
      const clean = newName.trim();
      if (!clean || clean === oldName) return;
      await Promise.all([
        set(
          'tags',
          data.tags.map((t) => (t.tagName === oldName ? { ...t, tagName: clean } : t)),
        ),
        set(
          'observationTags',
          data.observationTags.map((t) => (t.tagName === oldName ? { ...t, tagName: clean } : t)),
        ),
        set(
          'globalArtifacts',
          data.globalArtifacts.map((a) =>
            a.codes.includes(oldName)
              ? { ...a, codes: Array.from(new Set(a.codes.map((c) => (c === oldName ? clean : c)))) }
              : a,
          ),
        ),
        set(
          'analysisCanvases',
          data.analysisCanvases.map((canvas) => ({
            ...canvas,
            categories: canvas.categories.map((cat) =>
              cat.codes.includes(oldName)
                ? { ...cat, codes: Array.from(new Set(cat.codes.map((c) => (c === oldName ? clean : c)))) }
                : cat,
            ),
          })),
        ),
        set('codeDefinitions', renameDefinitionKey(data.codeDefinitions, oldName, clean)),
      ]);
    },
    [data.tags, data.observationTags, data.globalArtifacts, data.analysisCanvases, data.codeDefinitions, set],
  );

  const renameCategoryLabel = useCallback(
    async (oldName: string, newName: string) => {
      const clean = newName.trim();
      if (!clean || clean === oldName) return;
      await Promise.all([
        set(
          'tags',
          data.tags.map((t) => (t.category === oldName ? { ...t, category: clean } : t)),
        ),
        set(
          'observationTags',
          data.observationTags.map((t) => (t.category === oldName ? { ...t, category: clean } : t)),
        ),
        set('categoryDefinitions', renameDefinitionKey(data.categoryDefinitions, oldName, clean)),
      ]);
    },
    [data.tags, data.observationTags, data.categoryDefinitions, set],
  );

  const updateCodeDefinition = useCallback(
    async (name: string, record: CodeDefinitionRecord) => {
      const isEmpty = !record.definition && !record.inclusion && !record.exclusion && !record.exemplars;
      const next = { ...data.codeDefinitions };
      if (isEmpty) delete next[name];
      else next[name] = record;
      await set('codeDefinitions', next);
    },
    [data.codeDefinitions, set],
  );

  const updateCategoryDefinition = useCallback(
    async (name: string, record: CodeDefinitionRecord) => {
      const isEmpty = !record.definition && !record.inclusion && !record.exclusion && !record.exemplars;
      const next = { ...data.categoryDefinitions };
      if (isEmpty) delete next[name];
      else next[name] = record;
      await set('categoryDefinitions', next);
    },
    [data.categoryDefinitions, set],
  );

  return { renameCodeLabel, renameCategoryLabel, updateCodeDefinition, updateCategoryDefinition };
}
