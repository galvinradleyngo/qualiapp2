export interface LayoutNode {
  id: string;
  x: number;
  y: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

// How much extra repulsion unconnected pairs get over connected pairs —
// this is what makes a cluster of connected circles visually separate from
// circles it has no relationship to, rather than everything settling into
// one evenly-spaced blob.
const CLUSTER_SEPARATION_FACTOR = 2.4;
// How much extra repulsion a node's highest-degree neighbor comparison adds,
// scaled by degree relative to the most-connected node in the graph — hub
// nodes claim more personal space instead of getting crowded by their own
// many neighbors.
const HUB_BOOST_FACTOR = 1.6;

/**
 * Fruchterman-Reingold-style force-directed layout for the relational map,
 * tuned so structure is legible at a glance: nodes with more connections
 * push harder against everything around them (hubs stand out with room to
 * show their edges), and any two nodes that aren't directly connected repel
 * each other more strongly than two that are — so a tightly-linked group of
 * categories visually clumps together and separates from other groups,
 * instead of every node settling into one evenly-spaced ring.
 */
export function computeForceDirectedLayout(
  nodeIds: string[],
  edges: LayoutEdge[],
  width: number,
  height: number,
  iterations = 300,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, LayoutNode>();
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 3;
  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodeIds.length, 1);
    positions.set(id, { id, x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) });
  });

  const degree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(`${e.source}|${e.target}`);
    connected.add(`${e.target}|${e.source}`);
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const maxDegree = Math.max(1, ...degree.values());

  const area = width * height;
  const k = Math.sqrt(area / Math.max(nodeIds.length, 1));
  let temperature = width / 10;

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map<string, { x: number; y: number }>();
    for (const id of nodeIds) disp.set(id, { x: 0, y: 0 });

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const idA = nodeIds[i]!;
        const idB = nodeIds[j]!;
        const a = positions.get(idA)!;
        const b = positions.get(idB)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;

        const isConnected = connected.has(`${idA}|${idB}`);
        const hubBoost = 1 + (Math.max(degree.get(idA) ?? 0, degree.get(idB) ?? 0) / maxDegree) * HUB_BOOST_FACTOR;
        const clusterFactor = isConnected ? 1 : CLUSTER_SEPARATION_FACTOR;
        const force = ((k * k) / dist) * hubBoost * clusterFactor;

        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        const da = disp.get(idA)!;
        const db = disp.get(idB)!;
        da.x += dx;
        da.y += dy;
        db.x -= dx;
        db.y -= dy;
      }
    }

    for (const edge of edges) {
      const a = positions.get(edge.source);
      const b = positions.get(edge.target);
      if (!a || !b) continue;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      const da = disp.get(edge.source)!;
      const db = disp.get(edge.target)!;
      da.x -= dx;
      da.y -= dy;
      db.x += dx;
      db.y += dy;
    }

    for (const id of nodeIds) {
      const pos = positions.get(id)!;
      const d = disp.get(id)!;
      const dist = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
      pos.x += (d.x / dist) * Math.min(dist, temperature);
      pos.y += (d.y / dist) * Math.min(dist, temperature);
      // pull gently toward center, keep inside bounds
      pos.x += (centerX - pos.x) * 0.01;
      pos.y += (centerY - pos.y) * 0.01;
      pos.x = Math.max(30, Math.min(width - 30, pos.x));
      pos.y = Math.max(30, Math.min(height - 30, pos.y));
    }
    temperature *= 0.97;
  }

  const out = new Map<string, { x: number; y: number }>();
  for (const [id, pos] of positions) out.set(id, { x: pos.x, y: pos.y });
  return out;
}

export function degreeTier(degree: number, maxDegree: number): 'low' | 'mid' | 'high' {
  if (maxDegree <= 0) return 'low';
  const ratio = degree / maxDegree;
  if (ratio > 0.66) return 'high';
  if (ratio > 0.33) return 'mid';
  return 'low';
}

export const TIER_COLORS: Record<'low' | 'mid' | 'high', string> = {
  low: '#2563eb',
  mid: '#d97706',
  high: '#dc2626',
};

export const RATIONALE_STYLES: Record<'A' | 'B' | 'C' | '', { color: string; dash: string }> = {
  A: { color: '#2563eb', dash: '0' },
  B: { color: '#7c3aed', dash: '0' },
  C: { color: '#d97706', dash: '6,4' },
  '': { color: '#a8a29e', dash: '2,3' },
};
