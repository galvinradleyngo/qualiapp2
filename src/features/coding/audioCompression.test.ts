import { describe, expect, it } from 'vitest';
import { isAudioAlreadyCompressed } from './audioCompression';

describe('isAudioAlreadyCompressed', () => {
  it('treats webm/ogg/opus/mp4/aac/m4a as already compressed', () => {
    for (const type of ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/x-m4a']) {
      expect(isAudioAlreadyCompressed(type)).toBe(true);
    }
  });

  it('treats wav/pcm/unknown as not already compressed', () => {
    for (const type of ['audio/wav', 'audio/x-wav', 'audio/pcm', '', 'audio/unknown-format']) {
      expect(isAudioAlreadyCompressed(type)).toBe(false);
    }
  });
});
