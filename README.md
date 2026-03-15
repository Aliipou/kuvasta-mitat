# 📐 kuvasta-mitat

> **Detect and measure object dimensions directly from images — no calibration rig required.**

Kuvasta-mitat uses OpenCV edge detection and contour analysis to find every distinct object in a photograph, report its pixel dimensions, and — when you provide a reference object — convert those measurements to real-world millimetres.

---

## ✨ Features

| | |
|---|---|
| 🔍 **Automatic detection** | Canny edges + external contour extraction |
| 📏 **Physical units** | Pixel-to-mm conversion via a known reference object |
| 🎨 **Visual output** | Colour-coded bounding boxes with per-object labels |
| ⚙️ **Fully tunable** | All thresholds exposed as CLI flags |
| 🧪 **100 % test coverage** | pytest + coverage enforced in CI |
| 🐍 **Python 3.11+** | Typed, linted, mypy-clean |

---

## 🖼️ How it works

```
Input image
     │
     ▼
Gaussian blur  ──►  Canny edges  ──►  Dilate  ──►  Find contours
     │
     ▼
Filter by area  ──►  Sort largest-first  ──►  Measure (px → mm)
     │
     ▼
Annotate canvas  ──►  Save annotated image  +  Print table
```

---

## 🚀 Quick start

```bash
# 1. Clone & install
git clone <repo-url>
cd kuvasta_mitat
pip install -e ".[dev]"

# 2. Run on your image (pixel dimensions only)
kuvasta-mitat photo.jpg --min-area 300

# 3. Add a reference object (e.g. a credit card is 85.6 mm wide)
kuvasta-mitat photo.jpg --min-area 300 --ref-width-mm 85.6

# 4. Specify which detected object is the reference (default: 0 = largest)
kuvasta-mitat photo.jpg --min-area 300 --ref-width-mm 85.6 --ref-index 0
```

**Sample console output:**

```
Found 3 object(s) in photo.jpg

  Object  1: 412 × 283 px  (85.6 × 58.8 mm)   ← reference card
  Object  2: 198 × 145 px  (41.1 × 30.1 mm)
  Object  3:  87 ×  62 px  (18.1 × 12.9 mm)

  Scale: 4.8131 px/mm

  Annotated image → photo_annotated.jpg
```

---

## 🎛️ Full CLI reference

```
kuvasta-mitat <image> [options]

positional:
  image                   Input image (JPG, PNG, TIFF, …)

detection:
  --min-area PX²          Min contour area to keep     [default: 500]
  --max-area PX²          Max contour area to keep     [default: unlimited]
  --canny-low N           Canny lower threshold        [default: 50]
  --canny-high N          Canny upper threshold        [default: 150]
  --blur-kernel N         Gaussian blur size (odd)     [default: 5]
  --no-dilate             Skip edge dilation

physical scale:
  --ref-width-mm MM       Real-world width of ref obj  [default: None]
  --ref-index N           Which detection is ref (0=largest) [default: 0]

visualisation:
  --output / -o PATH      Annotated image path         [default: <stem>_annotated<ext>]
  --draw-contour          Also draw raw contour outline
  --no-save               Print table only, skip image

verbosity:
  --log-level             DEBUG | INFO | WARNING       [default: INFO]
```

---

## 🏗️ Project layout

```
kuvasta_mitat/
├── src/kuvasta_mitat/
│   ├── __init__.py
│   ├── detector.py      # Edge detection & contour extraction
│   ├── measurer.py      # Pixel → mm conversion
│   ├── annotator.py     # Image drawing & file save
│   └── main.py          # CLI entry point
├── tests/
│   ├── test_detector.py
│   ├── test_measurer.py
│   ├── test_annotator.py
│   └── test_main.py
├── pyproject.toml
└── README.md
```

---

## 🧪 Running tests

```bash
pip install -e ".[dev]"
pytest                        # runs all tests + coverage report
pytest --cov-report=html      # open htmlcov/index.html for visual coverage
```

Coverage is enforced at **100 %** — the CI pipeline fails below that threshold.

---

## ⚙️ Tuning tips

| Scenario | Suggestion |
|---|---|
| Dark object on bright background | Lower `--canny-low` to 20–30 |
| Many small noise detections | Increase `--min-area` to 1000+ |
| Object edges merge together | Disable dilation with `--no-dilate` |
| Low contrast image | Increase `--blur-kernel` to 7 or 9 |

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `opencv-python` | Image processing, edge detection, drawing |
| `numpy` | Array operations |

---

## 📄 License

MIT
