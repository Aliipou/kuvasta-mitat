# Kuvasta Mitat

> **Measure anything in a photo — zero install, runs entirely in the browser.**

Draw measurement lines on any image, set one line as a known physical reference, and every other line converts to real-world millimetres instantly. Includes Web Worker-based TF.js inference, undo/redo, PWA offline support, and automatic large-image downscaling.

![License](https://img.shields.io/badge/license-MIT-blue)
![Tests](https://img.shields.io/badge/coverage-100%25-brightgreen)
![No build step](https://img.shields.io/badge/build-none-lightgrey)
![PWA](https://img.shields.io/badge/PWA-installable-blueviolet)

---

## Features

| | |
|---|---|
| **Drag & drop upload** | JPEG · PNG · WEBP · TIFF — drop or click to browse |
| **Canvas ruler** | Click two points to draw a labelled measurement line |
| **Pixel → mm conversion** | Set any line as reference; all others update instantly |
| **Auto object detection** | TF.js COCO-SSD finds objects and measures bounding boxes |
| **Hand measurement** | YCbCr skin-tone segmentation estimates hand width and finger span |
| **Web Worker inference** | TF.js runs off the main thread — UI stays responsive at 60 fps |
| **Undo / Redo** | Full history stack with deep-clone snapshots (Ctrl+Z / Ctrl+Y) |
| **Image auto-resize** | Images > 1280 px or > 10 MB are downscaled before inference |
| **Live results panel** | Chart.js bar chart + measurement table update in real time |
| **CSV export** | Download all measurements as a spreadsheet in one click |
| **PWA / Offline** | Service Worker caches all assets — works without internet after first load |
| **Dark mode UI** | Professional dark-mode design system, zero runtime npm dependencies |

---

## How it works

```
Drop image
    │
    ▼
resizeIfNeeded()          ← auto-downscale if > 1280 px or > 10 MB
    │
    ▼
Canvas renders image
    │
    ▼
User draws lines (click → click)
    │                          History.push(snapshot)  ← undo/redo
    ├── Right-click line → "Set as reference" → enter mm
    │        │
    │        └─► computeScale(px, mm)
    │                 │
    │                 └─► enrichMeasurements() → all lines labelled in mm
    │
    └── "Tunnista" → WorkerDetector (Web Worker)
                         │  postMessage DETECT
                         ▼
                    TF.js COCO-SSD (off-thread)
                         │
                         └─► auto bounding-box lines added to canvas

    "Käsi" → WorkerDetector DETECT_HAND
                    │
                    └─► YCbCr skin segmentation → hand width estimate
```

---

## Quick start

```bash
# Option A — zero install (Python stdlib)
cd kuvasta_mitat
python -m http.server 5173
# open http://localhost:5173

# Option B — Node dev server with hot reload
npm install
npm run dev
# open http://localhost:5173
```

No build step required. All modules are native ES modules loaded directly by the browser.

---

## Measurement workflow

1. **Drop an image** onto the upload zone (or click Browse)
2. **Click two points** on the canvas to draw a measurement line
3. **Right-click a line** → *Aseta referenssiksi* → enter the real-world length in mm
4. All lines now display their length in mm automatically
5. Click **Tunnista** to auto-detect objects, or **Käsi** to measure a hand
6. Use **Ctrl+Z** / **Ctrl+Y** to undo or redo any change
7. Click **Vie CSV** to export all measurements as a spreadsheet

---

## Project layout

```
kuvasta_mitat/
├── index.html                 Single-page app entry point
├── style.css                  Dark-mode design system (CSS variables)
├── sw.js                      Service Worker — cache-first PWA
├── public/
│   └── manifest.json          Web App Manifest (installable PWA)
├── src/
│   ├── app.js                 Main orchestrator — wires all modules
│   ├── upload.js              HTML5 File API + drag & drop handler
│   ├── canvas-ruler.js        Interactive Canvas overlay, DPR-aware
│   ├── measurer.js            Pure functions: px→mm, CSV, formatting
│   ├── detector.js            WorkerDetector + ObjectDetector fallback
│   ├── worker-detector.js     Web Worker entry (TF.js off-thread)
│   ├── history.js             Undo/redo stack with deep-clone snapshots
│   ├── image-utils.js         resizeIfNeeded, toImageData, formatBytes
│   └── results.js             Results table + Chart.js bar chart
├── tests/
│   ├── test_measurer.js       Pure-function unit tests (100% coverage)
│   ├── test_canvas_ruler.js   Canvas ruler tests (mock canvas/ctx)
│   ├── test_history.js        History class tests (100% coverage)
│   ├── test_image_utils.js    Image utility tests (100% coverage)
│   ├── test_worker_detector.js Skin segmentation logic tests
│   └── e2e/
│       └── upload.spec.js     Playwright E2E: upload, draw, export
├── vitest.config.js           100% branch coverage enforced
├── playwright.config.js       Chromium + Firefox E2E
├── package.json
└── .github/workflows/ci.yml   GitHub Actions CI
```

---

## Testing

```bash
npm install

# Unit tests (Vitest + V8 coverage — must pass 100%)
npm test

# End-to-end tests (Playwright, Chromium + Firefox)
npm run test:e2e
```

Coverage is enforced at **100% branches** for all pure logic modules. CI fails if coverage drops.

---

## Architecture decisions

| Decision | Rationale |
|---|---|
| Web Worker for TF.js | Keeps main thread free; canvas stays interactive during 400 ms inference |
| Deep-clone undo history | Mutations to restored state never corrupt the history stack |
| `resizeIfNeeded` before Worker | Prevents OOM on mobile for high-res images |
| Cache-first Service Worker | App opens in < 100 ms on repeat visits, works fully offline |
| No build step | Ships ES modules directly; zero toolchain to maintain |
| jsdom + Vitest | Fast unit tests with real DOM APIs, no browser launch needed |

---

## CI / CD

```
push / PR
  │
  ├── unit-tests     npm test (Vitest, 100% coverage)
  ├── e2e-tests      Playwright on Chromium + Firefox
  └── (optional)     Docker build smoke test
```

---

## Implemented

- Image upload and display in browser
- Drawable measurement lines (Canvas API)
- Pixel-to-mm conversion via reference object
- Automatic reference detection via ML (TF.js COCO-SSD)
- Hand measurement via skin-tone segmentation
- Live results panel and CSV export (Chart.js)
- Web Worker off-thread inference
- Undo / Redo with history stack
- Large-image auto-resize
- PWA / offline support

---

## Runtime dependencies

Zero npm runtime dependencies. All libraries load from CDN:

| Library | Version | Purpose |
|---|---|---|
| TensorFlow.js | 4.x | ML inference engine |
| COCO-SSD | 2.x | Object detection model |
| Chart.js | 4.x | Results bar chart |

---

## License

MIT
