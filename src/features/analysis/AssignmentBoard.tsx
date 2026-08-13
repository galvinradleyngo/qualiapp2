import { useState, type DragEvent } from 'react';
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

interface DragPayload {
  key: string;
  sourceGroupId?: string;
}

const DRAG_MIME = 'application/x-quali-assignment-item';

/**
 * Shared two-pane assignment UI used for both Step 2 (codes → categories)
 * and Step 3 (categories → themes). Supports both drag-and-drop and a
 * "quick assign" dropdown per item — the dropdown is the one path that
 * always works (keyboard/touch friendly, no drag edge cases), drag-and-drop
 * is the faster path for sorting many items at once. Re-assigning an
 * already-grouped item to a different group is handled by onAssign alone
 * (it removes the item from whichever group currently holds it), so a drop
 * on a new group never needs a separate unassign call.
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
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragOverUnassigned, setDragOverUnassigned] = useState(false);

  const assignedKeys = new Set(groups.flatMap((g) => g.items));
  const unassigned = unassignedItems.filter((i) => !assignedKeys.has(i.key));

  const startDrag = (e: DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const readDrag = (e: DragEvent): DragPayload | null => {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  };

  const handleDropOnGroup = (e: DragEvent, groupId: string) => {
    e.preventDefault();
    setDragOverGroupId(null);
    const payload = readDrag(e);
    if (!payload) return;
    onAssign(groupId, payload.key);
  };

  const handleDropOnUnassigned = (e: DragEvent) => {
    e.preventDefault();
    setDragOverUnassigned(false);
    const payload = readDrag(e);
    if (!payload?.sourceGroupId) return;
    onUnassign(payload.sourceGroupId, payload.key);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title={unassignedTitle}>
        {/* Always rendered (not swapped for a plain message when empty) so
            it keeps accepting drops — otherwise, once every item is
            assigned, there'd be no way to drag one back out. */}
        <ul
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverUnassigned(true);
          }}
          onDragLeave={() => setDragOverUnassigned(false)}
          onDrop={handleDropOnUnassigned}
          className={`flex min-h-[3rem] max-h-[520px] flex-col gap-2 overflow-y-auto rounded-lg ${dragOverUnassigned ? 'ring-2 ring-accent-400' : ''}`}
        >
          {unassigned.length === 0 ? (
            <li className="px-1 py-2 text-sm text-ink-soft">Nothing left to assign.</li>
          ) : (
            unassigned.map((item) => (
              <li
                key={item.key}
                draggable
                onDragStart={(e) => startDrag(e, { key: item.key })}
                className="cursor-grab rounded-lg border border-border bg-surface-alt px-3 py-2 active:cursor-grabbing"
              >
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
            ))
          )}
        </ul>
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
            <div
              key={g.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverGroupId(g.id);
              }}
              onDragLeave={() => setDragOverGroupId((current) => (current === g.id ? null : current))}
              onDrop={(e) => handleDropOnGroup(e, g.id)}
              className={`rounded-lg border border-dashed p-3 transition-colors ${
                dragOverGroupId === g.id ? 'border-accent-600 bg-accent-50' : 'border-border-strong'
              }`}
            >
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
                {g.items.length === 0 && <span className="text-xs text-ink-soft">Drop zone — drag items here, or assign them from the left.</span>}
                {g.items.map((key) => {
                  const item = unassignedItems.find((i) => i.key === key);
                  return (
                    <span
                      key={key}
                      draggable
                      onDragStart={(e) => startDrag(e, { key, sourceGroupId: g.id })}
                      className="badge cursor-grab bg-accent-50 text-accent-800 active:cursor-grabbing"
                    >
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
