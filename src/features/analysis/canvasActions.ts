import { useCallback } from 'react';
import type { AnalysisCanvas, ConnectionRationale } from '../../data/types';
import { useProjectStore } from '../workspace/ProjectStore';

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Re-derives sequential C1..Cn codes from category order and remaps every
 * matrix (connections/rationales/notes) that was keyed by the old codes —
 * so adding/removing/reordering a category never orphans matrix data. */
export function normalizeCanvas(canvas: AnalysisCanvas): AnalysisCanvas {
  const codeMap = new Map<string, string>();
  const categories = canvas.categories.map((cat, i) => {
    const code = `C${i + 1}`;
    codeMap.set(cat.code, code);
    return { ...cat, code };
  });

  const remapRecord = <T,>(record: Record<string, Record<string, T>>): Record<string, Record<string, T>> => {
    const next: Record<string, Record<string, T>> = {};
    for (const [row, cols] of Object.entries(record)) {
      const newRow = codeMap.get(row);
      if (!newRow) continue;
      next[newRow] = {};
      for (const [col, val] of Object.entries(cols)) {
        const newCol = codeMap.get(col);
        if (newCol) next[newRow]![newCol] = val;
      }
    }
    return next;
  };

  const notes: Record<string, string> = {};
  for (const [code, note] of Object.entries(canvas.connectionNotes)) {
    const newCode = codeMap.get(code);
    if (newCode) notes[newCode] = note;
  }

  return {
    ...canvas,
    categories,
    connections: remapRecord(canvas.connections),
    connectionRationales: remapRecord(canvas.connectionRationales),
    connectionNotes: notes,
  };
}

