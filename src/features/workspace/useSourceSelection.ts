import { useEffect, useState } from 'react';
import type { SourceItem } from './sourceItems';

/**
 * Tracks which source items (transcripts/artifacts/observations) are
 * included in a filtered view. New items default to included; items the
 * user explicitly unchecks stay unchecked even as new ones are added later.
 */
export function useSourceSelection(items: SourceItem[]) {
  const [knownIds, setKnownIds] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));

  useEffect(() => {
    const unseen = items.filter((i) => !knownIds.has(i.id));
    if (unseen.length === 0) return;
    setKnownIds((prev) => new Set([...prev, ...unseen.map((i) => i.id)]));
    setSelectedIds((prev) => new Set([...prev, ...unseen.map((i) => i.id)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return [selectedIds, setSelectedIds] as const;
}
