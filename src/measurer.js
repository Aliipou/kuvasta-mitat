/**
 * measurer.js — Scale management and pixel-to-mm conversion.
 *
 * Pure functions; no DOM or Canvas dependency.
 */

/**
 * Compute px/mm scale from a known reference line.
 * @param {number} referencePx   Length of reference line in pixels
 * @param {number} referenceMm   Known real-world length in mm
 * @returns {number}  Pixels per mm
 */
export function computeScale(referencePx, referenceMm) {
  if (referencePx <= 0)  throw new RangeError('referencePx must be > 0');
  if (referenceMm <= 0)  throw new RangeError('referenceMm must be > 0');
  return referencePx / referenceMm;
}

/**
 * Convert a pixel length to millimetres.
 * Returns null when scale is unknown.
 * @param {number}       px
 * @param {number|null}  pxPerMm
 * @returns {number|null}
 */
export function pxToMm(px, pxPerMm) {
  if (pxPerMm == null || pxPerMm <= 0) return null;
  return px / pxPerMm;
}

/**
 * Enrich a raw measurements array with mm values.
 * @param {{ id:number, px:number, isReference:boolean }[]} raw
 * @param {number|null} pxPerMm
 * @returns {{ id:number, px:number, mm:number|null, isReference:boolean }[]}
 */
export function enrichMeasurements(raw, pxPerMm) {
  return raw.map(m => ({ ...m, mm: pxToMm(m.px, pxPerMm) }));
}

/**
 * Format a measurement for display.
 * @param {{ px:number, mm:number|null }} m
 * @returns {string}
 */
export function formatMeasurement(m) {
  if (m.mm != null) return `${m.mm.toFixed(1)} mm`;
  return `${Math.round(m.px)} px`;
}

/**
 * Export measurements to CSV string.
 * @param {{ label:string, px:number, mm:number|null, isReference:boolean }[]} measurements
 * @returns {string}
 */
export function toCSV(measurements) {
  const header = 'Label,Pixels,Millimetres,Reference';
  const rows = measurements.map(m =>
    `${m.label},${m.px},${m.mm != null ? m.mm.toFixed(2) : ''},${m.isReference ? 'yes' : 'no'}`
  );
  return [header, ...rows].join('\n');
}
