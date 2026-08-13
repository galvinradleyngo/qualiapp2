import { useMemo, useRef, useState } from 'react';
import type { AnalysisCanvas, ConnectionRationale } from '../../data/types';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Modal } from '../../ui/Modal';
import { downloadCsv } from '../workspace/csvExport';
import { apaFigureHtml, apaTableHtml, downloadWordDoc } from '../workspace/docExport';
import { computeForceDirectedLayout, degreeTier, RATIONALE_STYLES, TIER_COLORS } from './forceLayout';
import { renderSvgToPngDataUrl } from './svgToPng';

interface ConnectingStepProps {
  canvas: AnalysisCanvas;
  onSetConnection: (rowCode: string, colCode: string, value: 0 | 1) => void;
  onSetRationale: (rowCode: string, colCode: string, rationale: ConnectionRationale) => void;
  onSetNote: (categoryCode: string, note: string) => void;
  onCreateTheme: (name: string, categoryNames: string[], explanation?: string) => void;
  onRenameTheme: (themeId: string, name: string) => void;
  onSetThemeExplanation: (themeId: string, explanation: string) => void;
  onRemoveTheme: (themeId: string) => void;
}

const RATIONALE_LABELS: Record<'A' | 'B' | 'C', string> = {
  A: 'A — Specificity (one is a more specific instance of the other)',
  B: 'B — Part-whole (one is a component of the other)',
  C: 'C — Conditional (one tends to occur under conditions set by the other)',
};

