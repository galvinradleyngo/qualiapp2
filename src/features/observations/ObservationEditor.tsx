import { useMemo, useRef, useState } from 'react';
import type { ObservationTag } from '../../data/types';
import { useProjectStore } from '../workspace/ProjectStore';
import { Button } from '../../ui/Button';
import { AudioPanel } from '../coding/AudioPanel';
import { CodedTextView } from '../coding/CodedTextView';
import { CodeForm } from '../coding/CodeForm';
import { RichTextEditor } from '../coding/RichTextEditor';
import { TagList } from '../coding/TagList';
import { getSelectionOffsets } from '../coding/textOffsets';

type Mode = 'notes' | 'code' | 'memos';

interface ObservationEditorProps {
  observationId: string;
  onBack: () => void;
}

export function ObservationEditor({ observationId, onBack }: ObservationEditorProps) {
  const { db, data, set } = useProjectStore();
  const observation = data.observations.find((o) => o.id === observationId);
  const [mode, setMode] = useState<Mode>('notes');
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  const myTags = useMemo(() => data.observationTags.filter((t) => t.observationId === observationId), [data.observationTags, observationId]);

  const { existingCategories, existingCodes } = useMemo(() => {
    const categories = new Set<string>();
    const codes = new Set<string>();
    for (const t of data.tags) {
      categories.add(t.category);
      codes.add(t.tagName);
    }
    for (const t of data.observationTags) {
      categories.add(t.category);
      codes.add(t.tagName);
    }
    for (const a of data.globalArtifacts) for (const c of a.codes) codes.add(c);
    return { existingCategories: Array.from(categories), existingCodes: Array.from(codes) };
  }, [data.tags, data.observationTags, data.globalArtifacts]);

  if (!observation) {
    return (
      <div>
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <p className="mt-4 text-sm text-ink-soft">Observation not found.</p>
      </div>
    );
  }

  const updateObservation = (patch: Partial<typeof observation>) => {
    void set(
      'observations',
      data.observations.map((o) => (o.id === observationId ? { ...o, ...patch } : o)),
    );
  };

  const handleMouseUp = () => {
    if (!codeContainerRef.current) return;
    const offsets = getSelectionOffsets(codeContainerRef.current);
    if (offsets) {
      setEditingTagId(null);
      setPendingSelection(offsets);
    }
  };

  const submitNewTag = (fields: { category: string; tagName: string; memo: string }) => {
    if (!pendingSelection) return;
    const tag: ObservationTag = {
      id: `${Date.now()}`,
      observationId,
      category: fields.category,
      tagName: fields.tagName,
      memo: fields.memo,
      textSnippet: pendingSelection.text,
      start: pendingSelection.start,
      end: pendingSelection.end,
    };
    void set('observationTags', [...data.observationTags, tag]);
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const submitEditTag = (fields: { category: string; tagName: string; memo: string }) => {
    if (!editingTagId) return;
    void set(
      'observationTags',
      data.observationTags.map((t) => (t.id === editingTagId ? { ...t, ...fields } : t)),
    );
    setEditingTagId(null);
  };

  const deleteTag = (id: string) => {
    void set(
      'observationTags',
      data.observationTags.filter((t) => t.id !== id),
    );
    setEditingTagId(null);
  };

  const clearAllCodes = () => {
    if (!confirm('Clear all codes and highlights from this observation?')) return;
    void set(
      'observationTags',
      data.observationTags.filter((t) => t.observationId !== observationId),
    );
  };

  const editingTag = myTags.find((t) => t.id === editingTagId);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <h1 className="text-lg font-semibold text-ink">{observation.title}</h1>
      </div>

      <div className="mb-4">
        <AudioPanel
          db={db}
          keyPrefix={`observation_audio_${observationId}`}
          audioFiles={observation.audioFiles}
          bookmarks={observation.bookmarks}
          playbackRate={observation.playbackRate ?? 1}
          onChangeAudioFiles={(files) => updateObservation({ audioFiles: files, hasAudio: files.length > 0 })}
          onChangeBookmarks={(bookmarks) => updateObservation({ bookmarks })}
          onChangePlaybackRate={(rate) => updateObservation({ playbackRate: rate })}
        />
      </div>

      <div className="mb-4 flex gap-1 border-b border-border">
        {(['notes', 'code', 'memos'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              mode === m ? 'border-b-2 border-accent-600 text-accent-800' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {m === 'notes' ? 'Field notes' : m}
          </button>
        ))}
      </div>

      {mode === 'notes' && (
        <RichTextEditor
          contentHtml={observation.contentHtml}
          onChange={({ content, contentHtml }) => updateObservation({ content, contentHtml })}
          placeholder="Write field notes here…"
        />
      )}

      {mode === 'code' && (
        <div className="grid grid-cols-[1fr_360px] gap-6">
          <div className="rounded-lg border border-border bg-white p-4 text-sm">
            {observation.content ? (
              <CodedTextView
                containerRef={codeContainerRef}
                text={observation.content}
                spans={myTags}
                activeSpanId={editingTagId}
                onMouseUp={handleMouseUp}
                onSpanClick={(id) => {
                  setPendingSelection(null);
                  setEditingTagId(id);
                }}
              />
            ) : (
              <p className="text-ink-soft">Add field notes in the Field Notes tab first.</p>
            )}
          </div>
          <div className="flex flex-col gap-4">
            {pendingSelection && (
              <div className="rounded-lg border border-border bg-white p-4">
                <CodeForm
                  quote={pendingSelection.text}
                  existingCategories={existingCategories}
                  existingCodes={existingCodes}
                  onSubmit={submitNewTag}
                  onCancel={() => setPendingSelection(null)}
                />
              </div>
            )}
            {editingTag && (
              <div className="rounded-lg border border-border bg-white p-4">
                <CodeForm
                  quote={editingTag.textSnippet}
                  existingCategories={existingCategories}
                  existingCodes={existingCodes}
                  initial={{ category: editingTag.category, tagName: editingTag.tagName, memo: editingTag.memo }}
                  onSubmit={submitEditTag}
                  onCancel={() => setEditingTagId(null)}
                  onDelete={() => deleteTag(editingTag.id)}
                />
              </div>
            )}
            {!pendingSelection && !editingTag && (
              <div className="rounded-lg border border-border bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">Codes ({myTags.length})</h3>
                  {myTags.length > 0 && (
                    <button className="link-btn" onClick={clearAllCodes}>
                      Clear all
                    </button>
                  )}
                </div>
                <TagList tags={myTags} selectedId={editingTagId} onSelect={setEditingTagId} />
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'memos' && (
        <textarea
          className="textarea min-h-[420px] w-full"
          value={observation.notes}
          onChange={(e) => updateObservation({ notes: e.target.value })}
          placeholder="General notes about this observation…"
        />
      )}
    </div>
  );
}
