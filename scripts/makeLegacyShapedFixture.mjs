// Builds a QBK6 fixture whose transcript mimics genuinely old legacy data:
// no `bookmarks` field at all, and audio referenced via the legacy
// single-track key (`audio_<id>`) instead of an `audioFiles` array — to
// verify the importer's backward-compat normalization.
import { writeFile } from 'node:fs/promises';
import { encodeQbk6Fixture } from '../src/backup/__fixtures__/legacyEncoder.ts';

const transcriptId = 't_legacy_1';
const data = {
  transcripts: [
    {
      id: transcriptId,
      title: 'Old-format Interview',
      folder: 'Uncategorized',
      modality: '',
      content: 'This transcript predates the bookmarks field and multi-track audio.',
      contentHtml: '<p>legacy html field, unused now</p>',
      notes: '',
      hasAudio: true,
      // Deliberately NO audioFiles array and NO bookmarks field.
      participantId: null,
      createdAt: new Date().toISOString(),
      activityLog: [],
    },
  ],
  folders: ['Uncategorized'],
  tags: [],
};
const files = [
  {
    key: `audio_${transcriptId}`,
    type: 'audio/webm',
    name: 'legacy-audio.webm',
    lastModified: Date.now(),
    bytes: new TextEncoder().encode('fake legacy audio bytes'),
  },
];

const bytes = await encodeQbk6Fixture({ data, files, security: undefined, password: 'legacyfixture' });
await writeFile(new URL('../legacy-shaped-fixture.qbk', import.meta.url), bytes);
console.log('Wrote legacy-shaped-fixture.qbk, password: legacyfixture');
