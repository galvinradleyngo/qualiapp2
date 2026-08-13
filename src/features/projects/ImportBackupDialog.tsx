import { useState } from 'react';
import { importLegacyBackup } from '../../backup/importLegacy';
import type { ProjectRecord } from '../../storage/registry';

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
    <div>
      <h1 className="app-title">Import backup</h1>
      <p className="app-subtitle">This creates a new project — it never overwrites an existing one.</p>

      <div className="panel">
        <div className="field">
          <label htmlFor="qbk-file">Backup file (.qbk)</label>
          <input
            id="qbk-file"
            type="file"
            accept=".qbk"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="field">
          <label htmlFor="qbk-password">Backup password</label>
          <input
            id="qbk-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password used when the backup was created"
          />
        </div>

        <div className="field">
          <label htmlFor="qbk-title">New project title</label>
          <input
            id="qbk-title"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="e.g. Fall 2025 Interviews"
          />
        </div>

        {error && <p className="error-text">{error}</p>}
        {status && !error && (
          <p className="progress-text">
            {status.step} ({status.pct}%)
          </p>
        )}

        <div className="btn-row" style={{ marginTop: '0.5rem' }}>
          <button className="btn" onClick={handleImport} disabled={busy || !file || !projectTitle.trim()}>
            {busy ? 'Importing…' : 'Import'}
          </button>
          <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
