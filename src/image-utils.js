/**
 * image-utils.js — Image preprocessing utilities.
 *
 * Resizes images that exceed a maximum dimension before they are
 * passed to TF.js inference, preventing OOM crashes on mobile and
 * keeping inference latency under 2 s on mid-range hardware.
 */

/** Maximum side length in pixels before downscaling. */
const MAX_SIDE = 1280;
/** Maximum file size in bytes before resize is forced (10 MB). */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Downscale an HTMLImageElement if either dimension exceeds MAX_SIDE
 * or the source file exceeds MAX_BYTES.
 *
 * Returns the original image unchanged when within limits.
 *
 * @param {HTMLImageElement} img
 * @param {File|null}        [file]   Optional source file for size check.
 * @returns {HTMLImageElement|HTMLCanvasElement}
 */
export function resizeIfNeeded(img, file = null) {
  const { naturalWidth: w, naturalHeight: h } = img;
  const tooBig   = w > MAX_SIDE || h > MAX_SIDE;
  const tooHeavy = file ? file.size > MAX_BYTES : false;

  if (!tooBig && !tooHeavy) return img;

  const ratio  = Math.min(MAX_SIDE / w, MAX_SIDE / h, 1);
  const dstW   = Math.round(w * ratio);
  const dstH   = Math.round(h * ratio);

  const canvas = Object.assign(document.createElement('canvas'), { width: dstW, height: dstH });
  canvas.getContext('2d').drawImage(img, 0, 0, dstW, dstH);
  return canvas;
}

/**
 * Extract an ImageData from an HTMLImageElement or HTMLCanvasElement.
 * Used to pass pixel data to a Web Worker.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} source
 * @returns {ImageData}
 */
export function toImageData(source) {
  const isCanvas = source instanceof HTMLCanvasElement;
  const w = isCanvas ? source.width  : source.naturalWidth;
  const h = isCanvas ? source.height : source.naturalHeight;
  const canvas = isCanvas ? source : Object.assign(
    document.createElement('canvas'), { width: w, height: h }
  );
  if (!isCanvas) canvas.getContext('2d').drawImage(source, 0, 0);
  return canvas.getContext('2d').getImageData(0, 0, w, h);
}

/**
 * Compute a human-readable file size string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1024)          return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
