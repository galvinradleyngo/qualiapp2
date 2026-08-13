// Maps a browser text Selection back to plain-text character offsets into a
// container's rendered text. Requires the container's rendered text nodes to
// read in the same order/content as the plain-text string being coded (see
// CodedTextView — it renders `white-space: pre-wrap` text nodes only, no
// injected whitespace, so offsets line up exactly with no HTML-sync bugs).

function textOffsetOf(container: HTMLElement, node: Node, nodeOffset: number): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + nodeOffset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return total;
}

export interface SelectionOffsets {
  start: number;
  end: number;
  text: string;
}

export function getSelectionOffsets(container: HTMLElement): SelectionOffsets | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const text = selection.toString();
  if (!text) return null;
  const start = textOffsetOf(container, range.startContainer, range.startOffset);
  const end = textOffsetOf(container, range.endContainer, range.endOffset);
  if (start === end) return null;
  return { start: Math.min(start, end), end: Math.max(start, end), text };
}