export function ConnectingStep({
  canvas,
  onSetConnection,
  onSetRationale,
  onSetNote,
  onCreateTheme,
  onRenameTheme,
  onSetThemeExplanation,
  onRemoveTheme,
}: ConnectingStepProps) {
  const categories = canvas.categories;
  const pairs = useMemo(() => {
    const out: Array<[string, string]> = [];
    for (let i = 0; i < categories.length; i++) {
      for (let j = i + 1; j < categories.length; j++) out.push([categories[i]!.code, categories[j]!.code]);
    }
    return out;
  }, [categories]);

  const [pairIndex, setPairIndex] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [popupName, setPopupName] = useState('');
  const [popupExplanation, setPopupExplanation] = useState('');
  const [newThemeName, setNewThemeName] = useState('');
  const [exportingFigure, setExportingFigure] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const openNode = (code: string) => {
    setSelectedNode(code);
    setPopupName('');
    setPopupExplanation('');
  };

  const answeredCount = pairs.filter(([a, b]) => canvas.connections[a]?.[b] !== undefined).length;
  const progress = Math.round((answeredCount / pairs.length) * 100);
  const currentPair = pairs[Math.min(pairIndex, pairs.length - 1)];
  const catByCode = new Map(categories.map((c) => [c.code, c]));

  const currentValue = currentPair ? canvas.connections[currentPair[0]]?.[currentPair[1]] : undefined;
  const currentRationale = currentPair ? canvas.connectionRationales[currentPair[0]]?.[currentPair[1]] ?? '' : '';

  const matrixRows = () => {
    const header = ['', ...categories.map((c) => c.code)];
    const rows = categories.map((row) => [row.code, ...categories.map((col) => String(row.code === col.code ? 1 : canvas.connections[row.code]?.[col.code] ?? ''))]);
    return { header, rows };
  };

  const exportMatrixCsv = () => {
    const { header, rows } = matrixRows();
    downloadCsv(`${canvas.name}-connecting-matrix.csv`, [header, ...rows]);
  };

  const exportMatrixDoc = () => {
    const { header, rows } = matrixRows();
    downloadWordDoc(
      `${canvas.name}-connecting-matrix.doc`,
      apaTableHtml(1, `Connecting Matrix — ${canvas.name}`, header, rows, 'Cell values: 1 = connected, 0 = not connected, blank = not yet reviewed.'),
      'Connecting Matrix',
    );
  };

  const narrativeRows = () =>
    categories.map((cat) => {
      const connected = Object.entries(canvas.connections[cat.code] ?? {})
        .filter(([, v]) => v === 1)
        .map(([code]) => code);
      return [cat.code, cat.name, connected.join(', ') || '—', canvas.connectionNotes[cat.code] || '—'];
    });

  const exportNarrativeCsv = () => {
    downloadCsv(`${canvas.name}-narrative.csv`, [['Code', 'Category', 'Connected to', 'Notes'], ...narrativeRows()]);
  };

  const exportNarrativeDoc = () => {
    downloadWordDoc(
      `${canvas.name}-narrative.doc`,
      apaTableHtml(2, `Narrative Table — ${canvas.name}`, ['Code', 'Category', 'Connected To', 'Notes'], narrativeRows()),
      'Narrative Table',
    );
  };

  const themeRows = () => canvas.themes.map((t) => [t.name, t.categories.join(', ') || '—', t.explanation || '—']);

  const exportThemesCsv = () => {
    downloadCsv(`${canvas.name}-themes.csv`, [['Theme', 'Categories', 'Explanation'], ...themeRows()]);
  };

  const exportThemesDoc = () => {
    downloadWordDoc(
      `${canvas.name}-themes.doc`,
      apaTableHtml(1, `Themes — ${canvas.name}`, ['Theme', 'Categories', 'Explanation'], themeRows()),
      'Themes',
    );
  };

  const handleAddTheme = () => {
    if (!newThemeName.trim()) return;
    onCreateTheme(newThemeName, []);
    setNewThemeName('');
  };

  const exportFigureDoc = async () => {
    if (!svgRef.current) return;
    setExportingFigure(true);
    try {
      const pngDataUrl = await renderSvgToPngDataUrl(svgRef.current);
      downloadWordDoc(
        `${canvas.name}-relational-map.doc`,
        apaFigureHtml(1, `Relational Map — ${canvas.name}`, pngDataUrl, 'Node color reflects connectivity tier; edge style reflects connection rationale.'),
        'Relational Map',
      );
    } finally {
      setExportingFigure(false);
    }
  };

  const edges = categories.flatMap((a) =>
    categories.filter((b) => b.code > a.code && canvas.connections[a.code]?.[b.code] === 1).map((b) => ({ source: a.code, target: b.code })),
  );
  const degree = new Map(categories.map((c) => [c.code, edges.filter((e) => e.source === c.code || e.target === c.code).length]));
  const maxDegree = Math.max(1, ...Array.from(degree.values()));

  const connectedToSelected = new Set<string>();
  if (selectedNode) {
    for (const e of edges) {
      if (e.source === selectedNode) connectedToSelected.add(e.target);
      if (e.target === selectedNode) connectedToSelected.add(e.source);
    }
  }
  const selectedConnectedNames = Array.from(connectedToSelected).map((code) => catByCode.get(code)?.name ?? code);
  const selectedClusterNames = selectedNode
    ? [catByCode.get(selectedNode)?.name ?? selectedNode, ...selectedConnectedNames]
    : [];

  const handleSaveTheme = () => {
    if (!selectedNode) return;
    onCreateTheme(popupName, selectedClusterNames, popupExplanation.trim() || undefined);
    setSelectedNode(null);
  };

  const layout = useMemo(
    () => (showMap ? computeForceDirectedLayout(categories.map((c) => c.code), edges, 640, 420) : new Map()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showMap, canvas.id, categories.length, edges.length],
  );

  if (categories.length < 2) {
    return <p className="text-sm text-ink-soft">Create at least two categories in Step 2 before connecting them.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Guided connection prompt">
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
          <div className="h-full rounded-full bg-accent-600" style={{ width: `${progress}%` }} />
        </div>
        <p className="mb-4 text-sm text-ink-soft">
          {answeredCount}/{pairs.length} pairs reviewed
        </p>
        {currentPair && (
          <>
            <p className="mb-3 text-base font-medium text-ink">
              Is <strong>{catByCode.get(currentPair[0])?.name}</strong> connected to <strong>{catByCode.get(currentPair[1])?.name}</strong>?
            </p>
            <div className="mb-4 flex gap-2">
              <Button variant={currentValue === 1 ? 'accent' : 'secondary'} onClick={() => onSetConnection(currentPair[0], currentPair[1], 1)}>
                Yes
              </Button>
              <Button variant={currentValue === 0 ? 'accent' : 'secondary'} onClick={() => onSetConnection(currentPair[0], currentPair[1], 0)}>
                No
              </Button>
            </div>
            {currentValue === 1 && (
              <div className="mb-4 flex flex-col gap-1.5">
                {(['A', 'B', 'C'] as const).map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="radio"
                      name="rationale"
                      checked={currentRationale === r}
                      onChange={() => onSetRationale(currentPair[0], currentPair[1], r)}
                    />
                    {RATIONALE_LABELS[r]}
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPairIndex((i) => Math.max(0, i - 1))} disabled={pairIndex === 0}>
                Previous
              </Button>
              <Button variant="secondary" onClick={() => setPairIndex((i) => Math.min(pairs.length - 1, i + 1))} disabled={pairIndex >= pairs.length - 1}>
                Next
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card
        title="One-mode network table"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={exportMatrixCsv}>
              Export CSV
            </Button>
            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={exportMatrixDoc}>
              Export Word (.doc)
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1" />
                {categories.map((c) => (
                  <th key={c.code} className="px-2 py-1 text-xs text-ink-soft">
                    {c.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((row) => (
                <tr key={row.code}>
                  <th className="px-2 py-1 text-left text-xs text-ink-soft">{row.code}</th>
                  {categories.map((col) => {
                    const isDiagonal = row.code === col.code;
                    const value = isDiagonal ? 1 : (canvas.connections[row.code]?.[col.code] ?? null);
                    return (
                      <td key={col.code} className="px-1 py-1 text-center">
                        <button
                          disabled={isDiagonal}
                          className={`h-7 w-7 rounded text-xs font-medium ${
                            isDiagonal ? 'bg-surface-alt text-ink-soft' : value === 1 ? 'bg-accent-600 text-white' : value === 0 ? 'bg-surface-alt text-ink-soft' : 'bg-white text-ink-soft border border-border'
                          }`}
                          onClick={() => {
                            const idx = pairs.findIndex(([a, b]) => (a === row.code && b === col.code) || (a === col.code && b === row.code));
                            if (idx >= 0) setPairIndex(idx);
                          }}
                        >
                          {isDiagonal ? '—' : (value ?? '')}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Narrative table (optional, per category)"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={exportNarrativeCsv}>
              Export CSV
            </Button>
            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={exportNarrativeDoc}>
              Export Word (.doc)
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-xs text-ink-soft">
          Jot working notes per category as you go, if useful — a written narrative is not required for every
          category. The theme-level explanation you write below, in Themes, is what the analysis actually needs.
        </p>
        <div className="flex flex-col gap-3">
          {categories.map((cat) => {
            const connectedCodes = Object.entries(canvas.connections[cat.code] ?? {}).filter(([, v]) => v === 1).map(([code]) => code);
            return (
              <div key={cat.code} className="rounded-lg border border-border p-3">
                <p className="mb-1 text-sm font-semibold text-ink">
                  {cat.code}: {cat.name}
                </p>
                <p className="mb-2 text-xs text-ink-soft">
                  Connected to: {connectedCodes.length ? connectedCodes.join(', ') : 'none yet'}
                </p>
                <textarea
                  className="textarea text-xs"
                  placeholder="Narrative notes for this category…"
                  value={canvas.connectionNotes[cat.code] ?? ''}
                  onChange={(e) => onSetNote(cat.code, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Relational map"
        actions={
          showMap && (
            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={exportFigureDoc} disabled={exportingFigure}>
              {exportingFigure ? 'Exporting…' : 'Export figure (.doc)'}
            </Button>
          )
        }
      >
        {!showMap ? (
          <Button variant="secondary" onClick={() => setShowMap(true)}>
            Visualize connections
          </Button>
        ) : (
          <svg ref={svgRef} width={640} height={420} className="max-w-full rounded-lg border border-border bg-white">
            {edges.map((e, i) => {
              const a = layout.get(e.source);
              const b = layout.get(e.target);
              if (!a || !b) return null;
              const rationale = canvas.connectionRationales[e.source]?.[e.target] ?? '';
              const style = RATIONALE_STYLES[rationale];
              const dimmed = selectedNode !== null && e.source !== selectedNode && e.target !== selectedNode;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={style.color}
                  strokeDasharray={style.dash}
                  strokeWidth={1.5}
                  opacity={dimmed ? 0.12 : 1}
                />
              );
            })}
            {categories.map((c) => {
              const pos = layout.get(c.code);
              if (!pos) return null;
              const tier = degreeTier(degree.get(c.code) ?? 0, maxDegree);
              const isFocused = selectedNode === null || c.code === selectedNode || connectedToSelected.has(c.code);
              return (
                <g key={c.code} onClick={() => openNode(c.code)} className="cursor-pointer" opacity={isFocused ? 1 : 0.25}>
                  <circle cx={pos.x} cy={pos.y} r={selectedNode === c.code ? 14 : 10} fill={TIER_COLORS[tier]} stroke="white" strokeWidth={2} />
                  <text x={pos.x} y={pos.y - 16} textAnchor="middle" fontSize={11} fill={isFocused ? '#1b1a17' : '#a8a29e'}>
                    {c.code}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        {selectedNode && (
          <Modal
            title={`${catByCode.get(selectedNode)?.name ?? selectedNode} — connected categories`}
            onClose={() => setSelectedNode(null)}
            footer={
              <>
                <Button variant="secondary" onClick={() => setSelectedNode(null)}>
                  Cancel
                </Button>
                <Button variant="accent" onClick={handleSaveTheme}>
                  Save as theme
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <p className="mb-1 font-medium text-ink">Connected to</p>
                {selectedConnectedNames.length ? (
                  <ul className="list-disc pl-5 text-ink-soft">
                    {selectedConnectedNames.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ink-soft">No connections recorded yet for this category.</p>
                )}
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-soft">Theme name</span>
                <input
                  className="input"
                  value={popupName}
                  onChange={(e) => setPopupName(e.target.value)}
                  placeholder="Name this cluster of categories…"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-soft">Explanation</span>
                <textarea
                  className="textarea"
                  value={popupExplanation}
                  onChange={(e) => setPopupExplanation(e.target.value)}
                  placeholder="Why do these categories belong to one theme?"
                />
              </label>
            </div>
          </Modal>
        )}
      </Card>

      <Card
        title="Themes"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={exportThemesCsv} disabled={canvas.themes.length === 0}>
              Export CSV
            </Button>
            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={exportThemesDoc} disabled={canvas.themes.length === 0}>
              Export Word (.doc)
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-xs text-ink-soft">
          Group categories that share a connectivity pattern into one theme, then write a single explanation for the
          group — not one narrative per category. Click a circle in the relational map above to start from its
          connected cluster, or add a theme manually below.
        </p>
        {canvas.themes.length === 0 ? (
          <p className="text-sm text-ink-soft">No themes yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {canvas.themes.map((theme) => (
              <div key={theme.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <input
                    className="input flex-1 py-1 text-sm font-semibold"
                    value={theme.name}
                    onChange={(e) => onRenameTheme(theme.id, e.target.value)}
                  />
                  <button className="text-sm text-red-700 hover:text-red-800" onClick={() => onRemoveTheme(theme.id)}>
                    Delete
                  </button>
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {theme.categories.length ? (
                    theme.categories.map((name) => (
                      <span key={name} className="rounded-full bg-surface-alt px-2 py-0.5 text-xs text-ink-soft">
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-ink-soft">No categories assigned yet.</span>
                  )}
                </div>
                <textarea
                  className="textarea text-xs"
                  placeholder="Explain why these categories form one theme…"
                  value={theme.explanation ?? ''}
                  onChange={(e) => onSetThemeExplanation(theme.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input
            className="input w-56 py-1.5 text-sm"
            placeholder="New theme name"
            value={newThemeName}
            onChange={(e) => setNewThemeName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTheme()}
          />
          <Button variant="secondary" onClick={handleAddTheme}>
            Add theme
          </Button>
        </div>
      </Card>
    </div>
  );
}
