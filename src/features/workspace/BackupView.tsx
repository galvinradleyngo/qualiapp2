import { useState } from 'react';
import { decodeProjectBackup, encodeProjectBackup } from '../../backup/format';
import { useProjectStore } from './ProjectStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { TextField } from '../../ui/TextField';
import { fileSet } from '../../storage/projectDb';
import { useToast } from '../../ui/Toast';
import { EMPTY_PROJECT_DATA, type ProjectData } from '../../data/types';

const pluralize = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

export function BackupView({ projectTitle }: { projectTitle: string }) {
  const { db, data, set } = useProjectStore();
  const { notify } = useToast();
  const [exportPassword, setExportPassword] = useState('');
  const [exportStatus, setExportStatus] = useState<{ step: string; pct: number } | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<{ step: string; pct: number } | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!exportPassword) return;
    setExportBusy(true);
    try {
      const blob = await encodeProjectBackup(projectTitle, db, exportPassword, (step, pct) => setExportStatus({ step, pct }));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectTitle.replace(/[^\w -]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.qbk2`;
      a.click();
      URL.revokeObjectURL(url);
      notify('Backup downloaded.', 'success');
    } finally {
      setExportBusy(false);
      setExportStatus(null);
      setExportPassword('');
    }
  };

  const handleRestore = async () => {
    if (!restoreFile || !restorePassword) return;
    if (!confirm(`This replaces every transcript, code, artifact, observation, and participant currently in "${projectTitle}" with the backup's contents. Continue?`)) return;
    setRestoreBusy(true);
    setRestoreError(null);
    try {
      const decoded = await decodeProjectBackup(restoreFile, restorePassword, (step, pct) => setRestoreStatus({ step, pct }));
      const nextData: ProjectData = { ...EMPTY_PROJECT_DATA, ...decoded.data };
      for (const [key, value] of Object.entries(nextData)) {
        await set(key as keyof ProjectData, value as never);
      }
      await db.files.clear();
      for (const f of decoded.files) {
        const blob = f.name
          ? new File([f.bytes as BlobPart], f.name, { type: f.type || 'application/octet-stream', lastModified: f.lastModified ?? Date.now() })
          : new Blob([f.bytes as BlobPart], { type: f.type || 'application/octet-stream' });
        await fileSet(db, f.key, blob, { name: f.name, lastModified: f.lastModified });
      }
      notify('Project restored from backup.', 'success');
      setRestoreFile(null);
      setRestorePassword('');
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Could not read that backup file.');
    } finally {
      setRestoreBusy(false);
      setRestoreStatus(null);
    }
  };

  const dataSummary = [
    pluralize(data.transcripts.length, 'transcript'),
    pluralize(data.tags.length, 'code'),
    pluralize(data.globalArtifacts.length, 'artifact'),
    pluralize(data.observations.length, 'observation'),
    pluralize(data.participants.length, 'participant'),
    pluralize(data.analysisCanvases.length, 'analysis workspace'),
  ].join(' · ');

  return (
    <div>
      <h1 className="app-title">Backup & Restore</h1>
      <p className="app-subtitle mb-6">Encrypted, password-protected snapshots of this project — transcripts, codes, files, and all.</p>

      <Card title="Export a backup" className="mb-6">
        <p className="mb-3 text-xs text-ink-soft">{dataSummary}</p>
        <div className="mb-4 max-w-sm">
          <TextField id="export-password" label="Backup password" type="password" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} />
        </div>
        {exportStatus && (
          <p className="mb-3 text-sm text-ink-soft">
            {exportStatus.step} ({exportStatus.pct}%)
          </p>
        )}
        <Button onClick={handleExport} disabled={exportBusy || !exportPassword}>
          {exportBusy ? 'Exporting…' : 'Download backup'}
        </Button>
      </Card>

      <Card title="Restore from a backup">
        <p className="mb-3 text-sm text-red-700">This overwrites everything currently in this project. Export a backup first if you want to keep it.</p>
        <div className="mb-4">
          <input type="file" accept=".qbk2" onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="mb-4 max-w-sm">
          <TextField id="restore-password" label="Backup password" type="password" value={restorePassword} onChange={(e) => setRestorePassword(e.target.value)} />
        </div>
        {restoreError && <p className="mb-3 text-sm text-red-700">{restoreError}</p>}
        {restoreStatus && (
          <p className="mb-3 text-sm text-ink-soft">
            {restoreStatus.step} ({restoreStatus.pct}%)
          </p>
        )}
        <Button variant="danger" onClick={handleRestore} disabled={restoreBusy || !restoreFile || !restorePassword}>
          {restoreBusy ? 'Restoring…' : 'Restore backup'}
        </Button>
      </Card>
    </div>
  );
}
