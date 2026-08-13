import { useMemo, useState } from 'react';
import type { Observation } from '../../data/types';
import { useProjectStore } from '../workspace/ProjectStore';
import { useFolderActions, UNCATEGORIZED } from '../workspace/folderActions';
import { FolderSidebar } from '../workspace/FolderSidebar';
import { Button } from '../../ui/Button';
import { Card, EmptyState } from '../../ui/Card';
import { Modal } from '../../ui/Modal';
import { TextField } from '../../ui/TextField';

interface ObservationsDashboardProps {
  onOpenObservation: (id: string) => void;
}

export function ObservationsDashboard({ onOpenObservation }: ObservationsDashboardProps) {
  const { data, set } = useProjectStore();
  const folderActions = useFolderActions();
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const countByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of data.observations) counts[o.folder] = (counts[o.folder] ?? 0) + 1;
    return counts;
  }, [data.observations]);

  const visible = useMemo(
    () =>
      data.observations
        .filter((o) => (activeFolder === null ? true : o.folder === activeFolder))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.observations, activeFolder],
  );

  const handleCreate = async (fields: { title: string; location: string; date: string; folder: string }) => {
    const now = new Date().toISOString();
    const observation: Observation = {
      id: `${Date.now()}`,
      title: fields.title.trim() || 'Untitled observation',
      location: fields.location,
      date: fields.date,
      folder: fields.folder || UNCATEGORIZED,
      content: '',
      contentHtml: '',
      notes: '',
      hasAudio: false,
      audioFiles: [],
      bookmarks: [],
      createdAt: now,
    };
    const nextFolders = data.folders.includes(observation.folder) ? data.folders : [...data.folders, observation.folder];
    await Promise.all([set('observations', [observation, ...data.observations]), set('folders', nextFolders)]);
    setShowCreate(false);
    onOpenObservation(observation.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this observation and all its codes?')) return;
    await Promise.all([
      set(
        'observations',
        data.observations.filter((o) => o.id !== id),
      ),
      set(
        'observationTags',
        data.observationTags.filter((t) => t.observationId !== id),
      ),
    ]);
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="app-title">Onsite Observations</h1>
          <p className="app-subtitle">Field notes and observation records.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New observation</Button>
      </div>

      <div className="flex gap-8">
        <FolderSidebar
          folders={data.folders}
          activeFolder={activeFolder}
          countByFolder={countByFolder}
          totalCount={data.observations.length}
          onSelectFolder={setActiveFolder}
          onCreateFolder={folderActions.createFolder}
          onRenameFolder={folderActions.renameFolder}
          onDeleteFolder={folderActions.deleteFolder}
        />

        <div className="flex-1">
          {visible.length === 0 ? (
            <EmptyState title="No observations here" hint="Create one to start taking field notes." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visible.map((o) => (
                <Card key={o.id} className="cursor-pointer" onClick={() => onOpenObservation(o.id)}>
                  <p className="mb-1 text-sm font-semibold text-ink">{o.title}</p>
                  <p className="mb-2 text-xs text-ink-soft">
                    {o.location || 'No location'} {o.date && `· ${o.date}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="badge bg-surface-alt">{o.folder}</span>
                    {o.hasAudio && <span title="Has audio">🎧</span>}
                    <button className="ml-auto text-red-700 hover:text-red-800" onClick={(e) => { e.stopPropagation(); void handleDelete(o.id); }}>
                      Delete
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && <NewObservationModal folders={data.folders} onCreate={handleCreate} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function NewObservationModal({
  folders,
  onCreate,
  onClose,
}: {
  folders: string[];
  onCreate: (fields: { title: string; location: string; date: string; folder: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [folder, setFolder] = useState(folders[0] ?? UNCATEGORIZED);

  return (
    <Modal
      title="New observation"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onCreate({ title, location, date, folder })} disabled={!title.trim()}>
            Create
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Site visit — clinic waiting room" />
        <TextField label="Location / setting" value={location} onChange={(e) => setLocation(e.target.value)} />
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="field">
          <label htmlFor="obs-folder">Folder</label>
          <input id="obs-folder" list="obs-folder-suggestions" className="input" value={folder} onChange={(e) => setFolder(e.target.value)} />
          <datalist id="obs-folder-suggestions">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
      </div>
    </Modal>
  );
}
