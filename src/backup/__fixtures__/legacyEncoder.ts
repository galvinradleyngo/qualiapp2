// Test-only encoders that mirror the legacy app's `.qbk` writers, used to
// build fixtures for round-trip tests of legacyFormat.ts. Not used by the
// running app — new exports use the current-format writer in backup/format.ts.

import { blobToBase64, encryptBytes, encryptPayload, gzipCompress, toBase64 } from '../crypto';
import type { LegacyBackupData, LegacySecurityPayload } from '../legacyFormat';

export interface FixtureFile {
  key: string;
  type: string;
  name: string | null;
  lastModified: number | null;
  bytes: Uint8Array;
}

const uint32ToBytes = (value: number): Uint8Array => {
  const out = new Uint8Array(4);
  out[0] = (value >>> 24) & 0xff;
  out[1] = (value >>> 16) & 0xff;
  out[2] = (value >>> 8) & 0xff;
  out[3] = value & 0xff;
  return out;
};

const concat = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
};

interface FixtureInput {
  data: LegacyBackupData;
  files: FixtureFile[];
  security?: LegacySecurityPayload;
  password: string;
}

/** Builds a QBK6 archive: chunked AES-GCM encryption of [gzip(meta)][raw binary]. */
export async function encodeQbk6Fixture({ data, files, security, password }: FixtureInput): Promise<Uint8Array> {
  let binaryOffset = 0;
  const fileIndex: Array<{ key: string; type: string; name: string | null; lastModified: number | null; offset: number; length: number }> = [];
  const fileBuffers: Uint8Array[] = [];
  for (const f of files) {
    fileIndex.push({ key: f.key, type: f.type, name: f.name, lastModified: f.lastModified, offset: binaryOffset, length: f.bytes.byteLength });
    fileBuffers.push(f.bytes);
    binaryOffset += f.bytes.byteLength;
  }
  const meta = { exportedAt: new Date().toISOString(), data, files: fileIndex, security };
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  const compressedMeta = await gzipCompress(metaBytes);
  const archive = concat([uint32ToBytes(compressedMeta.byteLength), compressedMeta, ...fileBuffers]);

  const { salt, chunks } = await encryptBytes(archive, password);
  const encoder = new TextEncoder();
  const saltBytes = encoder.encode(toBase64(salt));
  const parts = [encoder.encode('QBK6'), uint32ToBytes(saltBytes.byteLength), saltBytes, uint32ToBytes(chunks.length)];
  for (const chunk of chunks) {
    const chunkBytes = encoder.encode(JSON.stringify(chunk));
    parts.push(uint32ToBytes(chunkBytes.byteLength), chunkBytes);
  }
  return concat(parts);
}

/** Builds a QBK5 archive: chunked AES-GCM encryption of gzip([4B metaLen][meta][raw binary]). */
export async function encodeQbk5Fixture({ data, files, security, password }: FixtureInput): Promise<Uint8Array> {
  let binaryOffset = 0;
  const fileIndex: Array<{ key: string; type: string; name: string | null; lastModified: number | null; offset: number; length: number }> = [];
  const fileBuffers: Uint8Array[] = [];
  for (const f of files) {
    fileIndex.push({ key: f.key, type: f.type, name: f.name, lastModified: f.lastModified, offset: binaryOffset, length: f.bytes.byteLength });
    fileBuffers.push(f.bytes);
    binaryOffset += f.bytes.byteLength;
  }
  const meta = { exportedAt: new Date().toISOString(), data, files: fileIndex, security };
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  const uncompressed = concat([uint32ToBytes(metaBytes.byteLength), metaBytes, ...fileBuffers]);
  const compressed = await gzipCompress(uncompressed);

  const { salt, chunks } = await encryptBytes(compressed, password);
  const encoder = new TextEncoder();
  const saltBytes = encoder.encode(toBase64(salt));
  const parts = [encoder.encode('QBK5'), uint32ToBytes(saltBytes.byteLength), saltBytes, uint32ToBytes(chunks.length)];
  for (const chunk of chunks) {
    const chunkBytes = encoder.encode(JSON.stringify(chunk));
    parts.push(uint32ToBytes(chunkBytes.byteLength), chunkBytes);
  }
  return concat(parts);
}

/** Builds a plain v1 archive: JSON.stringify(encryptPayload({ data, files (base64), security })). */
export async function encodeV1PlainFixture({ data, files, security, password }: FixtureInput): Promise<Uint8Array> {
  const base64Files = await Promise.all(
    files.map(async (f) => ({
      key: f.key,
      type: f.type,
      name: f.name,
      lastModified: f.lastModified,
      bytes: await blobToBase64(new Blob([f.bytes as BlobPart], { type: f.type })),
    })),
  );
  const payload = { exportedAt: new Date().toISOString(), data, files: base64Files, security };
  const encrypted = await encryptPayload(payload, password);
  return new TextEncoder().encode(JSON.stringify(encrypted));
}
