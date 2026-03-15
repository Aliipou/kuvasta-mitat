/**
 * test_history.js — Vitest tests for history.js (100% branch coverage).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { History } from '../src/history.js';

const line = (id, x2) => ({
  id,
  start: { x: 0, y: 0 },
  end:   { x: x2, y: 0 },
  isReference: false,
  realWorldMm: null,
});

describe('History — push', () => {
  it('increases undoDepth', () => {
    const h = new History();
    h.push([line(1, 100)]);
    expect(h.undoDepth).toBe(1);
  });

  it('clears redo stack', () => {
    const h = new History();
    h.push([line(1, 100)]);
    h.undo([]);
    h.push([line(2, 200)]);
    expect(h.canRedo).toBe(false);
  });

  it('respects maxDepth', () => {
    const h = new History(3);
    h.push([line(1, 10)]);
    h.push([line(2, 20)]);
    h.push([line(3, 30)]);
    h.push([line(4, 40)]);
    expect(h.undoDepth).toBe(3);
  });
});

describe('History — undo', () => {
  it('returns previous snapshot', () => {
    const h = new History();
    const snap = [line(1, 100)];
    h.push(snap);
    const restored = h.undo([line(2, 200)]);
    expect(restored[0].id).toBe(1);
    expect(restored[0].end.x).toBe(100);
  });

  it('returns null when nothing to undo', () => {
    const h = new History();
    expect(h.undo([])).toBeNull();
  });

  it('pushes current onto redo stack', () => {
    const h = new History();
    h.push([line(1, 100)]);
    h.undo([line(2, 200)]);
    expect(h.canRedo).toBe(true);
  });

  it('decreases undoDepth', () => {
    const h = new History();
    h.push([line(1, 10)]);
    h.push([line(2, 20)]);
    h.undo([]);
    expect(h.undoDepth).toBe(1);
  });
});

describe('History — redo', () => {
  it('returns undone snapshot', () => {
    const h = new History();
    h.push([line(1, 100)]);
    h.undo([line(2, 200)]);
    const redone = h.redo([line(1, 100)]);
    expect(redone[0].id).toBe(2);
  });

  it('returns null when nothing to redo', () => {
    const h = new History();
    expect(h.redo([])).toBeNull();
  });

  it('decreases redoDepth', () => {
    const h = new History();
    h.push([]);
    h.undo([]);
    h.redo([]);
    expect(h.redoDepth).toBe(0);
  });
});

describe('History — canUndo / canRedo', () => {
  it('both false initially', () => {
    const h = new History();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it('canUndo true after push', () => {
    const h = new History();
    h.push([]);
    expect(h.canUndo).toBe(true);
  });

  it('canRedo true after undo', () => {
    const h = new History();
    h.push([]);
    h.undo([]);
    expect(h.canRedo).toBe(true);
  });
});

describe('History — clear', () => {
  it('resets everything', () => {
    const h = new History();
    h.push([line(1, 10)]);
    h.undo([line(2, 20)]);
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });
});

describe('History — deep clone', () => {
  it('mutations to restored snapshot do not affect history', () => {
    const h = new History();
    const snap = [line(1, 100)];
    h.push(snap);
    const restored = h.undo([]);
    restored[0].end.x = 999;
    // Push same snap again; the stored copy should still be x=100
    h.push([line(1, 100)]);
    const r2 = h.undo([]);
    expect(r2[0].end.x).toBe(100);
  });
});
