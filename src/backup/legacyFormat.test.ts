import { describe, expect, it } from 'vitest';
import { encodeQbk5Fixture, encodeQbk6Fixture, encodeV1PlainFixture, type FixtureFile } from './__fixtures__/legacyEncoder';
import { LegacyBackupError, parseLegacyBackup } from './legacyFormat';

const PASSWORD = 'correct horse battery staple';

const sampleData = {
  transcripts: [{ id: 't1', title: 'Interview 1', content: 'Hello world', folder: 'Round 1' }],
  folders: ['Round 1'],
  tags: [{ id: 'tag1', transcriptId: 't1', code: 'theme-a', start: 0, end: 5 }],
  participants: [{ id: 'p1', pseudonym: 'P-0001' }],
  activityTypes: ['Edited', 'Coded'],
};

const sampleFiles: FixtureFile[] = [
  {
    key: 'audio_t1',
    type: 'audio/webm',
    name: 'interview1.webm',
    lastModified: 1700000000000,
    bytes: new TextEncoder().encode('fake audio bytes for testing'),
  },
  {
    key: 'artifact_a1',
    type: 'image/png',
    name: 'photo.png',
    lastModified: null,
    bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5]),
  },
];

const sampleSecurity = {
  appPinV2: { hash: 'deadbeef', salt: 'beefdead' },
  recoveryV2: { question: 'Pet name?', answerHash: 'abc', answerSalt: 'def' },
};

describe('parseLegacyBackup', () => {
  it('decodes a QBK6 archive (current legacy format)', async () => {
    const bytes = await encodeQbk6Fixture({ data: sampleData, files: sampleFiles, security: sampleSecurity, password: PASSWORD });
    const result = await parseLegacyBackup(new Blob([bytes as BlobPart]), PASSWORD);

    expect(result.data.transcripts).toEqual(sampleData.transcripts);
    expect(result.data.folders).toEqual(sampleData.folders);
    expect(result.data.tags).toEqual(sampleData.tags);
    expect(result.security).toEqual(sampleSecurity);
    expect(result.files).toHaveLength(2);
    const audio = result.files.find((f) => f.key === 'audio_t1')!;
    expect(new TextDecoder().decode(audio.bytes)).toBe('fake audio bytes for testing');
    expect(audio.name).toBe('interview1.webm');
    const artifact = result.files.find((f) => f.key === 'artifact_a1')!;
    expect(Array.from(artifact.bytes)).toEqual([137, 80, 78, 71, 1, 2, 3, 4, 5]);
  });

  it('decodes a QBK5 archive (previous legacy format)', async () => {
    const bytes = await encodeQbk5Fixture({ data: sampleData, files: sampleFiles, security: sampleSecurity, password: PASSWORD });
    const result = await parseLegacyBackup(new Blob([bytes as BlobPart]), PASSWORD);

    expect(result.data.transcripts).toEqual(sampleData.transcripts);
    expect(result.files).toHaveLength(2);
    expect(new TextDecoder().decode(result.files.find((f) => f.key === 'audio_t1')!.bytes)).toBe(
      'fake audio bytes for testing',
    );
  });

  it('decodes a plain v1 JSON archive (base64-embedded files)', async () => {
    const bytes = await encodeV1PlainFixture({ data: sampleData, files: sampleFiles, security: sampleSecurity, password: PASSWORD });
    const result = await parseLegacyBackup(new Blob([bytes as BlobPart]), PASSWORD);

    expect(result.data.participants).toEqual(sampleData.participants);
    expect(result.security).toEqual(sampleSecurity);
    expect(result.files).toHaveLength(2);
    expect(Array.from(result.files.find((f) => f.key === 'artifact_a1')!.bytes)).toEqual([
      137, 80, 78, 71, 1, 2, 3, 4, 5,
    ]);
  });

  it('rejects the wrong password', async () => {
    const bytes = await encodeQbk6Fixture({ data: sampleData, files: sampleFiles, security: sampleSecurity, password: PASSWORD });
    await expect(parseLegacyBackup(new Blob([bytes as BlobPart]), 'wrong password')).rejects.toThrow();
  });

  it('handles empty transcripts/files gracefully', async () => {
    const bytes = await encodeQbk6Fixture({ data: {}, files: [], security: undefined, password: PASSWORD });
    const result = await parseLegacyBackup(new Blob([bytes as BlobPart]), PASSWORD);
    expect(result.data).toEqual({});
    expect(result.files).toEqual([]);
  });

  it('merges legacy per-type folder lists when `folders` is absent', async () => {
    const dataWithoutFolders = {
      transcripts: [],
      transcriptFolders: ['A', 'B'],
      artifactFolders: ['B', 'C'],
    };
    const bytes = await encodeQbk6Fixture({ data: dataWithoutFolders, files: [], security: undefined, password: PASSWORD });
    const result = await parseLegacyBackup(new Blob([bytes as BlobPart]), PASSWORD);
    expect(result.data.folders).toBeUndefined();
    const merged = [
      ...new Set([
        ...(result.data.transcriptFolders ?? []),
        ...(result.data.artifactFolders ?? []),
        ...(result.data.observationFolders ?? []),
      ]),
    ];
    expect(merged.sort()).toEqual(['A', 'B', 'C']);
  });

  it('throws LegacyBackupError on a truncated QBK6 file', async () => {
    const bytes = await encodeQbk6Fixture({ data: sampleData, files: sampleFiles, security: sampleSecurity, password: PASSWORD });
    const truncated = bytes.slice(0, 10);
    await expect(parseLegacyBackup(new Blob([truncated as BlobPart]), PASSWORD)).rejects.toThrow(LegacyBackupError);
  });
});
