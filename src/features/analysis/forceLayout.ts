export interface LayoutNode {
  id: string;
  x: number;
  y: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

/** Simple Fruchterman-Reingold-style force-directed layout for the relational map. */
export function computeForceDirectedLayout(
  nodeIds: string[],
  edges: LayoutEdge[],
  width: number,
  height: number,
  iterations = 200,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, LayoutNode>();
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 3;
  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodeIds.length, 1);
    positions.set(id, { id, x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) });
  });

  const area = width * height;
  const k = Math.sqrt(area / Math.max(nodeIds.length, 1));
  let temperature = width / 10;

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map<string, { x: number; y: number }>();
    for (const id of nodeIds) disp.set(id, { x: 0, y: 0 });

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = positions.get(nodeIds[i]!)!;
        const b = positions.get(nodeIds[j]!)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        const da = disp.get(a.id)!;
        const db = disp.get(b.id)!;
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
      const da = disp.get(a.id)!;
      const db = disp.get(b.id)!;
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
