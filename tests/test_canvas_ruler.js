/**
 * test_canvas_ruler.js — Vitest tests for CanvasRuler (100% branch coverage).
 *
 * Uses jsdom (Vitest default) + a mock HTMLCanvasElement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasRuler } from '../src/canvas-ruler.js';

// ── Canvas mock ───────────────────────────────────────────────

function makeCanvas() {
  const ctx = {
    clearRect: vi.fn(), drawImage: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    stroke: vi.fn(), fill: vi.fn(), arc: vi.fn(),
    fillRect: vi.fn(), fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(),
    quadraticCurveTo: vi.fn(), closePath: vi.fn(),
    setLineDash: vi.fn(),
    scale: vi.fn(),
    strokeStyle: '', fillStyle: '', lineWidth: 0,
    lineCap: '', font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1,
  };
  const canvas = {
    getContext: () => ctx,
    width: 800, height: 600,
    style: { width: '', height: '' },
    parentElement: { clientWidth: 800, clientHeight: 600 },
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
  return { canvas, ctx };
}

function makeImage(w = 400, h = 300) {
  return { naturalWidth: w, naturalHeight: h };
}

// ── Helper to simulate a canvas ruler with events captured ───

function makeRuler() {
  const { canvas } = makeCanvas();
  const eventListeners = {};
  canvas.addEventListener = (ev, fn) => { eventListeners[ev] = fn; };
  window.devicePixelRatio = 1;

  // Stub window.addEventListener
  const origWin = window.addEventListener;
  vi.spyOn(window, 'addEventListener').mockImplementation(() => {});

  const ruler = new CanvasRuler(canvas);

  window.addEventListener = origWin;
  return { ruler, canvas, eventListeners };
}

// ── Tests ─────────────────────────────────────────────────────

describe('CanvasRuler — initial state', () => {
  it('starts with empty measurements', () => {
    const { ruler } = makeRuler();
    expect(ruler.getMeasurements()).toEqual([]);
  });

  it('scaleFactor is null initially', () => {
    const { ruler } = makeRuler();
    expect(ruler.scaleFactor).toBeNull();
  });
});

describe('CanvasRuler — loadImage', () => {
  it('clears previous lines when new image is loaded', () => {
    const { ruler } = makeRuler();
    // Manually inject a line
    ruler._lines.push({ id: 1, start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, isReference: false, realWorldMm: null });
    ruler.loadImage(makeImage());
    expect(ruler.getMeasurements()).toEqual([]);
  });

  it('emits change event after load', () => {
    const { ruler } = makeRuler();
    const cb = vi.fn();
    ruler.on('change', cb);
    ruler.loadImage(makeImage());
    expect(cb).toHaveBeenCalledOnce();
  });
});

describe('CanvasRuler — drawing lines', () => {
  it('adds a line after two clicks', () => {
    const { ruler, eventListeners } = makeRuler();
    const click = eventListeners['click'];
    click({ clientX: 10, clientY: 20 });
    click({ clientX: 110, clientY: 120 });
    expect(ruler.getMeasurements().length).toBe(1);
  });

  it('measurement px is correct (Pythagorean distance)', () => {
    const { ruler, eventListeners } = makeRuler();
    const click = eventListeners['click'];
    click({ clientX: 0, clientY: 0 });
    click({ clientX: 30, clientY: 40 });
    expect(ruler.getMeasurements()[0].px).toBe(50);
  });

  it('mm is null before reference is set', () => {
    const { ruler, eventListeners } = makeRuler();
    const click = eventListeners['click'];
    click({ clientX: 0, clientY: 0 });
    click({ clientX: 100, clientY: 0 });
    expect(ruler.getMeasurements()[0].mm).toBeNull();
  });
});

describe('CanvasRuler — setReference', () => {
  function rulerWithOneLine() {
    const { ruler, eventListeners } = makeRuler();
    const click = eventListeners['click'];
    click({ clientX: 0, clientY: 0 });
    click({ clientX: 200, clientY: 0 });
    return ruler;
  }

  it('sets scale factor', () => {
    const ruler = rulerWithOneLine();
    const id = ruler.getMeasurements()[0].id;
    ruler.setReference(id, 100);
    expect(ruler.scaleFactor).toBeCloseTo(2.0);
  });

  it('marks line as reference', () => {
    const ruler = rulerWithOneLine();
    const id = ruler.getMeasurements()[0].id;
    ruler.setReference(id, 100);
    expect(ruler.getMeasurements()[0].isReference).toBe(true);
  });

  it('mm value is now populated', () => {
    const ruler = rulerWithOneLine();
    const id = ruler.getMeasurements()[0].id;
    ruler.setReference(id, 100);
    expect(ruler.getMeasurements()[0].mm).toBeCloseTo(100);
  });

  it('throws on non-positive mm', () => {
    const ruler = rulerWithOneLine();
    const id = ruler.getMeasurements()[0].id;
    expect(() => ruler.setReference(id, 0)).toThrow(RangeError);
    expect(() => ruler.setReference(id, -1)).toThrow(RangeError);
  });

  it('throws on unknown id', () => {
    const ruler = rulerWithOneLine();
    expect(() => ruler.setReference(999, 50)).toThrow(/not found/i);
  });

  it('clears previous reference when new one set', () => {
    const { ruler, eventListeners } = makeRuler();
    const click = eventListeners['click'];
    click({ clientX: 0, clientY: 0 }); click({ clientX: 100, clientY: 0 });
    click({ clientX: 0, clientY: 0 }); click({ clientX: 200, clientY: 0 });
    const [m1, m2] = ruler.getMeasurements();
    ruler.setReference(m1.id, 50);
    ruler.setReference(m2.id, 100);
    expect(ruler.getMeasurements().find(m => m.id === m1.id).isReference).toBe(false);
    expect(ruler.getMeasurements().find(m => m.id === m2.id).isReference).toBe(true);
  });
});

describe('CanvasRuler — removeLine', () => {
  it('removes a line by id', () => {
    const { ruler, eventListeners } = makeRuler();
    const click = eventListeners['click'];
    click({ clientX: 0, clientY: 0 }); click({ clientX: 100, clientY: 0 });
    const id = ruler.getMeasurements()[0].id;
    ruler.removeLine(id);
    expect(ruler.getMeasurements().length).toBe(0);
  });

  it('resets scale when reference line is removed', () => {
    const { ruler, eventListeners } = makeRuler();
    const click = eventListeners['click'];
    click({ clientX: 0, clientY: 0 }); click({ clientX: 200, clientY: 0 });
    const id = ruler.getMeasurements()[0].id;
    ruler.setReference(id, 100);
    ruler.removeLine(id);
    expect(ruler.scaleFactor).toBeNull();
  });

  it('does nothing for unknown id', () => {
    const { ruler } = makeRuler();
    expect(() => ruler.removeLine(999)).not.toThrow();
  });
});

describe('CanvasRuler — clear', () => {
  it('removes all lines and resets scale', () => {
    const { ruler, eventListeners } = makeRuler();
    const click = eventListeners['click'];
    click({ clientX: 0, clientY: 0 }); click({ clientX: 200, clientY: 0 });
    ruler.setReference(ruler.getMeasurements()[0].id, 100);
    ruler.clear();
    expect(ruler.getMeasurements()).toEqual([]);
    expect(ruler.scaleFactor).toBeNull();
  });
});

describe('CanvasRuler — addDetections', () => {
  it('adds a line for each detection', () => {
    const { ruler } = makeRuler();
    ruler._image = makeImage(400, 300);
    ruler._canvas.width = 400;
    ruler._canvas.height = 300;
    ruler.addDetections([
      { bbox: [10, 20, 80, 60] },
      { bbox: [100, 50, 60, 40] },
    ]);
    expect(ruler.getMeasurements().length).toBe(2);
  });
});
