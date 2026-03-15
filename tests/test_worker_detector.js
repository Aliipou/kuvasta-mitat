/**
 * test_worker_detector.js — Unit tests for worker-detector.js logic.
 *
 * We test the skin-segmentation algorithm by extracting it as a pure
 * function (same logic used in the worker) without spinning up a Worker.
 */

import { describe, it, expect } from 'vitest';

// ── Pure helpers extracted from worker-detector.js ───────────

/**
 * YCbCr skin mask — same logic as worker.
 * Returns [minX, minY, width, height] or null.
 */
function skinBBox(data, width, height) {
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
  if (count < 100) return null;
  return [minX, minY, maxX - minX, maxY - minY];
}

/** Generate a flat RGBA buffer filled with a single colour. */
function solidBuffer(w, h, r, g, b, a = 255) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4]     = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = a;
  }
  return buf;
}

/** Approximate skin tone (RGB ≈ 220, 170, 130). */
const SKIN_R = 220, SKIN_G = 170, SKIN_B = 130;

// ── Tests ─────────────────────────────────────────────────────

describe('skinBBox — skin colour detection', () => {
  it('detects a skin-tone block', () => {
    const buf = solidBuffer(50, 50, SKIN_R, SKIN_G, SKIN_B);
    const bbox = skinBBox(buf, 50, 50);
    expect(bbox).not.toBeNull();
  });

  it('returns null for non-skin colour (pure blue)', () => {
    const buf = solidBuffer(50, 50, 0, 0, 255);
    expect(skinBBox(buf, 50, 50)).toBeNull();
  });

  it('returns null for black image', () => {
    const buf = solidBuffer(50, 50, 0, 0, 0);
    expect(skinBBox(buf, 50, 50)).toBeNull();
  });

  it('returns null when skin pixel count < 100', () => {
    // Only 4×4 = 16 skin pixels inside a 100×100 black image
    const buf = solidBuffer(100, 100, 0, 0, 0);
    // Inject 16 skin pixels in top-left corner
    for (let i = 0; i < 16; i++) {
      buf[i * 4] = SKIN_R; buf[i * 4 + 1] = SKIN_G; buf[i * 4 + 2] = SKIN_B;
    }
    expect(skinBBox(buf, 100, 100)).toBeNull();
  });

  it('bounding box covers the skin region', () => {
    const W = 100, H = 100;
    const buf = solidBuffer(W, H, 0, 0, 0);
    // Skin block from (20,20) to (79,79) = 60×60 = 3600 pixels
    for (let y = 20; y < 80; y++) {
      for (let x = 20; x < 80; x++) {
        const i = (y * W + x) * 4;
        buf[i] = SKIN_R; buf[i+1] = SKIN_G; buf[i+2] = SKIN_B; buf[i+3] = 255;
      }
    }
    const [bx, by, bw, bh] = skinBBox(buf, W, H);
    expect(bx).toBe(20);
    expect(by).toBe(20);
    expect(bw).toBe(59);  // maxX - minX = 79 - 20
    expect(bh).toBe(59);
  });
});

describe('skinBBox — detection result', () => {
  it('returns four-element array on success', () => {
    const buf = solidBuffer(50, 50, SKIN_R, SKIN_G, SKIN_B);
    const r = skinBBox(buf, 50, 50);
    expect(r).toHaveLength(4);
  });

  it('all values are non-negative', () => {
    const buf = solidBuffer(50, 50, SKIN_R, SKIN_G, SKIN_B);
    const r = skinBBox(buf, 50, 50);
    r.forEach(v => expect(v).toBeGreaterThanOrEqual(0));
  });
});
