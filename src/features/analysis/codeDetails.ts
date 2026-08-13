import type { ProjectData } from '../../data/types';
import { buildSourceId } from '../workspace/sourceItems';

export interface CodeDetail {
  name: string;
  quoteCount: number;
  quotes: string[];
}

/** In-vivo codes available to cluster, aggregated the same way as the Codebook, scoped to selected sources. */
export function buildCodeDetails(data: ProjectData, includedSourceIds: Set<string>): Map<string, CodeDetail> {
  const details = new Map<string, CodeDetail>();
  const touch = (name: string): CodeDetail => {
    let d = details.get(name);
    if (!d) {
      d = { name, quoteCount: 0, quotes: [] };
      details.set(name, d);
    }
    return d;
  };

  for (const t of data.tags) {
    if (!includedSourceIds.has(buildSourceId('transcript', t.transcriptId))) continue;
    const d = touch(t.tagName);
    d.quoteCount += 1;
    if (d.quotes.length < 5) d.quotes.push(t.textSnippet);
  }
  for (const t of data.observationTags) {
    if (!includedSourceIds.has(buildSourceId('observation', t.observationId))) continue;
    const d = touch(t.tagName);
    d.quoteCount += 1;
    if (d.quotes.length < 5) d.quotes.push(t.textSnippet);
  }
  for (const a of data.globalArtifacts) {
    if (!includedSourceIds.has(buildSourceId('artifact', a.id))) continue;
    for (const code of a.codes) {
      const d = touch(code);
      d.quoteCount += 1;
      if (d.quotes.length < 5 && a.notes) d.quotes.push(a.notes);
    }
  }
  return details;
}
