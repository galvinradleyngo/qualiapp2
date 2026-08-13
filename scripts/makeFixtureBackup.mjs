// Generates a real QBK6 fixture file on disk for manual/browser smoke testing.
// Not part of the app or its build; run with: node scripts/makeFixtureBackup.mjs
import { writeFile } from 'node:fs/promises';
import { encodeQbk6Fixture } from '../src/backup/__fixtures__/legacyEncoder.ts';

const data = {
  transcripts: [{ id: 't1', title: 'Interview with P1', content: 'Sample transcript content.', folder: 'Round 1' }],
  folders: ['Round 1'],
  tags: [{ id: 'tag1', transcriptId: 't1', code: 'theme-a', start: 0, end: 6 }],
  participants: [{ id: 'p1', pseudonym: 'P-0001' }],
  activityTypes: ['Edited', 'Coded'],
};
const files = [
  {
    key: 'artifact_a1',
    type: 'text/plain',
    name: 'note.txt',
    lastModified: Date.now(),
    bytes: new TextEncoder().encode('a fixture artifact file'),
  },
];
const security = {
  appPinV2: undefined,
};

const bytes = await encodeQbk6Fixture({ data, files, security, password: 'fixturepass' });
await writeFile(new URL('../fixture-backup.qbk', import.meta.url), bytes);
console.log('Wrote fixture-backup.qbk, password: fixturepass');
