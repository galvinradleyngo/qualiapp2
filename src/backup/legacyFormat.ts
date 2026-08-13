// Reads .qbk backups produced by the legacy QualiApp, across every format
// version it ever wrote: plain-JSON v1 (outer gzip + AES-GCM JSON envelope),
// v2 (single-shot encrypt-then-gzip), v3/v4 (chunked encryption, v4 adds a
// binary file section), and the QBK5/QBK6 binary envelopes (chunked
// encryption of a gzip-compressed metadata + raw binary blob). QBK6 differs
// from QBK5 only in gzipping just the metadata, not the whole archive.
//
// This module is intentionally decoder-only: new exports use a new format
// (see backup/format.ts), but every one of these branches must keep working
// forever so old backups always import.

import {
  decryptBytes,
  decryptChunked,
  decryptPayload,
  fromBase64,
  gzipDecompress,
  type EncryptedChunk,
  type EncryptedPayload,
} from './crypto';

export interface LegacyBackupData {
  transcripts?: unknown[];
  folders?: string[];
  tags?: unknown[];
  globalArtifacts?: unknown[];
  activityTypes?: string[];
  participants?: unknown[];
  analysisCanvases?: unknown[];
  sourceFilterPresets?: unknown[];
  triangulationSessions?: unknown[];
  triangulationAssignmentMeta?: unknown;
  codeDefinitions?: Record<string, unknown>;
  categoryDefinitions?: Record<string, unknown>;
  observations?: unknown[];
  observationTags?: unknown[];
  // Pre-`folders` backups organized transcripts/artifacts/observations into
  // separate folder lists; callers merge these into one `folders` set.
  transcriptFolders?: string[];
  artifactFolders?: string[];
  observationFolders?: string[];
}

export interface LegacyFileEntry {
  key: string;
  type: string;
  name: string | null;
  lastModified: number | null;
  bytes: Uint8Array;
}

export interface LegacySecurityPayload {
  appPinV2?: unknown;
  participantPinV2?: unknown;
  recoveryV2?: unknown;
  appPin?: string | null;
  participantPinHash?: string | null;
  recoveryQuestion?: string | null;
  recoveryAnswerHash?: string | null;
}

export interface LegacyBackupPayload {
  exportedAt?: string;
  data: LegacyBackupData;
  files: LegacyFileEntry[];
  security?: LegacySecurityPayload;
}

export class LegacyBackupError extends Error {}

interface RawFileDescriptor {
  key: string;
  type: string;
  name: string | null;
  lastModified: number | null;
  offset: number;
  length: number;
}

const readUInt32BE = (arr: Uint8Array, offset: number): number => {
  if (offset + 4 > arr.length) throw new LegacyBackupError('Invalid backup file.');
  return (
    ((arr[offset]! << 24) | (arr[offset + 1]! << 16) | (arr[offset + 2]! << 8) | arr[offset + 3]!) >>> 0
  );
};

interface RawBytesFile {
  key: string;
  type: string;
  name: string | null;
  lastModified: number | null;
  rawBytes: Uint8Array;
}

const resolveRawFiles = (
  meta: { files?: RawFileDescriptor[] },
  binary: Uint8Array,
  binaryStart: number,
): RawBytesFile[] =>
  (meta.files ?? []).map((f) => ({
    key: f.key,
    type: f.type,
    name: f.name,
    lastModified: f.lastModified,
    rawBytes: binary.slice(binaryStart + f.offset, binaryStart + f.offset + f.length),
  }));

