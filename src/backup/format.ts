// The current backup format: one encrypted, project-scoped .qbk2 file
// containing this project's full data plus every file blob it references.
// Uses the same chunked-encryption/gzip envelope as the legacy app's QBK6
// (proven and already tested by legacyFormat.test.ts) under a new magic
// ("QAB1") so it's never confused with a legacy artifact. legacyFormat.ts
// stays decode-only for old files; this module owns the format going
// forward, encode and decode both.

import { EMPTY_PROJECT_DATA, type ProjectData } from '../data/types';
import { dataGetAll, fileGetAllFiles, type ProjectDB } from '../storage/projectDb';
import { decryptChunked, encryptBytes, gzipCompress, gzipDecompress, toBase64, type EncryptedChunk } from './crypto';

const MAGIC = 'QAB1';

interface FileIndexEntry {
  key: string;
  type: string;
  name: string | null;
  lastModified: number | null;
  offset: number;
  length: number;
}

const uint32ToBytes = (value: number): Uint8Array => {
  const out = new Uint8Array(4);
  out[0] = (value >>> 24) & 0xff;
  out[1] = (value >>> 16) & 0xff;
  out[2] = (value >>> 8) & 0xff;
  out[3] = value & 0xff;
  return out;
};

const readUInt32BE = (arr: Uint8Array, offset: number): number =>
  ((arr[offset]! << 24) | (arr[offset + 1]! << 16) | (arr[offset + 2]! << 8) | arr[offset + 3]!) >>> 0;

export interface ProjectBackupPayload {
  projectTitle: string;
  exportedAt: string;
  data: ProjectData;
}

export async function encodeProjectBackup(
  projectTitle: string,
  db: ProjectDB,
  password: string,
  onProgress?: (step: string, pct: number) => void,
): Promise<Blob> {
  const report = (step: string, pct: number) => onProgress?.(step, pct);
  report('Reading data…', 5);
  const raw = await dataGetAll(db);
  const data: ProjectData = { ...EMPTY_PROJECT_DATA, ...raw } as ProjectData;

  report('Reading files…', 15);
  const files = await fileGetAllFiles(db);
  const fileIndex: FileIndexEntry[] = [];
  const buffers: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const buf = new Uint8Array(await f.blob.arrayBuffer());
    fileIndex.push({ key: f.key, type: f.type, name: f.name, lastModified: f.lastModified, offset, length: buf.byteLength });
    buffers.push(buf);
    offset += buf.byteLength;
  }

  report('Packing metadata…', 40);
  const meta: ProjectBackupPayload = { projectTitle, exportedAt: new Date().toISOString(), data };
  const metaBytes = new TextEncoder().encode(JSON.stringify({ ...meta, files: fileIndex }));
  const compressedMeta = await gzipCompress(metaBytes);
  const archive = new Uint8Array(4 + compressedMeta.byteLength + offset);
  archive.set(uint32ToBytes(compressedMeta.byteLength), 0);
  archive.set(compressedMeta, 4);
  let writeOffset = 4 + compressedMeta.byteLength;
  for (const buf of buffers) {
    archive.set(buf, writeOffset);
    writeOffset += buf.byteLength;
  }

  report('Encrypting…', 65);
  const { salt, chunks } = await encryptBytes(archive, password, (done, total) => report(`Encrypting… (${done}/${total})`, 65 + Math.round((done / total) * 25)));

  report('Finishing…', 95);
  const encoder = new TextEncoder();
  const saltBytes = encoder.encode(toBase64(salt));
  const parts: Uint8Array[] = [encoder.encode(MAGIC), uint32ToBytes(saltBytes.byteLength), saltBytes, uint32ToBytes(chunks.length)];
  for (const chunk of chunks) {
    const chunkBytes = encoder.encode(JSON.stringify(chunk));
    parts.push(uint32ToBytes(chunkBytes.byteLength), chunkBytes);
  }
  const total = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  report('Done', 100);
  return new Blob([out as BlobPart], { type: 'application/octet-stream' });
}

export interface DecodedProjectBackup {
  projectTitle: string;
  exportedAt: string;
  data: ProjectData;
  files: Array<{ key: string; type: string; name: string | null; lastModified: number | null; bytes: Uint8Array }>;
}

export function isCurrentFormatBackup(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && new TextDecoder().decode(bytes.slice(0, 4)) === MAGIC;
}

export async function decodeProjectBackup(
  file: Blob,
  password: string,
  onProgress?: (step: string, pct: number) => void,
): Promise<DecodedProjectBackup> {
  const report = (step: string, pct: number) => onProgress?.(step, pct);
  report('Reading file…', 5);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isCurrentFormatBackup(bytes)) throw new Error('Not a QualiApp project backup file.');

  const decoder = new TextDecoder();
  let offset = 4;
  const saltLen = readUInt32BE(bytes, offset);
  offset += 4;
  const saltB64 = decoder.decode(bytes.slice(offset, offset + saltLen));
  offset += saltLen;
  const chunkCount = readUInt32BE(bytes, offset);
  offset += 4;
  const chunks: EncryptedChunk[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const len = readUInt32BE(bytes, offset);
    offset += 4;
    chunks.push(JSON.parse(decoder.decode(bytes.slice(offset, offset + len))) as EncryptedChunk);
    offset += len;
  }

  report('Decrypting…', 20);
  const payloadBytes = await decryptChunked(chunks, saltB64, password, (done, total) => report(`Decrypting… (${done}/${total})`, 20 + Math.round((done / total) * 30)));

  report('Decompressing…', 55);
  const compressedMetaLen = readUInt32BE(payloadBytes, 0);
  const compressedMetaBytes = payloadBytes.slice(4, 4 + compressedMetaLen);
  const metaJsonBytes = await gzipDecompress(compressedMetaBytes);
  const meta = JSON.parse(new TextDecoder().decode(metaJsonBytes)) as ProjectBackupPayload & { files: FileIndexEntry[] };
  const binaryStart = 4 + compressedMetaLen;

  const files = meta.files.map((f) => ({
    key: f.key,
    type: f.type,
    name: f.name,
    lastModified: f.lastModified,
    bytes: payloadBytes.slice(binaryStart + f.offset, binaryStart + f.offset + f.length),
  }));

  report('Done', 100);
  return {
    projectTitle: meta.projectTitle,
    exportedAt: meta.exportedAt,
    data: { ...EMPTY_PROJECT_DATA, ...meta.data },
    files,
  };
}
