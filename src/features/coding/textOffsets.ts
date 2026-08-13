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

/** Offset of a boundary point that may fall outside `container` (see getSelectionOffsets). */
function boundaryOffset(container: HTMLElement, node: Node, nodeOffset: number, fullLength: number): number {
  if (container.contains(node)) return textOffsetOf(container, node, nodeOffset);
  const position = container.compareDocumentPosition(node);
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 0;
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return fullLength;
  return fullLength;
}

export function getSelectionOffsets(container: HTMLElement): SelectionOffsets | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);

  // A triple-click ("select paragraph") extends the selection's end boundary
  // into the start of the next DOM sibling when the paragraph is followed by
  // another block — here, the sidebar column next to the coded text. Rather
  // than reject the whole selection when only one boundary strays outside
  // the container, clamp that boundary to the nearer edge of the container's
  // own text instead of failing the selection outright.
  if (!container.contains(range.startContainer) && !container.contains(range.endContainer)) return null;

  const fullLength = container.textContent?.length ?? 0;
  const start = boundaryOffset(container, range.startContainer, range.startOffset, fullLength);
  const end = boundaryOffset(container, range.endContainer, range.endOffset, fullLength);
  if (start === end) return null;

  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  // Derive the snippet from the container's own text rather than
  // selection.toString(), which can include that phantom trailing content.
  const text = (container.textContent ?? '').slice(lo, hi);
  if (!text) return null;
  return { start: lo, end: hi, text };
}
