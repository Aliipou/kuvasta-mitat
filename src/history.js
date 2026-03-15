/**
 * history.js — Undo/redo stack for canvas ruler operations.
 *
 * Stores snapshots of the ruler's line array so any action
 * (add, delete, set-reference, clear) can be undone/redone.
 *
 * Usage:
 *   const history = new History(maxDepth);
 *   history.push(ruler.getState());          // after every change
 *   const prev = history.undo();             // restore previous state
 *   const next = history.redo();             // re-apply undone state
 */

/** @typedef {import('./canvas-ruler.js').Line[]} Snapshot */

export class History {
  /**
   * @param {number} maxDepth  Maximum undo steps stored (default 50).
   */
  constructor(maxDepth = 50) {
    this._max    = maxDepth;
    /** @type {Snapshot[]} */
    this._past   = [];   // stack of previous states
    /** @type {Snapshot[]} */
    this._future = [];   // stack of undone states
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Record a new snapshot.  Clears the redo stack.
   * @param {Snapshot} snapshot  Deep-cloned state to store.
   */
  push(snapshot) {
    this._past.push(this._clone(snapshot));
    if (this._past.length > this._max) this._past.shift();
    this._future = [];
  }

  /**
   * Undo: pop the last snapshot, push current onto redo stack.
   * @param {Snapshot} current  Current state before undo.
   * @returns {Snapshot|null}   State to restore, or null if nothing to undo.
   */
  undo(current) {
    if (!this._past.length) return null;
    this._future.push(this._clone(current));
    return this._clone(this._past.pop());
  }

  /**
   * Redo: pop from redo stack, push current onto undo stack.
   * @param {Snapshot} current
   * @returns {Snapshot|null}
   */
  redo(current) {
    if (!this._future.length) return null;
    this._past.push(this._clone(current));
    return this._clone(this._future.pop());
  }

  get canUndo() { return this._past.length > 0; }
  get canRedo() { return this._future.length > 0; }
  get undoDepth() { return this._past.length; }
  get redoDepth() { return this._future.length; }

  /** Reset to empty state. */
  clear() {
    this._past   = [];
    this._future = [];
  }

  // ── Private ──────────────────────────────────────────────────

  /** Deep clone a snapshot (lines contain plain objects + typed arrays). */
  _clone(snapshot) {
    return snapshot.map(line => ({
      ...line,
      start:   { ...line.start },
      end:     { ...line.end },
      contour: line.contour
        ? new Int32Array(line.contour)
        : undefined,
    }));
  }
}
