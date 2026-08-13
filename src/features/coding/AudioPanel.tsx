import { useEffect, useRef, useState } from 'react';
import type { AudioBookmark, AudioFileRef } from '../../data/types';
import { fileGet, fileSet, type ProjectDB } from '../../storage/projectDb';
import { Button } from '../../ui/Button';
import { compressAudioIfPossible } from './audioCompression';

interface AudioPanelProps {
  db: ProjectDB;
  keyPrefix: string;
  audioFiles: AudioFileRef[];
  bookmarks: AudioBookmark[];
  playbackRate: number;
  onChangeAudioFiles: (files: AudioFileRef[]) => void;
  onChangeBookmarks: (bookmarks: AudioBookmark[]) => void;
  onChangePlaybackRate: (rate: number) => void;
}

const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function AudioPanel({
  db,
  keyPrefix,
  audioFiles,
  bookmarks,
  playbackRate,
  onChangeAudioFiles,
  onChangeBookmarks,
  onChangePlaybackRate,
}: AudioPanelProps) {
  const [activeTrackId, setActiveTrackId] = useState<string | null>(audioFiles[0]?.id ?? null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [compressingKeys, setCompressingKeys] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!activeTrackId && audioFiles.length > 0) setActiveTrackId(audioFiles[0]!.id);
    if (activeTrackId && !audioFiles.some((f) => f.id === activeTrackId)) setActiveTrackId(audioFiles[0]?.id ?? null);
  }, [audioFiles, activeTrackId]);

  const activeKeyRef = useRef<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let revoked: string | null = null;
    const track = audioFiles.find((f) => f.id === activeTrackId);
    activeKeyRef.current = track?.key ?? null;
    if (!track) {
      setObjectUrl(null);
      return;
    }
    void fileGet(db, track.key).then((row) => {
      if (!row) return;
      const url = URL.createObjectURL(row.blob);
      revoked = url;
      setObjectUrl(url);
    });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
    // reloadToken forces a re-fetch once background compression swaps in a
    // smaller blob under the same key, without needing new audioFiles metadata.
  }, [db, activeTrackId, audioFiles, reloadToken]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, objectUrl]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const next = [...audioFiles];
    const uploaded: Array<{ key: string; file: File }> = [];
    for (const file of Array.from(fileList)) {
      const id = newId();
      const key = `${keyPrefix}_${id}`;
      // Store the raw file immediately — audio is usable right away, never
      // blocked on compression, which can take as long as the recording itself.
      await fileSet(db, key, file, { name: file.name, lastModified: file.lastModified });
      next.push({ id, key, name: file.name });
      uploaded.push({ key, file });
    }
    onChangeAudioFiles(next);
    if (!activeTrackId) setActiveTrackId(next[0]?.id ?? null);

    for (const { key, file } of uploaded) void compressInBackground(key, file);
  };

  const compressInBackground = async (key: string, file: File) => {
    setCompressingKeys((prev) => new Set(prev).add(key));
    try {
      const compressed = await compressAudioIfPossible(file);
      if (compressed !== file) {
        await fileSet(db, key, compressed, { name: compressed.name, lastModified: compressed.lastModified });
        if (activeKeyRef.current === key) setReloadToken((t) => t + 1);
      }
    } finally {
      setCompressingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleRemoveActive = () => {
    if (!activeTrackId) return;
    onChangeAudioFiles(audioFiles.filter((f) => f.id !== activeTrackId));
  };

  const addBookmark = () => {
    const t = audioRef.current?.currentTime ?? 0;
    onChangeBookmarks([...bookmarks, { id: newId(), timeSec: t, label: formatTime(t) }].sort((a, b) => a.timeSec - b.timeSec));
  };

  const seekTo = (timeSec: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = timeSec;
    void audioRef.current.play();
  };

  return (
    <div className="rounded-lg border border-border bg-surface-alt p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {audioFiles.length > 1 && (
          <select
            className="select w-auto"
            value={activeTrackId ?? ''}
            onChange={(e) => setActiveTrackId(e.target.value)}
          >
            {audioFiles.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        <label className="btn-secondary cursor-pointer text-xs">
          {audioFiles.length ? 'Add audio' : 'Upload audio'}
          <input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => void handleUpload(e.target.files)} />
        </label>
        {audioFiles.length > 0 && (
          <Button variant="danger" className="text-xs" onClick={handleRemoveActive}>
            Remove current
          </Button>
        )}
        {compressingKeys.size > 0 && (
          <span className="text-xs text-ink-soft">
            Optimizing {compressingKeys.size} file{compressingKeys.size === 1 ? '' : 's'} in the background…
          </span>
        )}
      </div>

      {objectUrl && (
        <>
          <audio ref={audioRef} src={objectUrl} controls className="w-full" />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-soft">Speed:</span>
            {SPEED_STEPS.map((s) => (
              <button
                key={s}
                onClick={() => onChangePlaybackRate(s)}
                className={`rounded px-2 py-0.5 ${playbackRate === s ? 'bg-ink text-white' : 'bg-white text-ink-soft hover:bg-border'}`}
              >
                {s}x
              </button>
            ))}
            <Button variant="ghost" className="text-xs" onClick={addBookmark}>
              + Add bookmark
            </Button>
          </div>
          {bookmarks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {bookmarks.map((b) => (
                <button key={b.id} onClick={() => seekTo(b.timeSec)} className="badge bg-white text-ink-soft hover:bg-border" title="Jump to bookmark">
                  🔖 {formatTime(b.timeSec)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
