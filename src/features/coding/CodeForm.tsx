import { useMemo, useState } from 'react';
import { Button } from '../../ui/Button';
import { evaluateInVivoAlignment } from './inVivo';

interface CodeFormProps {
  quote: string;
  existingCategories: string[];
  existingCodes: string[];
  initial?: { category: string; tagName: string; memo: string };
  onSubmit: (fields: { category: string; tagName: string; memo: string }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const topN = (items: string[], n: number): string[] => {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([item]) => item);
};

export function CodeForm({ quote, existingCategories, existingCodes, initial, onSubmit, onCancel, onDelete }: CodeFormProps) {
  const [category, setCategory] = useState(initial?.category ?? '');
  const [tagName, setTagName] = useState(initial?.tagName ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [inVivoMode, setInVivoMode] = useState(false);

  const categoryChips = useMemo(() => topN(existingCategories, 12), [existingCategories]);
  const codeChips = useMemo(() => topN(existingCodes, 16), [existingCodes]);
  const aligns = useMemo(() => (tagName.trim() ? evaluateInVivoAlignment(tagName, quote) : null), [tagName, quote]);
  const blocked = inVivoMode && aligns === false;

  const handleSubmit = () => {
    if (!tagName.trim() || blocked) return;
    onSubmit({ category: category.trim() || 'Uncategorized', tagName: tagName.trim(), memo: memo.trim() });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm italic text-ink-soft">“{quote}”</div>

      <div className="field">
        <label htmlFor="code-category">Parent category</label>
        <input
          id="code-category"
          list="category-suggestions"
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Barriers"
        />
        <datalist id="category-suggestions">
          {existingCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {categoryChips.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {categoryChips.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className="badge bg-surface-alt text-ink-soft hover:bg-border">
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="code-name">Specific code</label>
        <input
          id="code-name"
          list="code-suggestions"
          className="input"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          placeholder="e.g. time constraints"
        />
        <datalist id="code-suggestions">
          {existingCodes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {codeChips.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {codeChips.map((c) => (
              <button key={c} type="button" onClick={() => setTagName(c)} className="badge bg-surface-alt text-ink-soft hover:bg-border">
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="code-memo">Code memo</label>
        <textarea id="code-memo" className="textarea" value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={inVivoMode} onChange={(e) => setInVivoMode(e.target.checked)} />
        In-vivo (code must reflect the participant's own words)
      </label>
      {inVivoMode && tagName.trim() && (
        <p className={`text-sm ${aligns ? 'text-accent-700' : 'text-amber-700'}`}>
          {aligns ? 'Aligns with the highlighted quote.' : 'Doesn’t look related to the highlighted quote yet.'}
        </p>
      )}

      <div className="flex justify-between gap-2">
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={!tagName.trim() || blocked}>
            {initial ? 'Save changes' : 'Save code'}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        {onDelete && (
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
