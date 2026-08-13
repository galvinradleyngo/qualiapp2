import { useMemo, useState } from 'react';
import type { CodeDefinitionRecord } from '../../data/types';
import { useProjectStore } from '../workspace/ProjectStore';
import { useCodebookActions } from '../workspace/codebookActions';
import { listSourceItems } from '../workspace/sourceItems';
import { useSourceSelection } from '../workspace/useSourceSelection';
import { SourceFilterPanel } from '../workspace/SourceFilterPanel';
import { downloadCsv } from '../workspace/csvExport';
import { apaTableHtml, downloadWordDoc } from '../workspace/docExport';
import { Button } from '../../ui/Button';
import { colorForLabel } from '../../ui/codeColors';
import { buildCodebookRows, sourceCount } from './aggregate';

type SortKey = 'category' | 'code' | 'count';

export function CodebookView() {
  const { data, set } = useProjectStore();
  const { renameCodeLabel, renameCategoryLabel, updateCodeDefinition, updateCategoryDefinition } = useCodebookActions();
  const items = useMemo(() => listSourceItems(data), [data]);
  const [selectedIds, setSelectedIds] = useSourceSelection(items);

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('category');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const rows = useMemo(() => buildCodebookRows(data, selectedIds), [data, selectedIds]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = rows.filter(
      (r) =>
        !q ||
        r.category.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.quotes.some((quote) => quote.toLowerCase().includes(q)),
    );
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'category') cmp = a.category.localeCompare(b.category) || a.code.localeCompare(b.code);
      if (sortKey === 'code') cmp = a.code.localeCompare(b.code);
      if (sortKey === 'count') cmp = a.quoteCount - b.quoteCount;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, search, sortKey, sortDir]);

  const codeNames = useMemo(() => Array.from(new Set(rows.map((r) => r.code).filter(Boolean))).sort(), [rows]);
  const categoryNames = useMemo(() => Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort(), [rows]);

  const uniqueCodeCount = codeNames.length;
  const uniqueCategoryCount = categoryNames.length;

  const exportGroupedCsv = () => {
    downloadCsv(
      'codebook.csv',
      [
        ['Category', 'Code', 'Quote count', 'Source count', 'Sample quote'],
        ...filteredRows.map((r) => [r.category, r.code, String(r.quoteCount), String(sourceCount(r)), r.quotes[0] ?? '']),
      ],
    );
  };

  const exportApaDoc = () => {
    const usageRows = filteredRows
      .filter((r) => r.code)
      .map((r) => [r.category, r.code, String(r.quoteCount), String(sourceCount(r)), r.quotes[0] ?? '']);
    const defRows = (names: string[], defs: Record<string, CodeDefinitionRecord>) =>
      names.map((name) => {
        const d = defs[name];
        return [name, d?.definition || '—', d?.inclusion || '—', d?.exclusion || '—'];
      });
    const html = [
      apaTableHtml(1, 'Codebook Usage Summary', ['Category', 'Code', 'Quote Count', 'Source Count', 'Sample Quote'], usageRows),
      apaTableHtml(2, 'Code Definitions', ['Code', 'Definition', 'Inclusion Criteria', 'Exclusion Criteria'], defRows(codeNames, data.codeDefinitions)),
      apaTableHtml(3, 'Category Definitions', ['Category', 'Definition', 'Inclusion Criteria', 'Exclusion Criteria'], defRows(categoryNames, data.categoryDefinitions)),
    ].join('');
    downloadWordDoc('codebook.doc', html, 'Codebook');
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="app-title">Codebook</h1>
          <p className="app-subtitle">
            {uniqueCodeCount} unique {uniqueCodeCount === 1 ? 'code' : 'codes'} and {uniqueCategoryCount} unique{' '}
            {uniqueCategoryCount === 1 ? 'category' : 'categories'} across transcripts, artifacts, and observations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportGroupedCsv}>
            Export CSV
          </Button>
          <Button variant="secondary" onClick={exportApaDoc}>
            Export Word (.doc)
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <SourceFilterPanel
          items={items}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          presets={data.sourceFilterPresets}
          onSavePreset={(preset) => void set('sourceFilterPresets', [...data.sourceFilterPresets, preset])}
          onDeletePreset={(id) => void set('sourceFilterPresets', data.sourceFilterPresets.filter((p) => p.id !== id))}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Search codes, categories, quotes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select w-auto" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="category">Sort: Category</option>
          <option value="code">Sort: Code</option>
          <option value="count">Sort: Quote count</option>
        </select>
        <button className="link-btn" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
          {sortDir === 'asc' ? 'A → Z' : 'Z → A'}
        </button>
      </div>

      <div className="mb-8 overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Sources</th>
              <th className="px-3 py-2">Quotes</th>
              <th className="px-3 py-2">Count</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows
              .filter((r) => r.code)
              .map((r) => (
                <tr key={`${r.category}::${r.code}`} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-ink-soft">{r.category}</td>
                  <td className="px-3 py-2">
                    <span className="badge" style={{ background: colorForLabel(r.code) + '33', color: colorForLabel(r.code) }}>
                      {r.code}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-soft">
                    {Array.from(new Set(r.sources.map((s) => s.label))).join(', ')}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-xs italic text-ink-soft">
                    {r.quotes[0] ? `“${r.quotes[0]}”` : '—'}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.quoteCount}</td>
                </tr>
              ))}
            {filteredRows.filter((r) => r.code).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-ink-soft">
                  No codes match this filter yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DefinitionsTable
        title="Code Definitions"
        names={codeNames}
        definitions={data.codeDefinitions}
        onRename={renameCodeLabel}
        onUpdate={updateCodeDefinition}
      />
      <div className="h-8" />
      <DefinitionsTable
        title="Category Definitions"
        names={categoryNames}
        definitions={data.categoryDefinitions}
        onRename={renameCategoryLabel}
        onUpdate={updateCategoryDefinition}
      />
    </div>
  );
}

function DefinitionsTable({
  title,
  names,
  definitions,
  onRename,
  onUpdate,
}: {
  title: string;
  names: string[];
  definitions: Record<string, CodeDefinitionRecord>;
  onRename: (oldName: string, newName: string) => void;
  onUpdate: (name: string, record: CodeDefinitionRecord) => void;
}) {
  const allNames = useMemo(() => Array.from(new Set([...names, ...Object.keys(definitions)])).sort(), [names, definitions]);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const empty: CodeDefinitionRecord = { definition: '', inclusion: '', exclusion: '', exemplars: '' };

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-3">
        {allNames.length === 0 && <p className="text-sm text-ink-soft">Nothing to define yet.</p>}
        {allNames.map((name) => {
          const record = definitions[name] ?? empty;
          return (
            <div key={name} className="rounded-lg border border-border bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                {editingName === name ? (
                  <input
                    autoFocus
                    className="input py-1 text-sm font-semibold"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => {
                      if (renameDraft.trim() && renameDraft !== name) onRename(name, renameDraft.trim());
                      setEditingName(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                ) : (
                  <button
                    className="text-sm font-semibold text-ink hover:underline"
                    onClick={() => {
                      setEditingName(name);
                      setRenameDraft(name);
                    }}
                  >
                    {name} <span className="text-xs font-normal text-ink-soft">✎</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(['definition', 'inclusion', 'exclusion'] as const).map((field) => (
                  <div key={field} className="field">
                    <label className="capitalize">{field}</label>
                    <textarea
                      className="textarea min-h-[3rem] text-xs"
                      value={record[field]}
                      onChange={(e) => onUpdate(name, { ...record, [field]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
