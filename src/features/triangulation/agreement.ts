import type { AnalysisCanvas, GlobalArtifact, Tag, TriangulationSession } from '../../data/types';

export function overlapRatio(a: { start: number; end: number }, b: { start: number; end: number }): number {
  const interStart = Math.max(a.start, b.start);
  const interEnd = Math.min(a.end, b.end);
  const intersection = Math.max(0, interEnd - interStart);
  const unionLen = Math.max(a.end, b.end) - Math.min(a.start, b.start);
  return unionLen === 0 ? 0 : intersection / unionLen;
}

export interface SessionStats {
  matched: number;
  primaryOnly: number;
  coOnly: number;
  agreementPct: number;
  sharedThemes: number;
  primaryThemeCount: number;
  coThemeCount: number;
  sharedArtifactCodes: number;
}

/**
 * Heuristic overlap-agreement metric for calibration only — NOT a formal
 * chance-corrected inter-rater reliability statistic (no Cohen's kappa).
 * Ported from the legacy app's greedy best-overlap matching.
 */
export function computeSessionStats(
  mainTags: Tag[],
  mainCanvases: AnalysisCanvas[],
  mainArtifacts: GlobalArtifact[],
  session: TriangulationSession,
  threshold: number,
): SessionStats {
  const used = new Set<string>();
  let matched = 0;
  for (const primary of mainTags) {
    let best: Tag | null = null;
    let bestRatio = 0;
    for (const candidate of session.tags) {
      if (used.has(candidate.id)) continue;
      if (candidate.transcriptId !== primary.transcriptId || candidate.tagName !== primary.tagName) continue;
      const ratio = overlapRatio(primary, candidate);
      if (ratio >= threshold && ratio > bestRatio) {
        bestRatio = ratio;
        best = candidate;
      }
    }
    if (best) {
      used.add(best.id);
      matched += 1;
    }
  }

  const primaryOnly = mainTags.length - matched;
  const coOnly = session.tags.length - matched;
  const agreementPct = Math.round((matched / Math.max(mainTags.length, session.tags.length, 1)) * 1000) / 10;

  const normalize = (n: string) => n.trim().toLowerCase();
  const mainThemes = new Set(mainCanvases.flatMap((c) => c.themes.map((t) => normalize(t.name))));
  const coThemes = new Set(session.analysisCanvases.flatMap((c) => c.themes.map((t) => normalize(t.name))));
  const sharedThemes = Array.from(mainThemes).filter((t) => coThemes.has(t)).length;

  const mainArtifactCodeKeys = new Set(mainArtifacts.flatMap((a) => a.codes.map((c) => `${a.id}::${c}`)));
  const coArtifactCodeKeys = new Set(session.artifactCodes.flatMap((a) => a.codes.map((c) => `${a.artifactId}::${c}`)));
  const sharedArtifactCodes = Array.from(mainArtifactCodeKeys).filter((k) => coArtifactCodeKeys.has(k)).length;

  return { matched, primaryOnly, coOnly, agreementPct, sharedThemes, primaryThemeCount: mainThemes.size, coThemeCount: coThemes.size, sharedArtifactCodes };
}
