import { useMemo, useState } from 'react';
import type { Transcript } from '../../data/types';
import { useProjectStore } from '../workspace/ProjectStore';
import { useFolderActions, UNCATEGORIZED } from '../workspace/folderActions';
import { FolderSidebar } from '../workspace/FolderSidebar';
import { Button } from '../../ui/Button';
import { Card, EmptyState } from '../../ui/Card';
import { Modal } from '../../ui/Modal';
import { TextField } from '../../ui/TextField';
import { useToast } from '../../ui/Toast';

interface TranscriptsDashboardProps {
  onOpenTranscript: (id: string) => void;
}

export function TranscriptsDashboard({ onOpenTranscript }: TranscriptsDashboardProps) {
  const { data, set } = useProjectStore();
  const folderActions = useFolderActions();
  const { notify } = useToast();
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const countByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of data.transcripts) counts[t.folder] = (counts[t.folder] ?? 0) + 1;
    return counts;
  }, [data.transcripts]);

  const visible = useMemo(() => {
    return data.transcripts
      .filter((t) => (activeFolder === null ? true : t.folder === activeFolder))
      .filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data.transcripts, activeFolder, search]);

  const handleCreate = async (fields: { title: string; folder: string; participantId: string | null }) => {
    const now = new Date().toISOString();
    const transcript: Transcript = {
      id: `${Date.now()}`,
      title: fields.title.trim() || 'Untitled transcript',
      folder: fields.folder || UNCATEGORIZED,
      modality: '',
      content: '',
      contentHtml: '',
      notes: '',
      hasAudio: false,
      audioFiles: [],
      bookmarks: [],
      participantId: fields.participantId,
      createdAt: now,
      activityLog: [{ id: `${Date.now()}`, type: 'Created', note: 'Transcript initialized', timestamp: now }],
    };
    const nextFolders = data.folders.includes(transcript.folder) ? data.folders : [...data.folders, transcript.folder];
    await Promise.all([set('transcripts', [transcript, ...data.transcripts]), set('folders', nextFolders)]);
    setShowCreate(false);
    onOpenTranscript(transcript.id);
  };

  const handleRename = async (id: string, title: string) => {
    await set(
      'transcripts',
      data.transcripts.map((t) => (t.id === id ? { ...t, title } : t)),
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transcript and all its codes?')) return;
    await Promise.all([
      set(
        'transcripts',
        data.transcripts.filter((t) => t.id !== id),
      ),
      set(
        'tags',
        data.tags.filter((t) => t.transcriptId !== id),
      ),
    ]);
    notify('Transcript deleted.');
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="app-title">Transcripts</h1>
          <p className="app-subtitle">Interview and focus-group transcripts, organized into folders.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New transcript</Button>
      </div>

      <div className="flex gap-8">
        <FolderSidebar
          folders={data.folders}
          activeFolder={activeFolder}
          countByFolder={countByFolder}
          totalCount={data.transcripts.length}
          onSelectFolder={setActiveFolder}
          onCreateFolder={folderActions.createFolder}
          onRenameFolder={folderActions.renameFolder}
          onDeleteFolder={folderActions.deleteFolder}
        />

        <div className="flex-1">
          <input
            className="input mb-4 max-w-sm"
            placeholder="Search transcripts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {visible.length === 0 ? (
            <EmptyState title="No transcripts here" hint="Create a new transcript to get started." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visible.map((t) => (
                <TranscriptCard
                  key={t.id}
                  transcript={t}
                  folders={data.folders}
                  participantPseudonym={data.participants.find((p) => p.id === t.participantId)?.pseudonym}
                  onOpen={() => onOpenTranscript(t.id)}
                  onRename={(title) => handleRename(t.id, title)}
                  onMove={(folder) => folderActions.moveTranscriptToFolder(t.id, folder)}
                  onDelete={() => handleDelete(t.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <NewTranscriptModal
          folders={data.folders}
          participants={data.participants}
          onCreate={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function TranscriptCard({
  transcript,
  folders,
  participantPseudonym,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: {
  transcript: Transcript;
  folders: string[];
  participantPseudonym?: string;
  onOpen: () => void;
  onRename: (title: string) => void;
  onMove: (folder: string) => void;
  onDelete: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(transcript.title);

  return (
    <Card className="flex flex-col gap-2">
      {editingTitle ? (
        <input
          autoFocus
          className="input text-sm font-semibold"
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={() => {
            setEditingTitle(false);
            if (titleValue.trim()) onRename(titleValue.trim());
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <button className="text-left text-sm font-semibold text-ink hover:underline" onClick={onOpen}>
          {transcript.title}
        </button>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
        <span className="badge bg-surface-alt">{transcript.folder}</span>
        {transcript.modality && <span className="badge bg-surface-alt capitalize">{transcript.modality}</span>}
        {participantPseudonym && <span className="badge bg-surface-alt">{participantPseudonym}</span>}
        {transcript.hasAudio && <span title="Has audio">🎧</span>}
        {transcript.activityLog.length > 1 && <span>{transcript.activityLog.length} logs</span>}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <select
          className="select w-auto py-1 text-xs"
          value={transcript.folder}
          onChange={(e) => onMove(e.target.value)}
        >
          {Array.from(new Set([transcript.folder, ...folders])).map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button className="text-xs text-ink-soft hover:text-ink" onClick={() => setEditingTitle(true)}>
            Rename
          </button>
          <button className="text-xs text-red-700 hover:text-red-800" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </Card>
  );
}

function NewTranscriptModal({
  folders,
  participants,
  onCreate,
  onClose,
}: {
  folders: string[];
  participants: { id: string; pseudonym: string }[];
  onCreate: (fields: { title: string; folder: string; participantId: string | null }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState(folders[0] ?? UNCATEGORIZED);
  const [participantId, setParticipantId] = useState('');

  return (
    <Modal
      title="New transcript"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onCreate({ title, folder, participantId: participantId || null })} disabled={!title.trim()}>
            Create
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Interview 01" />
        <div className="field">
          <label htmlFor="new-folder">Folder</label>
          <input id="new-folder" list="folder-suggestions" className="input" value={folder} onChange={(e) => setFolder(e.target.value)} />
          <datalist id="folder-suggestions">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        {participants.length > 0 && (
          <div className="field">
            <label htmlFor="new-participant">Participant</label>
            <select id="new-participant" className="select" value={participantId} onChange={(e) => setParticipantId(e.target.value)}>
              <option value="">— None —</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pseudonym}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}
