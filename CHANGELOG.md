# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

---

## [1.1.0] — 2026-03-16

### Added
- **PWA support** — service worker (`sw.js`) + `manifest.json`; app works offline after first visit
- **Playwright E2E tests** — upload, draw, reference, export flows
- **GitHub Actions E2E job** — runs Chromium + Firefox on every PR
- `.env.example` for future backend integration

### Changed
- CI now enforces E2E in addition to unit coverage

---

## [1.0.0] — 2026-03-16

### Added
- HTML5 Canvas measurement ruler with drag-and-drop upload
- Pixel → mm conversion via reference object
- TF.js COCO-SSD automatic object detection
- Skin-tone hand measurement (`HandDetector`)
- Chart.js results bar chart + CSV export
- Vitest unit tests, 100% coverage target
- Dark-mode UI (zero npm runtime deps)
