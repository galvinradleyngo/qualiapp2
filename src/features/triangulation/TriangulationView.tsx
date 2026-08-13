import { useMemo, useState } from 'react';
import type { TriangulationSession } from '../../data/types';
import { useProjectStore } from '../workspace/ProjectStore';
import { downloadCsv } from '../workspace/csvExport';
import { apaTableHtml, downloadWordDoc } from '../workspace/docExport';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useToast } from '../../ui/Toast';
import { computeSessionStats } from './agreement';
import { importAssignmentAsNewProject } from './importAssignment';
import {
  buildAssignmentPackage,
  buildReturnPackage,
  computeProjectFingerprint,
  parseAssignmentPackage,
  parseReturnPackage,
} from './packages';

export function TriangulationView() {
  const { db, data, set } = useProjectStore();
  const { notify } = useToast();
  const [coderId, setCoderId] = useState('');
  const [threshold, setThreshold] = useState(0.5);
  const [busy, setBusy] = useState(false);

  const exportAssignment = async () => {
    setBusy(true);
    try {
      const blob = await buildAssignmentPackage(db, data);
      triggerDownload(blob, `QualiApp_Triangulation_Assignment_${new Date().toISOString().slice(0, 10)}.qtri`);
    } finally {
      setBusy(false);
    }
  };

  const importAssignment = async (file: File) => {
    setBusy(true);
    try {
      const pkg = await parseAssignmentPackage(file);
      const title = prompt('Name this new project (it will hold the blinded copy to code independently):', 'Co-rater copy');
      if (!title) return;
      const project = await importAssignmentAsNewProject(pkg, title);
      notify(`Created project "${project.title}". Close this project and open it to start coding.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not read that assignment package.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportReturn = async () => {
    if (!data.triangulationAssignmentMeta) {
      notify('Import a triangulation assignment package first.', 'error');
      return;
    }
    if (!coderId.trim()) return;
    setBusy(true);
    try {
      const blob = await buildReturnPackage(data, data.triangulationAssignmentMeta, coderId);
      triggerDownload(blob, `QualiApp_Triangulation_Return_${coderId.trim()}_${new Date().toISOString().slice(0, 10)}.qtrr`);
    } finally {
      setBusy(false);
    }
  };

  const importReturn = async (file: File) => {
    setBusy(true);
    try {
      const pkg = await parseReturnPackage(file);
      const currentFingerprint = await computeProjectFingerprint(data);
      if (pkg.projectFingerprint !== currentFingerprint) {
        if (!confirm('Project fingerprint differs from this workspace. Import anyway?')) return;
      }
      const isDuplicate = data.triangulationSessions.some((s) => s.packageId === pkg.packageId && s.coderId === pkg.coderId);
      if (isDuplicate) {
        notify('This co-rater submission is already imported.', 'error');
        return;
      }
      const session: TriangulationSession = {
        id: `session_${Date.now()}`,
        coderId: pkg.coderId,
        packageId: pkg.packageId,
        projectFingerprint: pkg.projectFingerprint,
        importedAt: new Date().toISOString(),
        tags: pkg.tags,
        artifactCodes: pkg.artifactCodes,
        analysisCanvases: pkg.analysisCanvases,
      };
      await set('triangulationSessions', [session, ...data.triangulationSessions]);
      notify(`Imported ${pkg.coderId}'s return package.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not read that return package.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const sessionStats = useMemo(
    () => data.triangulationSessions.map((s) => ({ session: s, stats: computeSessionStats(data.tags, data.analysisCanvases, data.globalArtifacts, s, threshold) })),
    [data.triangulationSessions, data.tags, data.analysisCanvases, data.globalArtifacts, threshold],
  );

  const agreementRows = () =>
    sessionStats.map(({ session, stats }) => [
      session.coderId,
      session.importedAt,
      String(stats.agreementPct),
      String(session.tags.length),
      String(stats.matched),
      String(stats.primaryOnly),
      String(stats.coOnly),
      String(stats.sharedThemes),
      String(stats.sharedArtifactCodes),
    ]);
  const agreementHeaders = ['Coder', 'Imported at', 'Agreement %', 'Co-rater tags', 'Matched', 'Primary only', 'Co-rater only', 'Shared themes', 'Shared artifact codes'];

  const exportCsv = () => {
    downloadCsv('triangulation-agreement.csv', [agreementHeaders, ...agreementRows()]);
  };

  const exportDoc = () => {
    downloadWordDoc(
      'triangulation-agreement.doc',
      apaTableHtml(1, 'Triangulation Agreement Summary', agreementHeaders, agreementRows(), 'Overlap Agreement % is a heuristic metric for calibration only; it is not a formal chance-corrected inter-rater reliability statistic.'),
      'Triangulation Agreement',
    );
  };

  return (
    <div>
      <h1 className="app-title">Triangulation</h1>
      <p className="app-subtitle mb-6">Hand off a blinded copy of your project to a second coder, then compare their coding to yours.</p>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Main researcher">
          <p className="mb-3 text-sm text-ink-soft">Export a blinded copy (no codes/themes) for a second coder.</p>
          <Button variant="secondary" disabled={busy} onClick={exportAssignment}>
            Export co-rater assignment
          </Button>
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-sm text-ink-soft">Import a co-rater's completed return package.</p>
            <input type="file" accept=".qtrr,.json" onChange={(e) => e.target.files?.[0] && importReturn(e.target.files[0])} />
          </div>
        </Card>

        <Card title="Co-rater workflow">
          <p className="mb-2 text-sm text-ink-soft">Import an assignment package — it becomes a new project you code independently.</p>
          <input type="file" accept=".qtri,.json" onChange={(e) => e.target.files?.[0] && importAssignment(e.target.files[0])} />
          <div className="mt-4 border-t border-border pt-4">
            <div className="field mb-3">
              <label htmlFor="coder-id">Coder ID</label>
              <input id="coder-id" className="input" value={coderId} onChange={(e) => setCoderId(e.target.value)} placeholder="e.g. RA2" />
            </div>
            <Button variant="secondary" disabled={busy || !coderId.trim()} onClick={exportReturn}>
              Export my return package
            </Button>
            {data.triangulationAssignmentMeta && (
              <p className="mt-2 text-xs text-ink-soft">Current assignment: {data.triangulationAssignmentMeta.packageId}</p>
            )}
          </div>
        </Card>
      </div>

      <Card
        title="Agreement analysis"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportCsv} disabled={sessionStats.length === 0}>
              Export CSV
            </Button>
            <Button variant="secondary" onClick={exportDoc} disabled={sessionStats.length === 0}>
              Export Word (.doc)
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex items-center gap-3">
          <label htmlFor="threshold" className="text-sm text-ink-soft">
            Overlap agreement threshold
          </label>
          <input
            id="threshold"
            type="number"
            min={0.1}
            max={1}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="input w-24 py-1"
          />
        </div>
        <p className="mb-4 text-xs text-ink-soft">
          Heuristic metric for calibration only — not a formal chance-corrected inter-rater reliability statistic.
        </p>
        {sessionStats.length === 0 ? (
          <p className="text-sm text-ink-soft">No co-rater returns imported yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sessionStats.map(({ session, stats }) => (
              <div key={session.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-ink">{session.coderId}</span>
                  <span className="text-xs text-ink-soft">{new Date(session.importedAt).toLocaleString()}</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-soft">
                  <dt>Overlap agreement</dt>
                  <dd className="text-right font-medium text-ink">{stats.agreementPct}%</dd>
                  <dt>Co-rater tags</dt>
                  <dd className="text-right">{session.tags.length}</dd>
                  <dt>Matched</dt>
                  <dd className="text-right">{stats.matched}</dd>
                  <dt>Primary-only</dt>
                  <dd className="text-right">{stats.primaryOnly}</dd>
                  <dt>Co-rater-only</dt>
                  <dd className="text-right">{stats.coOnly}</dd>
                  <dt>Shared themes</dt>
                  <dd className="text-right">
                    {stats.sharedThemes} ({stats.primaryThemeCount}/{stats.coThemeCount})
                  </dd>
                  <dt>Shared artifact codes</dt>
                  <dd className="text-right">{stats.sharedArtifactCodes}</dd>
                </dl>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
