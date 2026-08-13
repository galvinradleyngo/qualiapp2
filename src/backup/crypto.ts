// Crypto/compression primitives, ported 1:1 from the legacy QualiApp (index.html)
// so existing .qbk backups keep decrypting exactly as before. Do not change the
// algorithm/iteration constants below without also handling old backups.

export const toBase64 = (buffer: ArrayBuffer | Uint8Array): string => {
  let binary = '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
};

export const fromBase64 = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

export const blobToBase64 = async (blob: Blob): Promise<string> => toBase64(await blob.arrayBuffer());

const deriveKey = async (
  password: string,
  salt: Uint8Array,
  usages: KeyUsage[],
): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 150000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
};

export interface EncryptedPayload {
  version: 1;
  algorithm: 'AES-GCM-256';
  kdf: 'PBKDF2-SHA256-150000';
  salt: string;
  iv: string;
  data: string;
}

export const encryptPayload = async (
  payload: unknown,
  password: string,
): Promise<EncryptedPayload> => {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(JSON.stringify(payload)),
  );
  return {
    version: 1,
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256-150000',
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(ciphertext),
  };
};

export const decryptPayload = async (
  encryptedBlob: EncryptedPayload,
  password: string,
): Promise<unknown> => {
  const dec = new TextDecoder();
  const salt = fromBase64(encryptedBlob.salt);
  const iv = fromBase64(encryptedBlob.iv);
  const data = fromBase64(encryptedBlob.data);
  const key = await deriveKey(password, salt, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource);
  return JSON.parse(dec.decode(plaintext));
};

export interface EncryptedChunk {
  iv: string;
  data: string;
}

const yieldToMain = () => new Promise((r) => setTimeout(r, 0));

export const encryptBytes = async (
  bytes: Uint8Array,
  password: string,
  onChunkProgress?: (done: number, total: number) => void,
): Promise<{ salt: Uint8Array; chunks: EncryptedChunk[] }> => {
  const CHUNK_SIZE = 8 * 1024 * 1024;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt, ['encrypt']);
  const totalChunks = Math.ceil(bytes.byteLength / CHUNK_SIZE) || 1;
  const encryptedChunks: EncryptedChunk[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, bytes.byteLength);
    const chunkData = bytes.slice(start, end);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, chunkData as BufferSource);
    encryptedChunks.push({ iv: toBase64(iv), data: toBase64(ciphertext) });
    onChunkProgress?.(i + 1, totalChunks);
    await yieldToMain();
  }
  return { salt, chunks: encryptedChunks };
};

export const decryptChunked = async (
  chunks: EncryptedChunk[],
  saltB64: string,
  password: string,
  onChunkProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> => {
  const key = await deriveKey(password, fromBase64(saltB64), ['decrypt']);
  const parts: Uint8Array[] = [];
  let totalLen = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const iv = fromBase64(chunk.iv);
    const ciphertext = fromBase64(chunk.data);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext as BufferSource),
    );
    parts.push(plain);
    totalLen += plain.byteLength;
    onChunkProgress?.(i + 1, chunks.length);
    await yieldToMain();
  }
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
};

export const decryptBytes = async (
  ciphertext: Uint8Array,
  salt: Uint8Array,
  iv: Uint8Array,
  password: string,
): Promise<Uint8Array> => {
  const key = await deriveKey(password, salt, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext as BufferSource));
};

export const gzipCompress = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  void writer.write(bytes as BufferSource);
  void writer.close();
  return readAllChunks(cs.readable);
};

export const gzipDecompress = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  void writer.write(bytes as BufferSource);
  void writer.close();
  return readAllChunks(ds.readable);
};

async function readAllChunks(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.byteLength;
  }
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export const stringHash = async (value: string): Promise<string> => {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return toBase64(digest);
};

// Per-project PIN/password hashing (independent of the backup encryption above).
export const secPbkdf2Hash = async (password: string): Promise<{ hash: string; salt: string }> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 200000, hash: 'SHA-256' },
    km,
    256,
  );
  return { hash: toBase64(bits), salt: toBase64(salt) };
};

export const secPbkdf2Verify = async (
  password: string,
  storedHash: string,
  storedSalt: string,
): Promise<boolean> => {
  const salt = fromBase64(storedSalt);
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 200000, hash: 'SHA-256' },
    km,
    256,
  );
  return toBase64(bits) === storedHash;
};
