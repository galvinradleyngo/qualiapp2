import { useEffect, useRef } from 'react';

interface RichTextEditorProps {
  contentHtml: string;
  onChange: (patch: { content: string; contentHtml: string }) => void;
  placeholder?: string;
}

/**
 * contentEditable transcript/notes editor with Bold and "Tag Interviewer"
 * formatting. Both only ever wrap existing text in an element (never insert
 * or remove characters), so the plain-text `content` derived from it always
 * stays character-for-character consistent — the in-vivo coding offsets in
 * Code mode (computed from `content`, not `contentHtml`) never see this
 * formatting and are never affected by it.
 */
export function RichTextEditor({ contentHtml, onChange, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  // null means "not yet painted into the DOM" so the very first effect run
  // always seeds initial content, even when contentHtml starts out empty.
  const lastSyncedHtml = useRef<string | null>(null);

  // Sync external changes (switching to a different transcript, or the
  // initial mount) into the DOM — but never while this editor is focused,
  // which would fight the user's cursor and reset their typing position.
  // This deliberately does NOT use React's `dangerouslySetInnerHTML` on
  // every render, since that would reset the DOM (and cursor) on every
  // parent re-render, not just real content changes.
  useEffect(() => {
    if (ref.current && contentHtml !== lastSyncedHtml.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = contentHtml;
      lastSyncedHtml.current = contentHtml;
    }
  }, [contentHtml]);

  const emitChange = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    const text = ref.current.textContent ?? '';
    lastSyncedHtml.current = html;
    onChange({ content: text, contentHtml: html });
  };

  const applyBold = () => {
    ref.current?.focus();
    document.execCommand('bold');
    emitChange();
  };

  const toggleInterviewerTag = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !ref.current) return;
    const range = selection.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;

    const anchorEl = range.commonAncestorContainer.nodeType === 1 ? (range.commonAncestorContainer as Element) : range.commonAncestorContainer.parentElement;
    const existingSpan = anchorEl?.closest('span.qa-interviewer');

    if (existingSpan && ref.current.contains(existingSpan)) {
      const parent = existingSpan.parentNode;
      while (existingSpan.firstChild) parent?.insertBefore(existingSpan.firstChild, existingSpan);
      parent?.removeChild(existingSpan);
    } else {
      const span = document.createElement('span');
      span.className = 'qa-interviewer';
      try {
        range.surroundContents(span);
      } catch {
        // Selection crosses element boundaries — surroundContents can't wrap
        // it directly. extractContents+insertNode preserves the same text.
        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);
      }
    }
    selection.removeAllRanges();
    emitChange();
  };

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={applyBold} className="btn-secondary px-3 py-1 text-xs">
          <strong>B</strong>
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={toggleInterviewerTag} className="btn-secondary px-3 py-1 text-xs">
          Tag Interviewer
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        data-placeholder={placeholder}
        className="rich-text-editor textarea min-h-[420px] w-full text-sm leading-relaxed"
      />
    </div>
  );
}
