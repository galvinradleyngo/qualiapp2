import { useMemo, useState } from 'react';
import type { ArtifactFileRef, GlobalArtifact } from '../../data/types';
import { useProjectStore } from '../workspace/ProjectStore';
import { useFolderActions, UNCATEGORIZED } from '../workspace/folderActions';
import { FolderSidebar } from '../workspace/FolderSidebar';
import { Button } from '../../ui/Button';
import { Card, EmptyState } from '../../ui/Card';
import { Modal } from '../../ui/Modal';
import { fileGet, fileSet, type ProjectDB } from '../../storage/projectDb';
import { compressImageIfPossible } from './imageCompression';

const isPreviewable = (type: string, name: string) =>
  type.startsWith('image/') || type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function ArtifactsDashboard() {
  const { db, data, set } = useProjectStore();
  const folderActions = useFolderActions();
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);

  const countByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of data.globalArtifacts) counts[a.folder] = (counts[a.folder] ?? 0) + 1;
    return counts;
  }, [data.globalArtifacts]);

  const visible = useMemo(
    () => data.globalArtifacts.filter((a) => (activeFolder === null ? true : a.folder === activeFolder)),
    [data.globalArtifacts, activeFolder],
  );

  const addArtifact = async (fields: { name: string; folder: string; files: File[] }) => {
    const fileRefs: ArtifactFileRef[] = [];
    for (const file of fields.files) {
      const stored = await compressImageIfPossible(file);
      const id = newId();
      const key = `global_art_${id}`;
      await fileSet(db, key, stored, { name: stored.name, lastModified: stored.lastModified });
      fileRefs.push({ id, key, name: stored.name, type: stored.type, size: stored.size, lastModified: stored.lastModified });
    }
    const artifact: GlobalArtifact = {
      id: `${Date.now()}`,
      name: fields.name.trim() || fields.files[0]?.name || 'Artifact',
      type: fileRefs[0]?.type ?? '',
      date: new Date().toLocaleDateString(),
      notes: '',
      comments: '',
      codes: [],
      folder: fields.folder || UNCATEGORIZED,
      files: fileRefs,
    };
    const nextFolders = data.folders.includes(artifact.folder) ? data.folders : [...data.folders, artifact.folder];
    await Promise.all([set('globalArtifacts', [artifact, ...data.globalArtifacts]), set('folders', nextFolders)]);
    setShowUpload(false);
  };

  const deleteArtifact = async (id: string) => {
    if (!confirm('Delete this artifact and its files?')) return;
    const artifact = data.globalArtifacts.find((a) => a.id === id);
    for (const f of artifact?.files ?? []) await db.files.delete(f.key);
    await set(
      'globalArtifacts',
      data.globalArtifacts.filter((a) => a.id !== id),
    );
    setOpenArtifactId(null);
  };

  const updateArtifact = (id: string, patch: Partial<GlobalArtifact>) =>
    set(
      'globalArtifacts',
      data.globalArtifacts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );

  const openArtifact = data.globalArtifacts.find((a) => a.id === openArtifactId);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="app-title">Project Artifacts</h1>
          <p className="app-subtitle">Documents, images, and other files not tied to a specific transcript.</p>
        </div>
        <Button onClick={() => setShowUpload(true)}>Upload documents</Button>
      </div>

      <div className="flex gap-8">
        <FolderSidebar
          folders={data.folders}
          activeFolder={activeFolder}
          countByFolder={countByFolder}
          totalCount={data.globalArtifacts.length}
          onSelectFolder={setActiveFolder}
          onCreateFolder={folderActions.createFolder}
          onRenameFolder={folderActions.renameFolder}
          onDeleteFolder={folderActions.deleteFolder}
        />

        <div className="flex-1">
          {visible.length === 0 ? (
            <EmptyState title="No artifacts here" hint="Upload documents to get started." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((a) => (
                <Card key={a.id} className="cursor-pointer" onClick={() => setOpenArtifactId(a.id)}>
                  <p className="mb-1 truncate text-sm font-semibold text-ink">{a.name}</p>
                  <p className="mb-2 text-xs text-ink-soft">
                    {a.files.length} file{a.files.length === 1 ? '' : 's'} · {a.date}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <span className="badge bg-surface-alt">{a.folder}</span>
                    {a.codes.slice(0, 3).map((c) => (
                      <span key={c} className="badge bg-accent-50 text-accent-800">
                        {c}
                      </span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadModal folders={data.folders} onUpload={addArtifact} onClose={() => setShowUpload(false)} />
      )}

      {openArtifact && (
        <ArtifactDetailModal
          db={db}
          artifact={openArtifact}
          folders={data.folders}
          onClose={() => setOpenArtifactId(null)}
          onUpdate={(patch) => updateArtifact(openArtifact.id, patch)}
          onDelete={() => deleteArtifact(openArtifact.id)}
        />
      )}
    </div>
  );
}

function UploadModal({
  folders,
  onUpload,
  onClose,
}: {
  folders: string[];
  onUpload: (fields: { name: string; folder: string; files: File[] }) => void;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState('');
  const [folder, setFolder] = useState(folders[0] ?? UNCATEGORIZED);

  return (
    <Modal
      title="Upload documents"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onUpload({ name, folder, files })} disabled={files.length === 0}>
            Upload
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="field">
          <label htmlFor="artifact-files">Files</label>
          <input id="artifact-files" type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </div>
        <div className="field">
          <label htmlFor="artifact-name">Name</label>
          <input
            id="artifact-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={files[0]?.name ?? 'Artifact name'}
          />
        </div>
        <div className="field">
          <label htmlFor="artifact-folder">Folder</label>
          <input id="artifact-folder" list="artifact-folder-suggestions" className="input" value={folder} onChange={(e) => setFolder(e.target.value)} />
          <datalist id="artifact-folder-suggestions">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
      </div>
    </Modal>
  );
}

function ArtifactDetailModal({
  db,
  artifact,
  folders,
  onClose,
  onUpdate,
  onDelete,
}: {
  db: ProjectDB;
  artifact: GlobalArtifact;
  folders: string[];
  onClose: () => void;
  onUpdate: (patch: Partial<GlobalArtifact>) => void;
  onDelete: () => void;
}) {
  const [newCode, setNewCode] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewFile = artifact.files.find((f) => isPreviewable(f.type, f.name));

  useMemo(() => {
    if (!previewFile) return;
    void fileGet(db, previewFile.key).then((row) => {
      if (row) setPreviewUrl(URL.createObjectURL(row.blob));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewFile?.key]);

  const download = async (file: ArtifactFileRef) => {
    const row = await fileGet(db, file.key);
    if (!row) return;
    const url = URL.createObjectURL(row.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addCode = () => {
    const clean = newCode.trim();
    if (!clean || artifact.codes.includes(clean)) return;
    onUpdate({ codes: [...artifact.codes, clean] });
    setNewCode('');
  };

  return (
    <Modal title={artifact.name} onClose={onClose} width="lg">
      <div className="flex flex-col gap-4">
        {previewUrl && previewFile?.type.startsWith('image/') && <img src={previewUrl} alt={artifact.name} className="max-h-80 rounded-lg" />}
        {previewUrl && previewFile?.type === 'application/pdf' && <iframe src={previewUrl} title={artifact.name} className="h-80 w-full rounded-lg border border-border" />}

        <div className="field">
          <label htmlFor="artifact-name-edit">Name</label>
          <input id="artifact-name-edit" className="input" value={artifact.name} onChange={(e) => onUpdate({ name: e.target.value })} />
        </div>

        <div className="field">
          <label htmlFor="artifact-folder-edit">Folder</label>
          <input id="artifact-folder-edit" list="edit-folder-suggestions" className="input" value={artifact.folder} onChange={(e) => onUpdate({ folder: e.target.value })} />
          <datalist id="edit-folder-suggestions">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label htmlFor="artifact-notes">Notes</label>
          <textarea id="artifact-notes" className="textarea" value={artifact.notes} onChange={(e) => onUpdate({ notes: e.target.value })} />
        </div>

        <div className="field">
          <label htmlFor="artifact-comments">Comments</label>
          <textarea id="artifact-comments" className="textarea" value={artifact.comments} onChange={(e) => onUpdate({ comments: e.target.value })} />
        </div>

        <div className="field">
          <label>Codes</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {artifact.codes.map((c) => (
              <span key={c} className="badge bg-accent-50 text-accent-800">
                {c}
                <button className="ml-1" onClick={() => onUpdate({ codes: artifact.codes.filter((x) => x !== c) })}>
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input" value={newCode} onChange={(e) => setNewCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCode()} placeholder="Add a code…" />
            <Button variant="secondary" onClick={addCode}>
              Add
            </Button>
          </div>
        </div>

        <div className="field">
          <label>Files</label>
          <ul className="flex flex-col gap-1">
            {artifact.files.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm">
                <span className="truncate">{f.name}</span>
                <button className="link-btn" onClick={() => download(f)}>
                  Download
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="danger" onClick={onDelete}>
            Delete artifact
          </Button>
        </div>
      </div>
    </Modal>
  );
}
