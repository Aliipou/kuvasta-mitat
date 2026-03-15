/**
 * canvas-ruler.js — Interactive measurement overlay drawn on an HTML5 Canvas.
 *
 * Usage:
 *   const ruler = new CanvasRuler(canvasEl);
 *   ruler.loadImage(imgEl);
 *   ruler.on('change', measurements => console.log(measurements));
 */

const PALETTE = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFA07A','#DDA0DD','#87CEEB','#98FB98'];
const REF_COLOR = '#FFD700';

/** @typedef {{ id:number, start:{x:number,y:number}, end:{x:number,y:number}, isReference:boolean, realWorldMm:number|null }} Line */
/** @typedef {{ id:number, label:string, px:number, mm:number|null, isReference:boolean }} Measurement */

export class CanvasRuler {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._canvas   = canvas;
    this._ctx      = canvas.getContext('2d');
    /** @type {Line[]} */
    this._lines    = [];
    this._drawing  = null;   // { start: {x,y} } while user draws
    this._hover    = null;   // mouse position during draw
    this._nextId   = 1;
    this._scale    = null;   // px per mm
    this._image    = null;   // HTMLImageElement
    this._dpr      = window.devicePixelRatio || 1;
    this._listeners = { change: [] };

    this._bindEvents();
  }

  // ── Public API ───────────────────────────────────────────────

  /** Load and display an image; clear previous state. */
  loadImage(img) {
    this._lines   = [];
    this._drawing = null;
    this._scale   = null;
    this._image   = img;
    this._resize();
    this._redraw();
    this._emit();
  }

  /** Register an event listener. @param {'change'} event @param {Function} fn */
  on(event, fn) {
    (this._listeners[event] ??= []).push(fn);
    return this;
  }

  /** Remove all measurement lines and reset scale. */
  clear() {
    this._lines   = [];
    this._drawing = null;
    this._scale   = null;
    this._redraw();
    this._emit();
  }

  /**
   * Set a line as the physical reference.
   * @param {number} id  Line id
   * @param {number} mm  Real-world length in millimetres
   */
  setReference(id, mm) {
    if (mm <= 0) throw new RangeError('Reference length must be positive');
    this._lines.forEach(l => { l.isReference = false; });
    const line = this._lines.find(l => l.id === id);
    if (!line) throw new Error(`Line ${id} not found`);
    line.isReference  = true;
    line.realWorldMm  = mm;
    this._scale = this._lineLength(line.start, line.end) / mm;
    this._redraw();
    this._emit();
    return this._scale;
  }

  /** Remove a line by id. */
  removeLine(id) {
    const line = this._lines.find(l => l.id === id);
    if (!line) return;
    if (line.isReference) this._scale = null;
    this._lines = this._lines.filter(l => l.id !== id);
    this._redraw();
    this._emit();
  }

  /** @returns {Measurement[]} */
  getMeasurements() {
    return this._lines.map((l, i) => ({
      id: l.id,
      label: `L${i + 1}`,
      px: Math.round(this._lineLength(l.start, l.end)),
      mm: this._scale ? this._lineLength(l.start, l.end) / this._scale : null,
      isReference: l.isReference,
    }));
  }

  /** Current px/mm scale factor (null if no reference set). */
  get scaleFactor() { return this._scale; }

  /** Add auto-detected bounding boxes as measurement lines. */
  addDetections(detections) {
    for (const det of detections) {
      const { bbox } = det;        // [x, y, w, h] in image-space px
      const sx = this._canvas.width  / (this._image?.naturalWidth  || 1);
      const sy = this._canvas.height / (this._image?.naturalHeight || 1);
      const x = bbox[0] * sx, y = bbox[1] * sy;
      const w = bbox[2] * sx, h = bbox[3] * sy;
      // Horizontal span (width) of bounding box
      this._commitLine({ x, y: y + h / 2 }, { x: x + w, y: y + h / 2 });
    }
    this._redraw();
    this._emit();
  }

  // ── Event binding ────────────────────────────────────────────

  _bindEvents() {
    const c = this._canvas;
    c.addEventListener('click',       this._onClick.bind(this));
    c.addEventListener('mousemove',   this._onMouseMove.bind(this));
    c.addEventListener('contextmenu', this._onContextMenu.bind(this));
    window.addEventListener('resize', () => { if (this._image) { this._resize(); this._redraw(); } });
  }

  /** Convert a MouseEvent to canvas-space coordinates (DPR-aware). */
  _pos(e) {
    const r  = this._canvas.getBoundingClientRect();
    const sx = this._canvas.width  / r.width;
    const sy = this._canvas.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  _onClick(e) {
    const p = this._pos(e);
    if (!this._drawing) {
      this._drawing = { start: p };
    } else {
      this._commitLine(this._drawing.start, p);
      this._drawing = null;
      this._redraw();
      this._emit();
    }
  }

  _onMouseMove(e) {
    this._hover = this._pos(e);
    if (this._drawing) this._redraw();
  }

  _onContextMenu(e) {
    e.preventDefault();
    const p    = this._pos(e);
    const line = this._nearestLine(p, 10);
    if (line) this._canvas.dispatchEvent(
      new CustomEvent('linecontextmenu', { bubbles: true, detail: { line, clientX: e.clientX, clientY: e.clientY } })
    );
  }

  // ── Internal helpers ─────────────────────────────────────────

  _commitLine(start, end) {
    this._lines.push({ id: this._nextId++, start, end, isReference: false, realWorldMm: null });
  }

  _resize() {
    if (!this._image) return;
    const parent = this._canvas.parentElement;
    const ratio  = Math.min(
      parent.clientWidth  / this._image.naturalWidth,
      parent.clientHeight / this._image.naturalHeight,
      1
    );
    this._canvas.style.width  = `${this._image.naturalWidth  * ratio}px`;
    this._canvas.style.height = `${this._image.naturalHeight * ratio}px`;
    this._canvas.width  = this._image.naturalWidth  * ratio * this._dpr;
    this._canvas.height = this._image.naturalHeight * ratio * this._dpr;
    this._ctx.scale(this._dpr, this._dpr);
  }

  _redraw() {
    const { _ctx: ctx, _canvas: c } = this;
    const W = c.width  / this._dpr;
    const H = c.height / this._dpr;

    ctx.clearRect(0, 0, W, H);

    if (this._image) {
      ctx.drawImage(this._image, 0, 0, W, H);
    }

    // Committed lines
    this._lines.forEach((l, i) => {
      const color = l.isReference ? REF_COLOR : PALETTE[i % PALETTE.length];
      const px    = this._lineLength(l.start, l.end);
      const mm    = this._scale ? px / this._scale : null;
      this._drawLine(l.start, l.end, color, `L${i+1}`, px, mm, l.isReference);
    });

    // In-progress ghost line
    if (this._drawing && this._hover) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.7;
      this._drawLine(this._drawing.start, this._hover, '#ffffff', null, null, null, false);
      ctx.restore();
    }
  }

  /**
   * Draw one measurement line with arrowheads and a label badge.
   */
  _drawLine(a, b, color, label, px, mm, isRef) {
    const ctx = this._ctx;
    ctx.save();

    // Stroke
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // Endpoint circles
    ctx.fillStyle = color;
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Arrowhead at b
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    this._arrowHead(ctx, b, angle, color);

    // Label badge
    if (label !== null && px !== null) {
      const text = mm != null ? `${mm.toFixed(1)} mm` : `${Math.round(px)} px`;
      const mid  = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this._badge(ctx, mid, label ? `${label}: ${text}` : text, color, isRef);
    }

    ctx.restore();
  }

  _arrowHead(ctx, tip, angle, color) {
    const size = 8;
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size / 2);
    ctx.lineTo(-size,  size / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _badge(ctx, pos, text, textColor, star) {
    ctx.font         = 'bold 11px system-ui';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + (star ? 22 : 10);
    const h = 18;

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    this._roundRect(ctx, pos.x - w / 2, pos.y - h / 2, w, h, 4);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.fillText(text, pos.x, pos.y);

    if (star) {
      ctx.fillStyle = REF_COLOR;
      ctx.font = '10px system-ui';
      ctx.fillText('★', pos.x + w / 2 - 8, pos.y);
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _lineLength(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  _nearestLine(p, threshold) {
    let best = null, bestD = threshold;
    for (const l of this._lines) {
      const d = this._ptSegDist(p, l.start, l.end);
      if (d < bestD) { bestD = d; best = l; }
    }
    return best;
  }

  _ptSegDist(p, a, b) {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const ap = { x: p.x - a.x, y: p.y - a.y };
    const len2 = ab.x ** 2 + ab.y ** 2;
    if (len2 === 0) return Math.hypot(ap.x, ap.y);
    const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / len2));
    return Math.hypot(p.x - (a.x + t * ab.x), p.y - (a.y + t * ab.y));
  }

  _emit() {
    const ms = this.getMeasurements();
    this._listeners.change.forEach(fn => fn(ms));
  }
}
