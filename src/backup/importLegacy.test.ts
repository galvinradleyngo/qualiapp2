import { describe, expect, it } from 'vitest';
import { normalizeLegacyDocs } from './importLegacy';
import type { LegacyFileEntry } from './legacyFormat';

const file = (key: string, name: string): LegacyFileEntry => ({ key, type: 'audio/webm', name, lastModified: null, bytes: new Uint8Array() });

describe('normalizeLegacyDocs', () => {
  it('adds an empty bookmarks array when missing', () => {
    const docs: unknown[] = [{ id: 't1', hasAudio: false }];
    normalizeLegacyDocs(docs, []);
    expect((docs[0] as { bookmarks: unknown[] }).bookmarks).toEqual([]);
  });

  it('leaves an existing bookmarks array untouched', () => {
    const docs: unknown[] = [{ id: 't1', bookmarks: [{ id: 'b1', timeSec: 5, label: '0:05' }] }];
    normalizeLegacyDocs(docs, []);
    expect((docs[0] as { bookmarks: unknown[] }).bookmarks).toHaveLength(1);
  });

  it('recovers legacy single-track audio into an audioFiles entry', () => {
    const docs: unknown[] = [{ id: 't1', hasAudio: true }];
    const files = [file('audio_t1', 'interview.webm')];
    normalizeLegacyDocs(docs, files, (doc) => `audio_${doc.id}`);
    expect((docs[0] as { audioFiles: Array<{ key: string; name: string }> }).audioFiles).toEqual([
      { id: 't1_legacy_audio', key: 'audio_t1', name: 'interview.webm' },
    ]);
  });

  it('does not overwrite an already-populated audioFiles array', () => {
    const existing = [{ id: 'a1', key: 'audio_t1_a1', name: 'track1.webm' }];
    const docs: unknown[] = [{ id: 't1', hasAudio: true, audioFiles: existing }];
    normalizeLegacyDocs(docs, [file('audio_t1', 'interview.webm')], (doc) => `audio_${doc.id}`);
    expect((docs[0] as { audioFiles: unknown[] }).audioFiles).toBe(existing);
  });

  it('defaults audioFiles to an empty array when hasAudio is true but no matching file exists', () => {
    const docs: unknown[] = [{ id: 't1', hasAudio: true }];
    normalizeLegacyDocs(docs, [], (doc) => `audio_${doc.id}`);
    expect((docs[0] as { audioFiles: unknown[] }).audioFiles).toEqual([]);
  });

  it('is a no-op when docs is undefined', () => {
    expect(() => normalizeLegacyDocs(undefined, [])).not.toThrow();
  });
});
