/**
 * test_measurer.js — Vitest unit tests for measurer.js (100% coverage).
 */

import { describe, it, expect } from 'vitest';
import {
  computeScale,
  pxToMm,
  enrichMeasurements,
  formatMeasurement,
  toCSV,
} from '../src/measurer.js';

// ── computeScale ─────────────────────────────────────────────

describe('computeScale', () => {
  it('returns px/mm ratio', () => {
    expect(computeScale(200, 100)).toBe(2);
  });

  it('works with fractional values', () => {
    expect(computeScale(150, 50)).toBeCloseTo(3.0);
  });

  it('throws on zero referencePx', () => {
    expect(() => computeScale(0, 100)).toThrow(RangeError);
  });

  it('throws on negative referencePx', () => {
    expect(() => computeScale(-1, 100)).toThrow(RangeError);
  });

  it('throws on zero referenceMm', () => {
    expect(() => computeScale(100, 0)).toThrow(RangeError);
  });

  it('throws on negative referenceMm', () => {
    expect(() => computeScale(100, -5)).toThrow(RangeError);
  });
});

// ── pxToMm ───────────────────────────────────────────────────

describe('pxToMm', () => {
  it('converts px to mm with valid scale', () => {
    expect(pxToMm(200, 2)).toBe(100);
  });

  it('returns null when scale is null', () => {
    expect(pxToMm(100, null)).toBeNull();
  });

  it('returns null when scale is undefined', () => {
    expect(pxToMm(100, undefined)).toBeNull();
  });

  it('returns null when scale is zero', () => {
    expect(pxToMm(100, 0)).toBeNull();
  });

  it('returns null when scale is negative', () => {
    expect(pxToMm(100, -1)).toBeNull();
  });

  it('handles zero px', () => {
    expect(pxToMm(0, 2)).toBe(0);
  });
});

// ── enrichMeasurements ────────────────────────────────────────

describe('enrichMeasurements', () => {
  const raw = [
    { id: 1, px: 200, isReference: true },
    { id: 2, px: 100, isReference: false },
  ];

  it('adds mm when scale provided', () => {
    const result = enrichMeasurements(raw, 2);
    expect(result[0].mm).toBe(100);
    expect(result[1].mm).toBe(50);
  });

  it('adds null mm when scale null', () => {
    const result = enrichMeasurements(raw, null);
    expect(result[0].mm).toBeNull();
    expect(result[1].mm).toBeNull();
  });

  it('preserves all original fields', () => {
    const result = enrichMeasurements(raw, 2);
    expect(result[0].id).toBe(1);
    expect(result[0].isReference).toBe(true);
  });

  it('handles empty array', () => {
    expect(enrichMeasurements([], 2)).toEqual([]);
  });
});

// ── formatMeasurement ─────────────────────────────────────────

describe('formatMeasurement', () => {
  it('shows mm when available', () => {
    expect(formatMeasurement({ px: 200, mm: 100.5 })).toBe('100.5 mm');
  });

  it('shows px when mm is null', () => {
    expect(formatMeasurement({ px: 200, mm: null })).toBe('200 px');
  });

  it('rounds px to integer', () => {
    expect(formatMeasurement({ px: 199.7, mm: null })).toBe('200 px');
  });

  it('formats mm to one decimal', () => {
    expect(formatMeasurement({ px: 100, mm: 50.123 })).toBe('50.1 mm');
  });
});

// ── toCSV ────────────────────────────────────────────────────

describe('toCSV', () => {
  const ms = [
    { label: 'L1', px: 200, mm: 100, isReference: true },
    { label: 'L2', px: 100, mm: null, isReference: false },
  ];

  it('has header row', () => {
    const csv = toCSV(ms);
    expect(csv.startsWith('Label,Pixels,Millimetres,Reference')).toBe(true);
  });

  it('includes reference flag', () => {
    const csv = toCSV(ms);
    expect(csv).toContain(',yes');
    expect(csv).toContain(',no');
  });

  it('handles null mm (empty field)', () => {
    const csv = toCSV(ms);
    const lines = csv.split('\n');
    expect(lines[2]).toContain('L2,100,,no');
  });

  it('works with empty array', () => {
    const csv = toCSV([]);
    expect(csv).toBe('Label,Pixels,Millimetres,Reference');
  });
});
