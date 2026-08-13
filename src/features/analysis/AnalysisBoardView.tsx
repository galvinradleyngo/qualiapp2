import { useMemo, useState } from 'react';
import { useProjectStore } from '../workspace/ProjectStore';
import { useCanvasActions } from './canvasActions';
import { buildCodeDetails } from './codeDetails';
import { listSourceItems } from '../workspace/sourceItems';
import { useSourceSelection } from '../workspace/useSourceSelection';
import { SourceFilterPanel } from '../workspace/SourceFilterPanel';
import { AssignmentBoard } from './AssignmentBoard';
import { ConnectingStep } from './ConnectingStep';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { downloadCsv } from '../workspace/csvExport';
import { apaTableHtml, downloadWordDoc } from '../workspace/docExport';

interface AnalysisBoardViewProps {
  panelMode: 'analysis' | 'connecting';
  activeCanvasId: string | null;
  onActiveCanvasIdChange: (id: string | null) => void;
}

export function AnalysisBoardView({ panelMode, activeCanvasId, onActiveCanvasIdChange }: AnalysisBoardViewProps) {
  const { data, set } = useProjectStore();
  const actions = useCanvasActions();
  const items = useMemo(() => listSourceItems(data), [data]);
  const [selectedIds, setSelectedIds] = useSourceSelection(items);
  const [newCanvasName, setNewCanvasName] = useState('');
  const [step, setStep] = useState<'both' | 'step2' | 'step3'>('both');

  const canvas = data.analysisCanvases.find((c) => c.id === activeCanvasId) ?? null;
  const codeDetails = useMemo(() => buildCodeDetails(data, selectedIds), [data, selectedIds]);

  const handleCreate = async () => {
    if (!newCanvasName.trim()) return;
    const id = await actions.createCanvas(newCanvasName.trim());
    onActiveCanvasIdChange(id);
    setNewCanvasName('');
  };

  const clusteringRows = (c: NonNullable<typeof canvas>) =>
    c.categories.map((cat) => [cat.code, cat.name, cat.codes.join(', ') || '—', String(cat.codes.length)]);
  const thematicRows = (c: NonNullable<typeof canvas>) =>
    c.themes.map((t) => [t.name, t.categories.join(', ') || '—', String(t.categories.length)]);

  const exportClusteringCsv = () => {
    if (!canvas) return;
    downloadCsv(`${canvas.name}-clustering.csv`, [['Code', 'Category name', 'Assigned codes', 'Code count'], ...clusteringRows(canvas)]);
  };
  const exportClusteringDoc = () => {
    if (!canvas) return;
    downloadWordDoc(
      `${canvas.name}-clustering.doc`,
      apaTableHtml(1, `Clustering Table — ${canvas.name}`, ['Code', 'Category', 'Assigned Codes', 'Count'], clusteringRows(canvas)),
      'Clustering Table',
    );
  };
  const exportThematicCsv = () => {
    if (!canvas) return;
    downloadCsv(`${canvas.name}-thematic.csv`, [['Theme', 'Assigned categories', 'Category count'], ...thematicRows(canvas)]);
  };
  const exportThematicDoc = () => {
    if (!canvas) return;
    downloadWordDoc(
      `${canvas.name}-thematic.doc`,
      apaTableHtml(1, `Thematic Table — ${canvas.name}`, ['Theme', 'Assigned Categories', 'Count'], thematicRows(canvas)),
      'Thematic Table',
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="app-title">{panelMode === 'analysis' ? 'Analysis Canvas' : 'Connecting Analysis'}</h1>
        <p className="app-subtitle">
          {panelMode === 'analysis'
            ? 'Cluster in-vivo codes into categories, then group categories into themes.'
            : 'Decide how your categories relate to each other and visualize the resulting map.'}
        </p>
      </div>

      <div className="mb-4">
        <SourceFilterPanel
          items={items}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          presets={data.sourceFilterPresets}
          onSavePreset={(preset) => void set('sourceFilterPresets', [...data.sourceFilterPresets, preset])}
          onDeletePreset={(id) => void set('sourceFilterPresets', data.sourceFilterPresets.filter((p) => p.id !== id))}
        />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="select w-auto"
            value={activeCanvasId ?? ''}
            onChange={(e) => onActiveCanvasIdChange(e.target.value || null)}
          >
            <option value="">— Select a workspace —</option>
            {data.analysisCanvases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className="input w-56 py-1.5 text-sm"
            placeholder="New workspace name"
            value={newCanvasName}
            onChange={(e) => setNewCanvasName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button variant="secondary" onClick={handleCreate}>
            Create workspace
          </Button>
          {canvas && (
            <>
              <button
                className="link-btn"
                onClick={async () => {
                  const name = prompt('New workspace name for the copy:', `${canvas.name} copy`);
                  if (name) onActiveCanvasIdChange(await actions.duplicateCanvas(canvas.id, name));
                }}
              >
                Duplicate
              </button>
              <button
                className="link-btn"
                onClick={() => {
                  const name = prompt('Rename workspace:', canvas.name);
                  if (name) actions.renameCanvas(canvas.id, name);
                }}
              >
                Rename
              </button>
              <button
                className="text-sm text-red-700 hover:text-red-800"
                onClick={() => {
                  if (confirm(`Delete "${canvas.name}"? This cannot be undone.`)) {
                    actions.deleteCanvas(canvas.id);
                    onActiveCanvasIdChange(null);
                  }
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </Card>

      {!canvas ? (
        <p className="text-sm text-ink-soft">Create or select a workspace to start clustering.</p>
      ) : panelMode === 'analysis' ? (
        <>
          <div className="mb-4 flex gap-1 border-b border-border">
            {(['both', 'step2', 'step3'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStep(s)}
                className={`px-4 py-2 text-sm font-medium ${step === s ? 'border-b-2 border-accent-600 text-accent-800' : 'text-ink-soft hover:text-ink'}`}
              >
                {s === 'both' ? 'Both steps' : s === 'step2' ? 'Step 2: Clustering' : 'Step 3: Thematic'}
              </button>
            ))}
          </div>

          {(step === 'both' || step === 'step2') && (
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">Step 2 — Clustering</h2>
                <div className="flex gap-2">
                  <Button variant="secondary" className="px-3 py-1 text-xs" onClick={exportClusteringCsv} disabled={canvas.categories.length === 0}>
                    Export CSV
                  </Button>
                  <Button variant="secondary" className="px-3 py-1 text-xs" onClick={exportClusteringDoc} disabled={canvas.categories.length === 0}>
                    Export Word (.doc)
                  </Button>
                </div>
              </div>
              <AssignmentBoard
                unassignedTitle="Unassigned in-vivo codes"
                unassignedItems={Array.from(codeDetails.values()).map((d) => ({
                  key: d.name,
                  label: d.name,
                  meta: `${d.quoteCount} quote${d.quoteCount === 1 ? '' : 's'}${d.quotes[0] ? ` — "${d.quotes[0]}"` : ''}`,
                }))}
                groups={canvas.categories.map((c) => ({ id: c.id, name: `${c.code} ${c.name}`, items: c.codes.filter((code) => codeDetails.has(code)) }))}
                groupNounSingular="category"
                onAssign={(groupId, code) => actions.assignCodeToCategory(canvas.id, groupId, code)}
                onUnassign={(groupId, code) => actions.unassignCode(canvas.id, groupId, code)}
                onAddGroup={(name) => actions.addCategory(canvas.id, name)}
                onRemoveGroup={(id) => actions.removeCategory(canvas.id, id)}
                onRenameGroup={(id, name) => actions.renameCategory(canvas.id, id, name)}
              />
            </div>
          )}

          {(step === 'both' || step === 'step3') && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">Step 3 — Thematic Analysis</h2>
                <div className="flex gap-2">
                  <Button variant="secondary" className="px-3 py-1 text-xs" onClick={exportThematicCsv} disabled={canvas.themes.length === 0}>
                    Export CSV
                  </Button>
                  <Button variant="secondary" className="px-3 py-1 text-xs" onClick={exportThematicDoc} disabled={canvas.themes.length === 0}>
                    Export Word (.doc)
                  </Button>
                </div>
              </div>
              <AssignmentBoard
                unassignedTitle="Unassigned categories"
                unassignedItems={canvas.categories.map((c) => ({ key: c.name, label: `${c.code} ${c.name}`, meta: `${c.codes.length} code${c.codes.length === 1 ? '' : 's'}` }))}
                groups={canvas.themes.map((t) => ({ id: t.id, name: t.name, items: t.categories }))}
                groupNounSingular="theme"
                onAssign={(groupId, name) => actions.assignCategoryToTheme(canvas.id, groupId, name)}
                onUnassign={(groupId, name) => actions.unassignCategoryFromTheme(canvas.id, groupId, name)}
                onAddGroup={(name) => actions.addTheme(canvas.id, name)}
                onRemoveGroup={(id) => actions.removeTheme(canvas.id, id)}
                onRenameGroup={(id, name) => actions.renameTheme(canvas.id, id, name)}
              />
            </div>
          )}
        </>
      ) : (
        <ConnectingStep
          canvas={canvas}
          onSetConnection={(row, col, value) => actions.setConnection(canvas.id, row, col, value)}
          onSetRationale={(row, col, rationale) => actions.setConnectionRationale(canvas.id, row, col, rationale)}
          onSetNote={(code, note) => actions.setConnectionNote(canvas.id, code, note)}
        />
      )}
    </div>
  );
}