export function useCanvasActions() {
  const { data, set } = useProjectStore();

  const updateCanvas = useCallback(
    (id: string, updater: (canvas: AnalysisCanvas) => AnalysisCanvas) => {
      void set(
        'analysisCanvases',
        data.analysisCanvases.map((c) => (c.id === id ? normalizeCanvas(updater(c)) : c)),
      );
    },
    [data.analysisCanvases, set],
  );

  const createCanvas = useCallback(
    async (name: string): Promise<string> => {
      const canvas: AnalysisCanvas = {
        id: newId(),
        name: name.trim() || 'Untitled workspace',
        categories: [],
        themes: [],
        connections: {},
        connectionNotes: {},
        connectionRationales: {},
      };
      await set('analysisCanvases', [...data.analysisCanvases, canvas]);
      return canvas.id;
    },
    [data.analysisCanvases, set],
  );

  const renameCanvas = useCallback(
    (id: string, name: string) => updateCanvas(id, (c) => ({ ...c, name })),
    [updateCanvas],
  );

  const duplicateCanvas = useCallback(
    async (id: string, newName: string): Promise<string | null> => {
      const source = data.analysisCanvases.find((c) => c.id === id);
      if (!source) return null;
      const idMap = new Map<string, string>();
      const categories = source.categories.map((cat) => {
        const id2 = newId();
        idMap.set(cat.id, id2);
        return { ...cat, id: id2 };
      });
      const themes = source.themes.map((t) => ({ ...t, id: newId() }));
      const copy: AnalysisCanvas = {
        ...source,
        id: newId(),
        name: newName.trim() || `${source.name} copy`,
        categories,
        themes,
      };
      await set('analysisCanvases', [...data.analysisCanvases, copy]);
      return copy.id;
    },
    [data.analysisCanvases, set],
  );

  const deleteCanvas = useCallback(
    (id: string) => {
      void set(
        'analysisCanvases',
        data.analysisCanvases.filter((c) => c.id !== id),
      );
    },
    [data.analysisCanvases, set],
  );

  const addCategory = useCallback(
    (canvasId: string, name: string) =>
      updateCanvas(canvasId, (c) => ({
        ...c,
        categories: [...c.categories, { id: newId(), name: name.trim() || 'New category', code: '', codes: [] }],
      })),
    [updateCanvas],
  );

  const removeCategory = useCallback(
    (canvasId: string, categoryId: string) =>
      updateCanvas(canvasId, (c) => {
        const removed = c.categories.find((cat) => cat.id === categoryId);
        return {
          ...c,
          categories: c.categories.filter((cat) => cat.id !== categoryId),
          themes: removed ? c.themes.map((t) => ({ ...t, categories: t.categories.filter((n) => n !== removed.name) })) : c.themes,
        };
      }),
    [updateCanvas],
  );

  const renameCategory = useCallback(
    (canvasId: string, categoryId: string, name: string) =>
      updateCanvas(canvasId, (c) => ({
        ...c,
        categories: c.categories.map((cat) => (cat.id === categoryId ? { ...cat, name } : cat)),
      })),
    [updateCanvas],
  );

  const assignCodeToCategory = useCallback(
    (canvasId: string, categoryId: string, codeName: string) =>
      updateCanvas(canvasId, (c) => ({
        ...c,
        categories: c.categories.map((cat) => {
          if (cat.id === categoryId) return cat.codes.includes(codeName) ? cat : { ...cat, codes: [...cat.codes, codeName] };
          return cat.codes.includes(codeName) ? { ...cat, codes: cat.codes.filter((n) => n !== codeName) } : cat;
        }),
      })),
    [updateCanvas],
  );

  const unassignCode = useCallback(
    (canvasId: string, categoryId: string, codeName: string) =>
      updateCanvas(canvasId, (c) => ({
        ...c,
        categories: c.categories.map((cat) => (cat.id === categoryId ? { ...cat, codes: cat.codes.filter((n) => n !== codeName) } : cat)),
      })),
    [updateCanvas],
  );

  const addTheme = useCallback(
    (canvasId: string, name: string) =>
      updateCanvas(canvasId, (c) => ({ ...c, themes: [...c.themes, { id: newId(), name: name.trim() || 'New theme', categories: [] }] })),
    [updateCanvas],
  );

  const removeTheme = useCallback(
    (canvasId: string, themeId: string) =>
      updateCanvas(canvasId, (c) => ({ ...c, themes: c.themes.filter((t) => t.id !== themeId) })),
    [updateCanvas],
  );

  const renameTheme = useCallback(
    (canvasId: string, themeId: string, name: string) =>
      updateCanvas(canvasId, (c) => ({ ...c, themes: c.themes.map((t) => (t.id === themeId ? { ...t, name } : t)) })),
    [updateCanvas],
  );

  const assignCategoryToTheme = useCallback(
    (canvasId: string, themeId: string, categoryName: string) =>
      updateCanvas(canvasId, (c) => ({
        ...c,
        themes: c.themes.map((t) => {
          if (t.id === themeId) return t.categories.includes(categoryName) ? t : { ...t, categories: [...t.categories, categoryName] };
          return t.categories.includes(categoryName) ? { ...t, categories: t.categories.filter((n) => n !== categoryName) } : t;
        }),
      })),
    [updateCanvas],
  );

  const unassignCategoryFromTheme = useCallback(
    (canvasId: string, themeId: string, categoryName: string) =>
      updateCanvas(canvasId, (c) => ({
        ...c,
        themes: c.themes.map((t) => (t.id === themeId ? { ...t, categories: t.categories.filter((n) => n !== categoryName) } : t)),
      })),
    [updateCanvas],
  );

  const setThemeExplanation = useCallback(
    (canvasId: string, themeId: string, explanation: string) =>
      updateCanvas(canvasId, (c) => ({ ...c, themes: c.themes.map((t) => (t.id === themeId ? { ...t, explanation } : t)) })),
    [updateCanvas],
  );

  /** Creates a theme pre-populated with a set of categories (e.g. a node's
   * connected cluster from the relational map) in one step. */
  const createThemeFromCategories = useCallback(
    (canvasId: string, name: string, categoryNames: string[], explanation?: string): string => {
      const id = newId();
      updateCanvas(canvasId, (c) => ({
        ...c,
        themes: [...c.themes, { id, name: name.trim() || 'New theme', categories: Array.from(new Set(categoryNames)), explanation }],
      }));
      return id;
    },
    [updateCanvas],
  );

  const setConnection = useCallback(
    (canvasId: string, rowCode: string, colCode: string, value: 0 | 1) =>
      updateCanvas(canvasId, (c) => ({
        ...c,
        connections: {
          ...c.connections,
          [rowCode]: { ...c.connections[rowCode], [colCode]: value },
          [colCode]: { ...c.connections[colCode], [rowCode]: value },
        },
      })),
    [updateCanvas],
  );

  const setConnectionRationale = useCallback(
    (canvasId: string, rowCode: string, colCode: string, rationale: ConnectionRationale) =>
      updateCanvas(canvasId, (c) => ({
        ...c,
        connectionRationales: {
          ...c.connectionRationales,
          [rowCode]: { ...c.connectionRationales[rowCode], [colCode]: rationale },
          [colCode]: { ...c.connectionRationales[colCode], [rowCode]: rationale },
        },
      })),
    [updateCanvas],
  );

  const setConnectionNote = useCallback(
    (canvasId: string, categoryCode: string, note: string) =>
      updateCanvas(canvasId, (c) => ({ ...c, connectionNotes: { ...c.connectionNotes, [categoryCode]: note } })),
    [updateCanvas],
  );

  return {
    createCanvas,
    renameCanvas,
    duplicateCanvas,
    deleteCanvas,
    addCategory,
    removeCategory,
    renameCategory,
    assignCodeToCategory,
    unassignCode,
    addTheme,
    removeTheme,
    renameTheme,
    assignCategoryToTheme,
    unassignCategoryFromTheme,
    setThemeExplanation,
    createThemeFromCategories,
    setConnection,
    setConnectionRationale,
    setConnectionNote,
  };
}