/** Detects and decrypts any legacy `.qbk` backup format, returning a normalized payload. */
export async function parseLegacyBackup(
  file: Blob,
  password: string,
  onProgress?: (step: string, pct: number) => void,
): Promise<LegacyBackupPayload> {
  const report = (step: string, pct: number) => onProgress?.(step, pct);
  report('Reading file…', 5);
  const bytes = new Uint8Array(await file.arrayBuffer());

  let raw: {
    exportedAt?: string;
    data?: LegacyBackupData;
    files?: Array<RawBytesFile | { key: string; type: string; name: string | null; lastModified: number | null; bytes: string }>;
    security?: LegacySecurityPayload;
  };

  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    // v1: outer gzip wrapping an AES-GCM JSON envelope
    report('Decompressing…', 10);
    const decompressed = await gzipDecompress(bytes);
    const encrypted = JSON.parse(new TextDecoder().decode(decompressed)) as EncryptedPayload;
    report('Decrypting…', 30);
    raw = (await decryptPayload(encrypted, password)) as typeof raw;
  } else if (bytes.length >= 4 && bytes[0] === 0x51 && bytes[1] === 0x42 && bytes[2] === 0x4b && bytes[3] === 0x36) {
    // QBK6: [4B magic][4B saltLen][saltUtf8][4B chunkCount][(4B chunkLen)(chunkUtf8)]*
    report('Decrypting…', 15);
    const decoder = new TextDecoder();
    let offset = 4;
    const saltLen = readUInt32BE(bytes, offset);
    offset += 4;
    if (offset + saltLen > bytes.length) throw new LegacyBackupError('Invalid backup file.');
    const saltB64 = decoder.decode(bytes.slice(offset, offset + saltLen));
    offset += saltLen;

    const chunkCount = readUInt32BE(bytes, offset);
    offset += 4;
    const chunks: EncryptedChunk[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const len = readUInt32BE(bytes, offset);
      offset += 4;
      if (offset + len > bytes.length) throw new LegacyBackupError('Invalid backup file.');
      chunks.push(JSON.parse(decoder.decode(bytes.slice(offset, offset + len))) as EncryptedChunk);
      offset += len;
    }

    const payloadBytes = await decryptChunked(chunks, saltB64, password, (done, total) =>
      report(`Decrypting… (${done}/${total})`, Math.round(15 + (done / total) * 20)),
    );
    report('Decompressing metadata…', 40);
    const compressedMetaLen = readUInt32BE(payloadBytes, 0);
    const compressedMetaBytes = payloadBytes.slice(4, 4 + compressedMetaLen);
    const metaJsonBytes = await gzipDecompress(compressedMetaBytes);
    const meta = JSON.parse(new TextDecoder().decode(metaJsonBytes)) as {
      exportedAt?: string;
      data?: LegacyBackupData;
      files?: RawFileDescriptor[];
      security?: LegacySecurityPayload;
    };
    const binaryStart = 4 + compressedMetaLen;
    raw = { ...meta, files: resolveRawFiles(meta, payloadBytes, binaryStart) };
  } else if (bytes.length >= 4 && bytes[0] === 0x51 && bytes[1] === 0x42 && bytes[2] === 0x4b && bytes[3] === 0x35) {
    // QBK5: same envelope as QBK6, but the whole archive (meta + binary) is gzipped together
    report('Decrypting…', 15);
    const decoder = new TextDecoder();
    let offset = 4;
    const saltLen = readUInt32BE(bytes, offset);
    offset += 4;
    if (offset + saltLen > bytes.length) throw new LegacyBackupError('Invalid backup file.');
    const saltB64 = decoder.decode(bytes.slice(offset, offset + saltLen));
    offset += saltLen;

    const chunkCount = readUInt32BE(bytes, offset);
    offset += 4;
    const chunks: EncryptedChunk[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const len = readUInt32BE(bytes, offset);
      offset += 4;
      if (offset + len > bytes.length) throw new LegacyBackupError('Invalid backup file.');
      chunks.push(JSON.parse(decoder.decode(bytes.slice(offset, offset + len))) as EncryptedChunk);
      offset += len;
    }

    const compressedBytes = await decryptChunked(chunks, saltB64, password, (done, total) =>
      report(`Decrypting… (${done}/${total})`, Math.round(15 + (done / total) * 20)),
    );
    report('Decompressing…', 40);
    const decompressed = await gzipDecompress(compressedBytes);
    const metaLen = readUInt32BE(decompressed, 0);
    const meta = JSON.parse(new TextDecoder().decode(decompressed.slice(4, 4 + metaLen))) as {
      exportedAt?: string;
      data?: LegacyBackupData;
      files?: RawFileDescriptor[];
      security?: LegacySecurityPayload;
    };
    const binaryStart = 4 + metaLen;
    raw = { ...meta, files: resolveRawFiles(meta, decompressed, binaryStart) };
  } else {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      version?: number;
      chunked?: boolean;
      binary?: boolean;
      compressed?: boolean;
      chunks?: EncryptedChunk[];
      salt?: string;
      iv?: string;
      data?: string;
    };
    if ((parsed.version === 4 || parsed.version === 3) && parsed.chunked) {
      report('Decrypting…', 15);
      const compressedBytes = await decryptChunked(parsed.chunks ?? [], parsed.salt ?? '', password, (done, total) =>
        report(`Decrypting… (${done}/${total})`, Math.round(15 + (done / total) * 20)),
      );
      report('Decompressing…', 40);
      const decompressed = await gzipDecompress(compressedBytes);
      if (parsed.version === 4 && parsed.binary) {
        const metaLen = readUInt32BE(decompressed, 0);
        const meta = JSON.parse(new TextDecoder().decode(decompressed.slice(4, 4 + metaLen))) as {
          exportedAt?: string;
          data?: LegacyBackupData;
          files?: RawFileDescriptor[];
          security?: LegacySecurityPayload;
        };
        const binaryStart = 4 + metaLen;
        raw = { ...meta, files: resolveRawFiles(meta, decompressed, binaryStart) };
      } else {
        raw = JSON.parse(new TextDecoder().decode(decompressed)) as typeof raw;
      }
    } else if (parsed.version === 2 && parsed.compressed) {
      report('Decrypting…', 15);
      const salt = fromBase64(parsed.salt ?? '');
      const iv = fromBase64(parsed.iv ?? '');
      const ciphertext = fromBase64(parsed.data ?? '');
      const compressedBytes = await decryptBytes(ciphertext, salt, iv, password);
      report('Decompressing…', 35);
      const jsonBytes = await gzipDecompress(compressedBytes);
      raw = JSON.parse(new TextDecoder().decode(jsonBytes)) as typeof raw;
    } else {
      report('Decrypting…', 30);
      raw = (await decryptPayload(parsed as EncryptedPayload, password)) as typeof raw;
    }
  }

  const files: LegacyFileEntry[] = (raw.files ?? []).map((f) =>
    'rawBytes' in f
      ? { key: f.key, type: f.type, name: f.name, lastModified: f.lastModified, bytes: f.rawBytes }
      : { key: f.key, type: f.type, name: f.name, lastModified: f.lastModified, bytes: fromBase64(f.bytes) },
  );

  report('Done', 100);
  return {
    exportedAt: raw.exportedAt,
    data: raw.data ?? {},
    files,
    security: raw.security,
  };
}
