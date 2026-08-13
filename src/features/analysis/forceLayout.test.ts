import { describe, expect, it } from 'vitest';
import { computeForceDirectedLayout, degreeTier } from './forceLayout';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('computeForceDirectedLayout', () => {
  it('separates two disconnected clusters further apart than the nodes within each cluster', () => {
    // Two fully-connected triangles (A-B-C and D-E-F) with no edges between them.
    const nodeIds = ['A', 'B', 'C', 'D', 'E', 'F'];
    const edges = [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
      { source: 'A', target: 'C' },
      { source: 'D', target: 'E' },
      { source: 'E', target: 'F' },
      { source: 'D', target: 'F' },
    ];
    const layout = computeForceDirectedLayout(nodeIds, edges, 640, 420);

    const withinClusterDistances = [dist(layout.get('A')!, layout.get('B')!), dist(layout.get('D')!, layout.get('E')!)];
    const acrossClusterDistances = [dist(layout.get('A')!, layout.get('D')!), dist(layout.get('B')!, layout.get('E')!)];

    const avgWithin = withinClusterDistances.reduce((a, b) => a + b, 0) / withinClusterDistances.length;
    const avgAcross = acrossClusterDistances.reduce((a, b) => a + b, 0) / acrossClusterDistances.length;

    expect(avgAcross).toBeGreaterThan(avgWithin);
  });

  it('gives a hub node more separation from its neighbors than a low-degree node gets from an isolated node', () => {
    // Star graph: HUB connects to five others; ISOLATED connects to nothing.
    const nodeIds = ['HUB', 'P1', 'P2', 'P3', 'P4', 'P5', 'ISOLATED', 'LONE'];
    const edges = [
      { source: 'HUB', target: 'P1' },
      { source: 'HUB', target: 'P2' },
      { source: 'HUB', target: 'P3' },
      { source: 'HUB', target: 'P4' },
      { source: 'HUB', target: 'P5' },
    ];
    const layout = computeForceDirectedLayout(nodeIds, edges, 640, 420);

    // HUB should keep noticeably more distance from an unrelated node than
    // two mutually-isolated low-degree nodes keep from each other.
    const hubToIsolated = dist(layout.get('HUB')!, layout.get('ISOLATED')!);
    const isolatedToLone = dist(layout.get('ISOLATED')!, layout.get('LONE')!);
    expect(hubToIsolated).toBeGreaterThan(isolatedToLone);
  });

  it('positions every node within the canvas bounds', () => {
    const nodeIds = ['A', 'B', 'C', 'D'];
    const edges = [{ source: 'A', target: 'B' }];
    const layout = computeForceDirectedLayout(nodeIds, edges, 640, 420);
    for (const pos of layout.values()) {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.x).toBeLessThanOrEqual(640);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeLessThanOrEqual(420);
    }
  });
});

describe('degreeTier', () => {
  it('buckets degree into low/mid/high relative to the max', () => {
    expect(degreeTier(0, 10)).toBe('low');
    expect(degreeTier(4, 10)).toBe('mid');
    expect(degreeTier(9, 10)).toBe('high');
    expect(degreeTier(0, 0)).toBe('low');
  });
});
