// Heuristic check that a code label is genuinely "in-vivo" (drawn from the
// participant's own words) — the label must either appear verbatim in the
// quote, or share at least 60% of its meaningful (3+ char) word tokens with
// it. Ported from the legacy app's evaluateInVivoAlignment.
export function evaluateInVivoAlignment(label: string, quote: string): boolean {
  const cleanLabel = label.trim().toLowerCase();
  const cleanQuote = quote.trim().toLowerCase();
  if (!cleanLabel || !cleanQuote) return false;
  if (cleanQuote.includes(cleanLabel)) return true;

  const labelTokens = cleanLabel.split(/\s+/).filter((t) => t.length > 2);
  if (labelTokens.length === 0) return false;
  const quoteTokens = new Set(cleanQuote.split(/\s+/).filter((t) => t.length > 2));
  const matched = labelTokens.filter((t) => quoteTokens.has(t)).length;
  return matched / labelTokens.length >= 0.6;
}
