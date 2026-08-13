import { useState } from 'react';
import { Button } from '../../ui/Button';

interface FolderSidebarProps {
  folders: string[];
  activeFolder: string | null;
  countByFolder: Record<string, number>;
  totalCount: number;
  onSelectFolder: (folder: string | null) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (oldName: string, newName: string) => void;
  onDeleteFolder: (name: string) => void;
}

export function FolderSidebar({
  folders,
  activeFolder,
  countByFolder,
  totalCount,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: FolderSidebarProps) {
  const [newFolder, setNewFolder] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = () => {
    if (!newFolder.trim()) return;
    onCreateFolder(newFolder.trim());
    setNewFolder('');
  };

  return (
    <div className="w-52 shrink-0">
      <ul className="flex flex-col gap-0.5">
        <li>
          <button
            onClick={() => onSelectFolder(null)}
            className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm ${
              activeFolder === null ? 'bg-accent-50 font-medium text-accent-800' : 'text-ink-soft hover:bg-surface-alt'
            }`}
          >
            All <span className="text-xs">{totalCount}</span>
          </button>
        </li>
        {folders.map((f) =>
          renaming === f ? (
            <li key={f} className="flex items-center gap-1 px-1 py-0.5">
              <input
                autoFocus
                className="input py-1 text-sm"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameValue.trim()) {
                    onRenameFolder(f, renameValue.trim());
                    setRenaming(null);
                  }
                  if (e.key === 'Escape') setRenaming(null);
                }}
              />
            </li>
          ) : (
            <li key={f} className="group flex items-center justify-between rounded-md px-2.5 py-1.5 hover:bg-surface-alt">
              <button
                onClick={() => onSelectFolder(f)}
                className={`flex-1 truncate text-left text-sm ${activeFolder === f ? 'font-medium text-accent-800' : 'text-ink-soft'}`}
              >
                {f} <span className="text-xs">{countByFolder[f] ?? 0}</span>
              </button>
              <span className="hidden gap-1 group-hover:flex">
                <button
                  className="text-xs text-ink-soft hover:text-ink"
                  title="Rename folder"
                  onClick={() => {
                    setRenaming(f);
                    setRenameValue(f);
                  }}
                >
                  ✎
                </button>
                <button
                  className="text-xs text-ink-soft hover:text-red-700"
                  title="Delete folder"
                  onClick={() => onDeleteFolder(f)}
                >
                  ✕
                </button>
              </span>
            </li>
          ),
        )}
      </ul>
      <div className="mt-3 flex gap-1.5">
        <input
          className="input py-1 text-sm"
          placeholder="New folder"
          value={newFolder}
          onChange={(e) => setNewFolder(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <Button variant="secondary" className="px-2 py-1 text-xs" onClick={handleCreate}>
          Add
        </Button>
      </div>
    </div>
  );
}
