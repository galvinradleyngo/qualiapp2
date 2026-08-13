// Re-encodes uploaded audio to compressed Opus, matching the legacy app's
// "save the raw file immediately, compress in the background, swap the
// blob in once done" approach — never blocking the upload on encoding.
//
// This uses MediaRecorder capturing a live AudioContext playback (the
// legacy app's own fallback path) rather than hand-rolling WebCodecs +
// manual Ogg-Opus container muxing (its primary path): muxing a container
// byte-by-byte is exactly the kind of fragile, hard-to-verify-without-real-
// audio code this rewrite is trying to avoid, and MediaRecorder's
// audio/webm;codecs=opus output plays back everywhere WAV does. The
// trade-off is real-time capture — compressing a 45-minute interview takes
// about 45 minutes — which is why this always runs in the background,
// never blocking the UI, and why the original file is usable immediately.

const ALREADY_COMPRESSED = ['webm', 'ogg', 'opus', 'mp4', 'aac', 'm4a'];

export function isAudioAlreadyCompressed(mimeType: string): boolean {
  const t = (mimeType || '').toLowerCase();
  return ALREADY_COMPRESSED.some((marker) => t.includes(marker));
}

export function supportsAudioCompression(): boolean {
  return (
    typeof AudioContext !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  );
}

/**
 * Re-encodes `file` to Opus/webm. Returns the original file unchanged if
 * compression isn't supported, isn't worthwhile (already-compressed
 * formats), or fails for any reason — this must never be the reason an
 * upload is lost.
 */
export async function compressAudioIfPossible(file: File): Promise<File> {
  if (isAudioAlreadyCompressed(file.type)) return file;
  if (!supportsAudioCompression()) return file;

  let decodeCtx: AudioContext | null = null;
  let captureCtx: AudioContext | null = null;
  try {
    decodeCtx = new AudioContext();
    const audioBuffer = await decodeCtx.decodeAudioData(await file.arrayBuffer());

    captureCtx = new AudioContext();
    const destination = captureCtx.createMediaStreamDestination();
    const source = captureCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(destination);

    const recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const recorded = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }));
      recorder.onerror = () => reject(new Error('MediaRecorder failed during audio compression.'));
    });

    recorder.start();
    source.start(0);
    await new Promise((resolve) => setTimeout(resolve, audioBuffer.duration * 1000 + 250));
    recorder.stop();

    const compressedBlob = await recorded;
    if (compressedBlob.size === 0 || compressedBlob.size >= file.size) return file;

    return new File([compressedBlob], file.name.replace(/\.\w+$/, '') + '.webm', {
      type: 'audio/webm',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    void decodeCtx?.close();
    void captureCtx?.close();
  }
}
