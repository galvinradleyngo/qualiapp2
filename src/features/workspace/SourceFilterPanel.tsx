import { useMemo, useState } from 'react';
import type { SourceFilterPreset } from '../../data/types';
import { Button } from '../../ui/Button';
import { SOURCE_TYPE_LABELS, type SourceItem, type SourceType } from './sourceItems';

interface SourceFilterPanelProps {
  items: SourceItem[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  presets: SourceFilterPreset[];
  onSavePreset: (preset: SourceFilterPreset) => void;
  onDeletePreset: (id: string) => void;
}

/** Preset selections are re-applied against the *current* item set: items that still exist keep
 * their saved on/off state; items that didn't exist when the preset was saved default to included. */
export function resolvePresetSelection(preset: SourceFilterPreset, allIds: string[]): Set<string> {
  const savedSelected = new Set(preset.selectedIds);
  const savedAvailable = new Set(preset.availableIds);
  const next = new Set<string>();
  for (const id of allIds) {
    if (savedAvailable.has(id)) {
      if (savedSelected.has(id)) next.add(id);
    } else {
      next.add(id);
    }
  }
  return next;
}

export function SourceFilterPanel({ items, selectedIds, onChange, presets, onSavePreset, onDeletePreset }: SourceFilterPanelProps) {
  const [presetName, setPresetName] = useState('');
  const grouped = useMemo(() => {
    const groups: Record<SourceType, SourceItem[]> = { transcript: [], artifact: [], observation: [] };
    for (const item of items) groups[item.type].push(item);
    return groups;
  }, [items]);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const toggleGroup = (type: SourceType, on: boolean) => {
    const next = new Set(selectedIds);
    for (const item of grouped[type]) {
      if (on) next.add(item.id);
      else next.delete(item.id);
    }
    onChange(next);
  };

  const savePreset = () => {
    if (!presetName.trim()) return;
    onSavePreset({
      id: `${Date.now()}`,
      name: presetName.trim(),
      selectedIds: Array.from(selectedIds),
      availableIds: items.map((i) => i.id),
      updatedAt: new Date().toISOString(),
    });
    setPresetName('');
  };

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Included source items</h3>
        <div className="flex items-center gap-2">
          <select
            className="select w-auto py-1 text-xs"
            defaultValue=""
            onChange={(e) => {
              const preset = presets.find((p) => p.id === e.target.value);
              if (preset) onChange(resolvePresetSelection(preset, items.map((i) => i.id)));
              e.target.value = '';
            }}
          >
            <option value="" disabled>
              Apply saved filter…
            </option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="link-btn" onClick={() => onChange(new Set(items.map((i) => i.id)))}>
            Select all
          </button>
          <button className="link-btn" onClick={() => onChange(new Set())}>
            Clear all
          </button>
        </div>
      </div>

      {(Object.keys(grouped) as SourceType[]).map((type) =>
        grouped[type].length === 0 ? null : (
          <div key={type} className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{SOURCE_TYPE_LABELS[type]}</span>
              <span className="flex gap-2 text-xs">
                <button className="link-btn" onClick={() => toggleGroup(type, true)}>
                  all
                </button>
                <button className="link-btn" onClick={() => toggleGroup(type, false)}>
                  none
                </button>
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {grouped[type].map((item) => (
                <label key={item.id} className="flex items-center gap-1.5 text-sm text-ink-soft">
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        ),
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <input
          className="input w-56 py-1 text-xs"
          placeholder="Save current checks as…"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
        />
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={savePreset}>
          Save
        </Button>
        {presets.length > 0 && (
          <select
            className="select w-auto py-1 text-xs"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onDeletePreset(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="" disabled>
              Delete a saved filter…
            </option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
