/**
 * worker-detector.js — Web Worker entry point for TF.js inference.
 *
 * Offloads COCO-SSD and hand-detection from the main thread so the
 * UI stays responsive during model loading and inference.
 *
 * Communication protocol:
 *
 *   Main → Worker:  { type: 'LOAD' }
 *                   { type: 'DETECT', imageData: ImageData, minScore: number }
 *                   { type: 'DETECT_HAND', imageData: ImageData }
 *
 *   Worker → Main:  { type: 'READY' }
 *                   { type: 'PROGRESS', message: string }
 *                   { type: 'RESULT',   detections: Detection[] }
 *                   { type: 'ERROR',    message: string }
 *
 * Falls back gracefully if importScripts fails (e.g., no internet in test env).
 */

/* global cocoSsd */

let _model = null;

self.onmessage = async ({ data }) => {
  try {
    switch (data.type) {
      case 'LOAD':
        await _loadModel();
        break;
      case 'DETECT':
        await _detect(data.imageData, data.minScore ?? 0.4);
        break;
      case 'DETECT_HAND':
        await _detectHand(data.imageData);
        break;
      default:
        throw new Error(`Unknown message type: ${data.type}`);
    }
  } catch (err) {
    self.postMessage({ type: 'ERROR', message: err.message });
  }
};

async function _loadModel() {
  if (_model) { self.postMessage({ type: 'READY' }); return; }

  self.postMessage({ type: 'PROGRESS', message: 'Loading TensorFlow.js…' });
  importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js');

  self.postMessage({ type: 'PROGRESS', message: 'Loading COCO-SSD model…' });
  importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');

  _model = await cocoSsd.load({ base: 'mobilenet_v2' });
  self.postMessage({ type: 'READY' });
}

async function _detect(imageData, minScore) {
  if (!_model) await _loadModel();

  // Reconstruct ImageBitmap from ImageData in worker scope
  const bitmap  = await createImageBitmap(imageData);
  const canvas  = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx     = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);

  const preds = await _model.detect(canvas);
  const dets  = preds
    .filter(p => p.score >= minScore)
    .map(p => ({ class: p.class, score: p.score, bbox: p.bbox }));

  self.postMessage({ type: 'RESULT', detections: dets });
}

async function _detectHand(imageData) {
  // Skin-tone heuristic (same as detector.js but runs off-thread)
  const { data, width, height } = imageData;
  let minX = width, maxX = 0, minY = height, maxY = 0, count = 0;

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const y  =  0.299 * r + 0.587 * g + 0.114 * b;
    const cb = -0.169 * r - 0.331 * g + 0.500 * b + 128;
    const cr =  0.500 * r - 0.419 * g - 0.081 * b + 128;
    if (y > 80 && cb >= 85 && cb <= 135 && cr >= 135 && cr <= 180) {
      count++;
      const x = i % width, yi = Math.floor(i / width);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (yi < minY) minY = yi; if (yi > maxY) maxY = yi;
    }
  }

  if (count < 100) {
    self.postMessage({ type: 'RESULT', detections: [] });
    return;
  }

  const w = maxX - minX, h = maxY - minY;
  self.postMessage({
    type: 'RESULT',
    detections: [
      { name: 'Käden leveys', bbox: [minX, minY + h * 0.5, w, 1] },
      ...(h > 40 ? [{ name: 'Sormileveys', bbox: [minX, minY, w, Math.round(h * 0.3)] }] : []),
    ],
  });
}
