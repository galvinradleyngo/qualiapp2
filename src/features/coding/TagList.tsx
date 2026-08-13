import { colorForLabel } from '../../ui/codeColors';

interface TagListItem {
  id: string;
  category: string;
  tagName: string;
  memo: string;
  textSnippet: string;
}

interface TagListProps {
  tags: TagListItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

export function TagList({ tags, selectedId, onSelect }: TagListProps) {
  if (tags.length === 0) {
    return <p className="text-sm text-ink-soft">No codes yet — select text on the left to add one.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {tags.map((tag) => (
        <li key={tag.id}>
          <button
            onClick={() => onSelect(tag.id)}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              selectedId === tag.id ? 'border-accent-600 bg-accent-50' : 'border-border bg-white hover:border-border-strong'
            }`}
          >
            <div className="mb-1 flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorForLabel(tag.tagName) }} />
              <span className="font-medium text-ink">{tag.tagName}</span>
              <span className="text-xs text-ink-soft">· {tag.category}</span>
            </div>
            <p className="line-clamp-2 text-xs italic text-ink-soft">“{tag.textSnippet}”</p>
          </button>
        </li>
      ))}
    </ul>
  );
}
