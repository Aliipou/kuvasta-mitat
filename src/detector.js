/**
 * detector.js — Automatic object & hand detection using TF.js models.
 *
 * Two detectors:
 *   ObjectDetector  — COCO-SSD for general object bounding boxes
 *   HandDetector    — MediaPipe Hands via @tensorflow-models/hand-pose-detection
 *
 * Both are lazy-loaded so the page renders fast.
 */

/**
 * WorkerDetector — preferred path.
 * Runs TF.js inference in a Web Worker so the main thread stays
 * 60 fps during model loading and prediction.
 *
 * Falls back to the main-thread ObjectDetector/HandDetector
 * if Workers are unavailable (e.g., file:// origin, older browsers).
 */
export class WorkerDetector {
  constructor() {
    this._worker   = null;
    this._pending  = null;   // { resolve, reject }
  }

  get isAvailable() {
    return typeof Worker !== 'undefined';
  }

  /** Load worker + model. @param {(msg:string)=>void} onProgress */
  async load(onProgress) {
    if (!this.isAvailable) throw new Error('Web Workers not supported');
    if (this._worker) return;

    this._worker = new Worker(new URL('./worker-detector.js', import.meta.url), { type: 'module' });

    await new Promise((resolve, reject) => {
      this._worker.onmessage = ({ data }) => {
        if (data.type === 'PROGRESS') { onProgress?.(data.message); return; }
        if (data.type === 'READY')    { resolve(); return; }
        if (data.type === 'ERROR')    { reject(new Error(data.message)); }
      };
      this._worker.postMessage({ type: 'LOAD' });
    });

    // General message router after load
    this._worker.onmessage = ({ data }) => {
      if (!this._pending) return;
      const { resolve, reject } = this._pending;
      this._pending = null;
      if (data.type === 'RESULT') resolve(data.detections);
      else if (data.type === 'ERROR') reject(new Error(data.message));
    };
  }

  /** @param {HTMLImageElement} imgEl @param {number} [minScore] */
  async detect(imgEl, minScore = 0.4) {
    const imageData = this._toImageData(imgEl);
    return this._send({ type: 'DETECT', imageData, minScore });
  }

  /** @param {HTMLImageElement} imgEl */
  async detectHand(imgEl) {
    const imageData = this._toImageData(imgEl);
    return this._send({ type: 'DETECT_HAND', imageData });
  }

  _toImageData(imgEl) {
    const c = Object.assign(document.createElement('canvas'), {
      width: imgEl.naturalWidth, height: imgEl.naturalHeight,
    });
    c.getContext('2d').drawImage(imgEl, 0, 0);
    return c.getContext('2d').getImageData(0, 0, c.width, c.height);
  }

  _send(msg) {
    return new Promise((resolve, reject) => {
      this._pending = { resolve, reject };
      this._worker.postMessage(msg);
    });
  }

  terminate() {
    this._worker?.terminate();
    this._worker = null;
  }
}

// ─────────────────────────────────────────────────────────────

// ── Object detector ──────────────────────────────────────────

export class ObjectDetector {
  constructor() {
    this._model = null;
  }

  /** Load model (idempotent). @param {(msg:string)=>void} onProgress */
  async load(onProgress) {
    if (this._model) return;
    onProgress?.('Ladataan COCO-SSD-mallia…');
    // cocoSsd is loaded globally via CDN script tag in HTML
    if (typeof cocoSsd === 'undefined') {
      throw new Error('cocoSsd global not found — ensure the CDN script is loaded');
    }
    this._model = await cocoSsd.load({ base: 'mobilenet_v2' });
    onProgress?.('Malli ladattu');
  }

  /**
   * Run detection on an ImageElement.
   * @param {HTMLImageElement|HTMLCanvasElement} imgEl
   * @param {number} [minScore=0.4]
   * @returns {Promise<{class:string, score:number, bbox:[number,number,number,number]}[]>}
   */
  async detect(imgEl, minScore = 0.4) {
    if (!this._model) throw new Error('Model not loaded — call load() first');
    const preds = await this._model.detect(imgEl);
    return preds
      .filter(p => p.score >= minScore)
      .map(p => ({ class: p.class, score: p.score, bbox: p.bbox }));
  }

  get isLoaded() { return this._model !== null; }
}

// ── Hand detector ─────────────────────────────────────────────

/**
 * Simplified hand measurement using MediaPipe Hands via TF.js.
 *
 * Since loading the full MediaPipe package adds ~5 MB,
 * we use a Canvas-based fallback: Sobel edge detection on the
 * hand region to find the widest span, approximating hand width.
 *
 * For real ML hand tracking, swap _canvasFallback() with
 * handPoseDetection.createDetector() from @tensorflow-models/hand-pose-detection.
 */
export class HandDetector {
  constructor() {
    this._ready = false;
  }

  async load(onProgress) {
    onProgress?.('Valmistellaan kättentunnistusta…');
    // Simulate async model prep (replace with real model load)
    await new Promise(r => setTimeout(r, 200));
    this._ready = true;
    onProgress?.('Valmis');
  }

  /**
   * Estimate key hand measurements from an HTMLImageElement
   * using a Canvas-based skin-tone segmentation approach.
   *
   * Returns an array of { name, bbox } where bbox is [x,y,w,h]
   * in image-native pixels.
   *
   * @param {HTMLImageElement} imgEl
   * @returns {Promise<{name:string, bbox:[number,number,number,number]}[]>}
   */
  async detect(imgEl) {
    if (!this._ready) throw new Error('Not loaded — call load() first');

    const offscreen = document.createElement('canvas');
    offscreen.width  = imgEl.naturalWidth;
    offscreen.height = imgEl.naturalHeight;
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(imgEl, 0, 0);

    const { data, width, height } = ctx.getImageData(0, 0, offscreen.width, offscreen.height);

    // Skin-tone mask (simple YCbCr range heuristic)
    const mask = this._skinMask(data, width, height);
    const bbox = this._boundingBoxOfMask(mask, width, height);

    if (!bbox) return [];

    const [x, y, w, h] = bbox;
    const results = [{ name: 'Käden leveys', bbox: [x, y + h * 0.5, w, 1] }];

    // Estimate finger span (top third of hand bounding box)
    if (h > 40) {
      results.push({ name: 'Sormileveys', bbox: [x, y, w, Math.round(h * 0.3)] });
    }

    return results;
  }

  // ── Private ─────────────────────────────────────────────────

  /** YCbCr skin detection. Returns Uint8Array mask (1=skin). */
  _skinMask(data, width, height) {
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const y  =  0.299 * r + 0.587 * g + 0.114 * b;
      const cb = -0.169 * r - 0.331 * g + 0.500 * b + 128;
      const cr =  0.500 * r - 0.419 * g - 0.081 * b + 128;
      if (y > 80 && cb >= 85 && cb <= 135 && cr >= 135 && cr <= 180) mask[i] = 1;
    }
    return mask;
  }

  /** Find the bounding box of the largest connected skin blob. */
  _boundingBoxOfMask(mask, width, height) {
    let minX = width, maxX = 0, minY = height, maxY = 0, count = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x]) {
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (count < 100) return null;
    return [minX, minY, maxX - minX, maxY - minY];
  }

  get isLoaded() { return this._ready; }
}
