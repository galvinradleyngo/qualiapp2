import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

export interface AssignableItem {
  key: string;
  label: string;
  meta?: string;
}

export interface AssignmentGroup {
  id: string;
  name: string;
  items: string[];
}

interface AssignmentBoardProps {
  unassignedTitle: string;
  unassignedItems: AssignableItem[];
  groups: AssignmentGroup[];
  groupNounSingular: string;
  onAssign: (groupId: string, itemKey: string) => void;
  onUnassign: (groupId: string, itemKey: string) => void;
  onAddGroup: (name: string) => void;
  onRemoveGroup: (id: string) => void;
  onRenameGroup: (id: string, name: string) => void;
}

/**
 * Shared two-pane assignment UI used for both Step 2 (codes → categories)
 * and Step 3 (categories → themes) — the legacy app duplicated this pattern
 * with fragile native drag-and-drop (including a category-reorder handler
 * that was wired up but never actually defined). This uses a "quick assign"
 * dropdown per item instead, which the legacy app already offered as a
 * fallback — here it's the only path, which is simpler and never breaks.
 */
export function AssignmentBoard({
  unassignedTitle,
  unassignedItems,
  groups,
  groupNounSingular,
  onAssign,
  onUnassign,
  onAddGroup,
  onRemoveGroup,
  onRenameGroup,
}: AssignmentBoardProps) {
  const [newGroupName, setNewGroupName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const assignedKeys = new Set(groups.flatMap((g) => g.items));
  const unassigned = unassignedItems.filter((i) => !assignedKeys.has(i.key));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title={unassignedTitle}>
        {unassigned.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing left to assign.</p>
        ) : (
          <ul className="flex max-h-[520px] flex-col gap-2 overflow-y-auto">
            {unassigned.map((item) => (
              <li key={item.key} className="rounded-lg border border-border bg-surface-alt px-3 py-2">
                <div className="mb-1 text-sm font-medium text-ink">{item.label}</div>
                {item.meta && <div className="mb-2 text-xs text-ink-soft">{item.meta}</div>}
                {groups.length > 0 && (
                  <select
                    className="select w-auto py-1 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) onAssign(e.target.value, item.key);
                      e.target.value = '';
                    }}
                  >
                    <option value="" disabled>
                      Assign to {groupNounSingular}…
                    </option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex gap-2">
          <input
            className="input py-1.5 text-sm"
            placeholder={`New ${groupNounSingular} name`}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newGroupName.trim()) {
                onAddGroup(newGroupName.trim());
                setNewGroupName('');
              }
            }}
          />
          <Button
            variant="secondary"
            onClick={() => {
              if (!newGroupName.trim()) return;
              onAddGroup(newGroupName.trim());
              setNewGroupName('');
            }}
          >
            Add
          </Button>
        </div>
        <div className="flex max-h-[480px] flex-col gap-3 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.id} className="rounded-lg border border-dashed border-border-strong p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                {renamingId === g.id ? (
                  <input
                    autoFocus
                    className="input py-1 text-sm font-semibold"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => {
                      if (renameDraft.trim()) onRenameGroup(g.id, renameDraft.trim());
                      setRenamingId(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                ) : (
                  <button
                    className="text-sm font-semibold text-ink hover:underline"
                    onClick={() => {
                      setRenamingId(g.id);
                      setRenameDraft(g.name);
                    }}
                  >
                    {g.name}
                  </button>
                )}
                <button className="text-xs text-red-700 hover:text-red-800" onClick={() => onRemoveGroup(g.id)}>
                  Delete
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.length === 0 && <span className="text-xs text-ink-soft">Drop zone — assign items from the left.</span>}
                {g.items.map((key) => {
                  const item = unassignedItems.find((i) => i.key === key);
                  return (
                    <span key={key} className="badge bg-accent-50 text-accent-800">
                      {item?.label ?? key}
                      <button className="ml-1" onClick={() => onUnassign(g.id, key)}>
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="text-sm text-ink-soft">Create a {groupNounSingular} to start grouping.</p>}
        </div>
      </Card>
    </div>
  );
}
