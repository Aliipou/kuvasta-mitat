# 📐 Kuvasta Mitat

> **Measure anything in a photo — directly in the browser. No install required.**

Draw measurement lines on any image, set one line as a physical reference, and every other line instantly converts to real-world millimetres. Includes TF.js-powered automatic object & hand detection.

---

## ✨ Features

| | |
|---|---|
| 📸 **Drag & drop upload** | JPEG, PNG, WEBP, TIFF via HTML5 File API |
| ✏️ **Canvas ruler** | Click two points → labelled measurement line |
| 📏 **Pixel → mm** | Set one reference object's real size; all lines convert automatically |
| 🤖 **Auto-detect** | TF.js COCO-SSD finds objects and measures their bounding boxes |
| 🖐 **Hand measurement** | Skin-tone segmentation estimates hand width & finger span |
| 📊 **Chart.js results** | Bar chart + table update in real time |
| 💾 **CSV export** | Download all measurements as a spreadsheet |
| 🎨 **Dark UI** | Professional dark-mode interface, no dependencies to install |

---

## 🖼️ How it works

```
Upload image
     │
     ▼
Canvas renders image
     │
     ▼
User draws lines (click → click)
     │
     ├── Right-click line → "Set as reference" → enter mm
     │        │
     │        └─► Scale factor computed (px/mm)
     │                 │
     │                 └─► All lines labelled in mm
     │
     └── "Tunnista" button → TF.js COCO-SSD → auto bounding boxes
         "Käsi" button     → Skin detection  → hand width
```

---

## 🚀 Quick start

```bash
# Option A — zero install (Python)
cd kuvasta_mitat
python -m http.server 5173
# open http://localhost:5173

# Option B — Node dev server
npm install
npm run dev
# open http://localhost:5173
```

No build step. All modules are ES native.

---

## 📐 Measurement workflow

1. **Drop an image** onto the grey upload zone (or click to browse)
2. **Click two points** on the canvas to draw a measurement line
3. **Right-click a line** → *Aseta referenssiksi* → type the real-world length in mm
4. All lines now show their length in mm
5. Click **Tunnista** to auto-detect objects, or **Käsi** to measure a hand
6. Export results as CSV with ⬇ **Vie CSV**

---

## 🏗️ Project layout

```
kuvasta_mitat/
├── index.html              Single-page app entry
├── style.css               Dark-mode design system
├── src/
│   ├── app.js              Main orchestrator (wires all modules)
│   ├── upload.js           HTML5 File API + drag & drop
│   ├── canvas-ruler.js     Interactive Canvas measurement overlay
│   ├── measurer.js         px → mm conversion, CSV export
│   ├── detector.js         TF.js object + hand detection
│   └── results.js          Results table + Chart.js bar chart
├── tests/
│   ├── test_measurer.js    Pure-function tests (100% coverage)
│   └── test_canvas_ruler.js Canvas ruler unit tests
├── vitest.config.js
└── package.json
```

---

## 🧪 Testing

```bash
npm install
npm test                # Vitest + V8 coverage
npm run test:ui         # Browser-based test UI
```

Coverage is enforced at **100%** for all pure logic modules.

---

## 🎛️ Osatehtävät (Task breakdown)

| Osatehtävä | Vaikeus | Status |
|---|---|---|
| Kuvan lataus ja näyttö selaimessa | Aloittelija | ✅ |
| Piirrettävien mittausviivojen toteutus (Canvas) | Aloittelija/Keskitaso | ✅ |
| Pikselien muuntaminen fyysisiksi mitoiksi referenssin avulla | Keskitaso | ✅ |
| Automaattinen referenssin tunnistus ML:n avulla (TF.js COCO-SSD) | Taitava | ✅ |
| Käden mittaaminen automaattisesti (ihonsävy-segmentointi) | Taitava | ✅ |
| UI/UX parannukset ja tulosten visuaalinen esitys (Chart.js) | Keskitaso | ✅ |

---

## 📦 Runtime dependencies

Zero npm runtime dependencies. Everything loads via CDN:

| Library | Purpose | CDN |
|---|---|---|
| TensorFlow.js | ML inference | cdn.jsdelivr.net |
| COCO-SSD | Object detection model | cdn.jsdelivr.net |
| Chart.js | Results bar chart | cdn.jsdelivr.net |

---

## 📄 License

MIT
