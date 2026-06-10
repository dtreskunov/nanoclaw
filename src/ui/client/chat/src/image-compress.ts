// Client-side image downscale + recompress, primarily for mobile photo
// captures. Modern phones produce 10-50 MB photos that either exceed the
// server's per-file upload limit or blow the browser's memory budget on
// upload. Compressing to a sane resolution + JPEG quality typically
// brings them to 1-3 MB without visible quality loss for chat use.

const MAX_DIM = 2048;
const JPEG_QUALITY = 0.85;
// Only touch files that benefit. A 500 KB phone screenshot doesn't need
// recompression; a 12 MP camera capture does.
const MIN_SIZE_TO_COMPRESS = 1 * 1024 * 1024;

const COMPRESSIBLE = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/**
 * Returns a (possibly) smaller File. Falls back to the original on any
 * error — a corrupt photo isn't a reason to silently drop the user's
 * upload. The returned File always has type `image/jpeg` when compressed
 * (HEIC → JPEG conversion is one of the wins).
 */
export async function maybeCompressImage(file: File): Promise<File> {
  if (!file.type || !COMPRESSIBLE.has(file.type.toLowerCase())) return file;
  if (file.size < MIN_SIZE_TO_COMPRESS) return file;
  try {
    const bitmap = await loadBitmap(file);
    try {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_DIM);
      if (
        width === bitmap.width &&
        height === bitmap.height &&
        file.type === 'image/jpeg' &&
        file.size < 4 * 1024 * 1024
      ) {
        // Already small + JPEG + at-or-below target dims — recompressing
        // would only lose quality.
        return file;
      }
      const blob = await drawAndEncode(bitmap, width, height);
      if (!blob || blob.size >= file.size) return file;
      const baseName = file.name.replace(/\.(heic|heif|png|webp|jpe?g)$/i, '') || 'photo';
      return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
    } finally {
      if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
    }
  } catch {
    return file;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap is much more memory-efficient than HTMLImageElement
  // and skips an intermediate ObjectURL. Supported in every browser we
  // care about (iOS 15+, all Android Chrome, all desktop).
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(file);
  }
  // Fallback: <img> + canvas. Slower and uses more memory but works
  // everywhere.
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image_load_failed'));
      el.src = url;
    });
    // Synthesize an ImageBitmap-like surface by drawing to a canvas
    // ourselves. Simpler to just throw here and let the caller fall back.
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

async function drawAndEncode(bitmap: ImageBitmap, width: number, height: number): Promise<Blob | null> {
  // Prefer OffscreenCanvas where available — runs on a non-main thread
  // and is cheaper to garbage-collect on memory-constrained devices.
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY);
  });
}
