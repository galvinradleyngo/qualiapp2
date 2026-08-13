import { Fragment, type MouseEvent, type Ref } from 'react';
import { colorForLabel } from '../../ui/codeColors';

export interface CodedSpan {
  id: string;
  start: number;
  end: number;
  tagName: string;
  category: string;
}

interface CodedTextViewProps {
  text: string;
  spans: CodedSpan[];
  activeSpanId?: string | null;
  onSpanClick?: (id: string) => void;
  containerRef?: Ref<HTMLDivElement>;
  onMouseUp?: () => void;
  className?: string;
}

const withAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Renders `text` with `spans` highlighted, without mutating the DOM (unlike
 * the legacy app's Range-based approach). Splits the text at every span
 * boundary and, for each segment, wraps it once in a <mark> covering every
 * span that includes it — overlaps render as a layered gradient rather than
 * silently breaking, and the smallest (most specific) covering span is the
 * click target, matching the legacy "innermost tag wins" click behavior.
 */
export function CodedTextView({ text, spans, activeSpanId, onSpanClick, containerRef, onMouseUp, className }: CodedTextViewProps) {
  const validSpans = spans.filter((s) => s.start >= 0 && s.end <= text.length && s.start < s.end);

  const boundaries = new Set<number>([0, text.length]);
  for (const s of validSpans) {
    boundaries.add(s.start);
    boundaries.add(s.end);
  }
  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('mark[data-tag-id]');
    if (target && onSpanClick) onSpanClick(target.getAttribute('data-tag-id')!);
  };

  return (
    <div
      ref={containerRef}
      onMouseUp={onMouseUp}
      onClick={handleClick}
      className={`whitespace-pre-wrap break-words leading-relaxed ${className ?? ''}`}
    >
      {sortedBoundaries.slice(0, -1).map((segStart, i) => {
        const segEnd = sortedBoundaries[i + 1]!;
        const segment = text.slice(segStart, segEnd);
        const covering = validSpans
          .filter((s) => s.start <= segStart && s.end >= segEnd)
          .sort((a, b) => a.end - a.start - (b.end - b.start));

        if (covering.length === 0) return <Fragment key={segStart}>{segment}</Fragment>;

        const primary = covering[0]!;
        const isActive = covering.some((s) => s.id === activeSpanId);
        const colors = covering.map((s) => colorForLabel(s.tagName));
        const background = isActive
          ? withAlpha('#ea580c', 0.55)
          : colors.length === 1
            ? withAlpha(colors[0]!, 0.32)
            : `linear-gradient(180deg, ${colors.map((c) => withAlpha(c, 0.32)).join(', ')})`;
        const title = covering.map((s) => `${s.category} › ${s.tagName}`).join(' + ');

        return (
          <mark
            key={segStart}
            data-tag-id={primary.id}
            title={title}
            style={{ background, borderRadius: 2, cursor: onSpanClick ? 'pointer' : undefined }}
          >
            {segment}
          </mark>
        );
      })}
    </div>
  );
}
