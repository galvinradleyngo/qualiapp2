import { useState } from 'react';
import { importLegacyBackup } from '../../backup/importLegacy';
import type { ProjectRecord } from '../../storage/registry';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/TextField';

interface ImportBackupDialogProps {
  onImported: (project: ProjectRecord) => void;
  onCancel: () => void;
}

const suggestTitleFromFileName = (fileName: string): string =>
  fileName.replace(/\.qbk$/i, '').replace(/^QualiApp_Backup_/i, '').replace(/[_-]+/g, ' ').trim() ||
  'Imported project';

export function ImportBackupDialog({ onImported, onCancel }: ImportBackupDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [status, setStatus] = useState<{ step: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFileChange = (f: File | null) => {
    setFile(f);
    if (f && !projectTitle) setProjectTitle(suggestTitleFromFileName(f.name));
  };

  const handleImport = async () => {
    if (!file || !projectTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const project = await importLegacyBackup({
        file,
        password,
        projectTitle,
        onProgress: (step, pct) => setStatus({ step, pct }),
      });
      onImported(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that backup file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="app-title">Import backup</h1>
      <p className="app-subtitle mb-6">This creates a new project — it never overwrites an existing one.</p>

      <Card>
        <div className="field mb-4">
          <label htmlFor="qbk-file">Backup file (.qbk)</label>
          <input
            id="qbk-file"
            type="file"
            accept=".qbk"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-ink/90"
          />
        </div>

        <div className="mb-4">
          <TextField
            label="Backup password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password used when the backup was created"
          />
        </div>

        <div className="mb-5">
          <TextField
            label="New project title"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="e.g. Fall 2025 Interviews"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
        {status && !error && (
          <div className="mb-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
              <div className="h-full rounded-full bg-accent-600 transition-all" style={{ width: `${status.pct}%` }} />
            </div>
            <p className="mt-1.5 text-sm text-ink-soft">
              {status.step} ({status.pct}%)
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleImport} disabled={busy || !file || !projectTitle.trim()}>
            {busy ? 'Importing…' : 'Import'}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
