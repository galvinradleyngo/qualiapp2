import type { ProjectData } from '../../data/types';
import { buildSourceId } from '../workspace/sourceItems';

export interface CodebookSource {
  type: 'transcript' | 'artifact' | 'observation';
  label: string;
  folder: string;
}

export interface CodebookRow {
  category: string;
  code: string;
  quoteCount: number;
  sources: CodebookSource[];
  quotes: string[];
  memos: string[];
}

/** Aggregates tags/artifact-codes/observationTags into one grouped codebook table, scoped to the given source ids. */
export function buildCodebookRows(data: ProjectData, includedSourceIds: Set<string>): CodebookRow[] {
  const rows = new Map<string, CodebookRow>();

  const touch = (category: string, code: string): CodebookRow => {
    const key = `${category}::${code}`;
    let row = rows.get(key);
    if (!row) {
      row = { category, code, quoteCount: 0, sources: [], quotes: [], memos: [] };
      rows.set(key, row);
    }
    return row;
  };

  for (const t of data.tags) {
    if (!includedSourceIds.has(buildSourceId('transcript', t.transcriptId))) continue;
    const transcript = data.transcripts.find((x) => x.id === t.transcriptId);
    const row = touch(t.category || 'Uncategorized', t.tagName);
    row.quoteCount += 1;
    row.sources.push({ type: 'transcript', label: transcript?.title ?? t.transcriptId, folder: transcript?.folder ?? '' });
    if (row.quotes.length < 3) row.quotes.push(t.textSnippet);
    if (t.memo) row.memos.push(t.memo);
  }

  for (const t of data.observationTags) {
    if (!includedSourceIds.has(buildSourceId('observation', t.observationId))) continue;
    const observation = data.observations.find((x) => x.id === t.observationId);
    const row = touch(t.category || 'Uncategorized', t.tagName);
    row.quoteCount += 1;
    row.sources.push({ type: 'observation', label: observation?.title ?? t.observationId, folder: observation?.folder ?? '' });
    if (row.quotes.length < 3) row.quotes.push(t.textSnippet);
    if (t.memo) row.memos.push(t.memo);
  }

  for (const a of data.globalArtifacts) {
    if (!includedSourceIds.has(buildSourceId('artifact', a.id))) continue;
    for (const code of a.codes) {
      const row = touch('Uncategorized', code);
      row.quoteCount += 1;
      row.sources.push({ type: 'artifact', label: a.name, folder: a.folder });
      if (row.quotes.length < 3 && a.notes) row.quotes.push(a.notes);
    }
  }

  // Codes/categories with a saved definition but zero current usage still get a (empty) row,
  // so pre-registered codes show up before anything has been coded with them yet.
  for (const name of Object.keys(data.codeDefinitions)) touch('Uncategorized', name);
  for (const name of Object.keys(data.categoryDefinitions)) touch(name, '');

  return Array.from(rows.values()).filter((r) => r.code || Object.keys(data.categoryDefinitions).includes(r.category));
}

export function sourceCount(row: CodebookRow): number {
  return new Set(row.sources.map((s) => `${s.type}:${s.label}`)).size;
}
