import { useMemo, useRef, useState } from 'react';
import type { Tag } from '../../data/types';
import { useProjectStore } from '../workspace/ProjectStore';
import { Button } from '../../ui/Button';
import { AudioPanel } from '../coding/AudioPanel';
import { CodedTextView } from '../coding/CodedTextView';
import { CodeForm } from '../coding/CodeForm';
import { TagList } from '../coding/TagList';
import { getSelectionOffsets } from '../coding/textOffsets';

type Mode = 'edit' | 'code' | 'notes' | 'log';

interface TranscriptEditorProps {
  transcriptId: string;
  onBack: () => void;
}

export function TranscriptEditor({ transcriptId, onBack }: TranscriptEditorProps) {
  const { db, data, set } = useProjectStore();
  const transcript = data.transcripts.find((t) => t.id === transcriptId);
  const [mode, setMode] = useState<Mode>('edit');
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  const myTags = useMemo(() => data.tags.filter((t) => t.transcriptId === transcriptId), [data.tags, transcriptId]);

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

  if (!transcript) {
    return (
      <div>
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <p className="mt-4 text-sm text-ink-soft">Transcript not found.</p>
      </div>
    );
  }

  const updateTranscript = (patch: Partial<typeof transcript>) => {
    void set(
      'transcripts',
      data.transcripts.map((t) => (t.id === transcriptId ? { ...t, ...patch } : t)),
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
    const tag: Tag = {
      id: `${Date.now()}`,
      transcriptId,
      category: fields.category,
      tagName: fields.tagName,
      memo: fields.memo,
      textSnippet: pendingSelection.text,
      start: pendingSelection.start,
      end: pendingSelection.end,
    };
    void set('tags', [...data.tags, tag]);
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const submitEditTag = (fields: { category: string; tagName: string; memo: string }) => {
    if (!editingTagId) return;
    void set(
      'tags',
      data.tags.map((t) => (t.id === editingTagId ? { ...t, ...fields } : t)),
    );
    setEditingTagId(null);
  };

  const deleteTag = (id: string) => {
    void set(
      'tags',
      data.tags.filter((t) => t.id !== id),
    );
    setEditingTagId(null);
  };

  const clearAllCodes = () => {
    if (!confirm('Clear all codes and highlights from this transcript?')) return;
    void set(
      'tags',
      data.tags.filter((t) => t.transcriptId !== transcriptId),
    );
  };

  const editingTag = myTags.find((t) => t.id === editingTagId);

  const submitActivity = (type: string, note: string) => {
    const clean = type.trim();
    if (!clean) return;
    const nextActivityTypes = data.activityTypes.includes(clean) ? data.activityTypes : [...data.activityTypes, clean];
    const entry = { id: `${Date.now()}`, type: clean, note: note.trim(), timestamp: new Date().toISOString() };
    void set('activityTypes', nextActivityTypes);
    updateTranscript({ activityLog: [entry, ...transcript.activityLog] });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onBack}>
            ← Back
          </Button>
          <h1 className="text-lg font-semibold text-ink">{transcript.title}</h1>
        </div>
        <select
          className="select w-auto py-1.5 text-sm"
          value={transcript.modality}
          onChange={(e) => updateTranscript({ modality: e.target.value as typeof transcript.modality })}
        >
          <option value="">Modality: not set</option>
          <option value="online">Online</option>
          <option value="onsite">Onsite</option>
        </select>
      </div>

      <div className="mb-4">
        <AudioPanel
          db={db}
          keyPrefix={`audio_${transcriptId}`}
          audioFiles={transcript.audioFiles}
          bookmarks={transcript.bookmarks}
          playbackRate={transcript.playbackRate ?? 1}
          onChangeAudioFiles={(files) => updateTranscript({ audioFiles: files, hasAudio: files.length > 0 })}
          onChangeBookmarks={(bookmarks) => updateTranscript({ bookmarks })}
          onChangePlaybackRate={(rate) => updateTranscript({ playbackRate: rate })}
        />
      </div>

      <div className="mb-4 flex gap-1 border-b border-border">
        {(['edit', 'code', 'notes', 'log'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              mode === m ? 'border-b-2 border-accent-600 text-accent-800' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {m === 'log' ? 'Activity' : m}
          </button>
        ))}
      </div>

      {mode === 'edit' && (
        <textarea
          className="textarea min-h-[420px] w-full text-sm leading-relaxed"
          value={transcript.content}
          onChange={(e) => updateTranscript({ content: e.target.value })}
          placeholder="Paste or type the transcript text here…"
        />
      )}

      {mode === 'code' && (
        <div className="grid grid-cols-[1fr_360px] gap-6">
          <div className="rounded-lg border border-border bg-white p-4 text-sm">
            {transcript.content ? (
              <CodedTextView
                containerRef={codeContainerRef}
                text={transcript.content}
                spans={myTags}
                activeSpanId={editingTagId}
                onMouseUp={handleMouseUp}
                onSpanClick={(id) => {
                  setPendingSelection(null);
                  setEditingTagId(id);
                }}
              />
            ) : (
              <p className="text-ink-soft">Add transcript text in the Edit tab first.</p>
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

      {mode === 'notes' && (
        <textarea
          className="textarea min-h-[420px] w-full"
          value={transcript.notes}
          onChange={(e) => updateTranscript({ notes: e.target.value })}
          placeholder="Memos about this transcript…"
        />
      )}

      {mode === 'log' && <ActivityLog activityTypes={data.activityTypes} entries={transcript.activityLog} onSubmit={submitActivity} />}
    </div>
  );
}

function ActivityLog({
  activityTypes,
  entries,
  onSubmit,
}: {
  activityTypes: string[];
  entries: { id: string; type: string; note: string; timestamp: string }[];
  onSubmit: (type: string, note: string) => void;
}) {
  const [type, setType] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="grid grid-cols-[1fr_1.5fr] gap-6">
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="field mb-3">
          <label htmlFor="activity-type">Activity type</label>
          <input id="activity-type" list="activity-types" className="input" value={type} onChange={(e) => setType(e.target.value)} />
          <datalist id="activity-types">
            {activityTypes.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
        <div className="field mb-3">
          <label htmlFor="activity-note">Details / notes</label>
          <input id="activity-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            onSubmit(type, note);
            setType('');
            setNote('');
          }}
          disabled={!type.trim()}
        >
          Log activity
        </Button>
      </div>
      <ul className="flex flex-col gap-3">
        {entries.map((e) => (
          <li key={e.id} className="rounded-lg border border-border bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">{e.type}</span>
              <span className="text-xs text-ink-soft">{new Date(e.timestamp).toLocaleString()}</span>
            </div>
            {e.note && <p className="mt-1 text-ink-soft">{e.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
