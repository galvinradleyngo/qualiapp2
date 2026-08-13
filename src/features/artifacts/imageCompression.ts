// Compresses an uploaded image to WebP at upload time (skips already-webp/
// jpeg, and anything the browser can't decode via createImageBitmap). This
// is the "compression happens at upload time" behavior the legacy app's
// since-removed file-optimization migration pass existed to backfill —
// doing it here means that backfill pass is unnecessary from the start.
export async function compressImageIfPossible(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/webp') return file;
  if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
    if (blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp', lastModified: file.lastModified });
  } catch {
    return file;
  }
}
