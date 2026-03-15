/**
 * app.js — Main application orchestrator for kuvasta-mitat.
 *
 * Wires together: ImageUploader → CanvasRuler → ObjectDetector / HandDetector
 *                 → ResultsPanel
 */

import { ImageUploader }  from './upload.js';
import { CanvasRuler }    from './canvas-ruler.js';
import { ObjectDetector, HandDetector } from './detector.js';
import { ResultsPanel }   from './results.js';

// ── DOM refs ─────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const dropZone    = $('drop-zone');
const fileInput   = $('file-input');
const canvas      = $('main-canvas');
const emptyState  = $('empty-state');

const toolDraw       = $('tool-draw');
const toolAutodetect = $('tool-autodetect');
const toolHand       = $('tool-hand');
const toolClear      = $('tool-clear');

const refSelect  = $('ref-select');
const refMmInput = $('ref-mm');
const refSetBtn  = $('ref-set-btn');
const scaleDisp  = $('scale-display');
const scaleVal   = $('scale-value');

const resultsTbody = $('results-body');
const resultsChart = $('results-chart');
const exportBtn    = $('export-btn');

const statusMode   = $('status-mode');
const statusCoords = $('status-coords');
const statusCount  = $('status-count');

const mlOverlay = $('ml-overlay');
const mlLabel   = $('ml-label');

const ctxMenu    = $('ctx-menu');
const ctxSetRef  = $('ctx-set-ref');
const ctxDelete  = $('ctx-delete');

// ── Module instances ──────────────────────────────────────────

const uploader  = new ImageUploader(dropZone, fileInput);
const ruler     = new CanvasRuler(canvas);
const objDet    = new ObjectDetector();
const handDet   = new HandDetector();
const results   = new ResultsPanel(
  resultsTbody, refSelect, resultsChart, exportBtn,
  id => ruler.removeLine(id)
);

let _currentImage = null;
let _ctxTargetId  = null;

// ── Image load ────────────────────────────────────────────────

dropZone.addEventListener('imageloaded', e => {
  _currentImage = e.detail.image;
  emptyState.classList.add('hidden');
  canvas.classList.remove('hidden');
  ruler.loadImage(_currentImage);
  setStatus(`✏ Piirrä viiva kuvaan — ${_currentImage.naturalWidth}×${_currentImage.naturalHeight} px`);
});

// ── Tool buttons ──────────────────────────────────────────────

function setActiveTool(btn) {
  [toolDraw, toolAutodetect, toolHand].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

toolDraw.addEventListener('click', () => {
  setActiveTool(toolDraw);
  setStatus('✏ Klikkaa kaksi pistettä piirtääksesi viivan');
});

toolClear.addEventListener('click', () => {
  ruler.clear();
  setStatus('Tyhjennetty');
});

toolAutodetect.addEventListener('click', async () => {
  if (!_currentImage) return showNotice('Lataa ensin kuva');
  setActiveTool(toolAutodetect);
  await runWithProgress('Tunnistetaan kohteita…', async () => {
    await objDet.load(msg => { mlLabel.textContent = msg; });
    const dets = await objDet.detect(_currentImage);
    if (!dets.length) return showNotice('Kohteita ei löydetty — kokeile manuaalista mittausta');
    ruler.addDetections(dets);
    setStatus(`Tunnistettu ${dets.length} kohdetta`);
  });
});

toolHand.addEventListener('click', async () => {
  if (!_currentImage) return showNotice('Lataa ensin kuva');
  setActiveTool(toolHand);
  await runWithProgress('Mitataan käsi…', async () => {
    await handDet.load(msg => { mlLabel.textContent = msg; });
    const dets = await handDet.detect(_currentImage);
    if (!dets.length) return showNotice('Kättä ei löydetty kuvasta');
    ruler.addDetections(dets);
    setStatus(`Käden mittaus valmis — ${dets.length} mittausta lisätty`);
  });
});

// ── Reference controls ────────────────────────────────────────

refSetBtn.addEventListener('click', () => {
  const id = Number(refSelect.value);
  const mm = parseFloat(refMmInput.value);
  if (!id)          return showNotice('Valitse viiva ensin');
  if (!(mm > 0))    return showNotice('Syötä kelvollinen millimetriarvo');
  try {
    const scale = ruler.setReference(id, mm);
    scaleVal.textContent  = scale.toFixed(4);
    scaleDisp.classList.remove('hidden');
  } catch (err) {
    showNotice(err.message);
  }
});

// ── Context menu (right-click on line) ───────────────────────

canvas.addEventListener('linecontextmenu', e => {
  const { line, clientX, clientY } = e.detail;
  _ctxTargetId = line.id;
  ctxMenu.style.left = `${clientX}px`;
  ctxMenu.style.top  = `${clientY}px`;
  ctxMenu.classList.remove('hidden');
});

document.addEventListener('click', () => {
  ctxMenu.classList.add('hidden');
  _ctxTargetId = null;
});

ctxSetRef.addEventListener('click', () => {
  if (_ctxTargetId == null) return;
  const mm = parseFloat(prompt('Syötä todellinen pituus (mm):'));
  if (!(mm > 0)) return;
  ruler.setReference(_ctxTargetId, mm);
  scaleVal.textContent = ruler.scaleFactor.toFixed(4);
  scaleDisp.classList.remove('hidden');
});

ctxDelete.addEventListener('click', () => {
  if (_ctxTargetId != null) ruler.removeLine(_ctxTargetId);
});

// ── Ruler change handler ──────────────────────────────────────

ruler.on('change', ms => {
  results.update(ms);
  statusCount.textContent = ms.length ? `${ms.length} viivaa` : '';
});

// ── Cursor coordinates ────────────────────────────────────────

canvas.addEventListener('mousemove', e => {
  const r  = canvas.getBoundingClientRect();
  const sx = (canvas.width  / window.devicePixelRatio) / r.width;
  const sy = (canvas.height / window.devicePixelRatio) / r.height;
  const x  = Math.round((e.clientX - r.left) * sx);
  const y  = Math.round((e.clientY - r.top)  * sy);
  statusCoords.textContent = `${x}, ${y} px`;
});
canvas.addEventListener('mouseleave', () => { statusCoords.textContent = ''; });

// ── Export ───────────────────────────────────────────────────

exportBtn.addEventListener('click', () => results.exportCSV());

// ── Drag over canvas area (forward to uploader) ───────────────

document.getElementById('canvas-area').addEventListener('dragover', e => e.preventDefault());
document.getElementById('canvas-area').addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file?.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

// ── Helpers ───────────────────────────────────────────────────

function setStatus(msg) { statusMode.textContent = msg; }

function showNotice(msg) {
  setStatus(`⚠ ${msg}`);
  setTimeout(() => setStatus(''), 3000);
}

async function runWithProgress(label, fn) {
  mlLabel.textContent = label;
  mlOverlay.classList.remove('hidden');
  try {
    await fn();
  } catch (err) {
    showNotice(err.message);
    console.error(err);
  } finally {
    mlOverlay.classList.add('hidden');
  }
}

// ── Init status ───────────────────────────────────────────────

setStatus('Tila: Ei kuvaa — lataa kuva aloittaaksesi');
