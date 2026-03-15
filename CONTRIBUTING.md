# Contributing

## Setup

```bash
git clone <repo>
cd kuvasta_mitat
npm install
```

## Development

```bash
npm run dev    # static file server on :5173
npm test       # unit tests + coverage
npx playwright install && npx playwright test   # E2E
```

## Code standards

- **ES modules** — no CommonJS
- **No build step** — keep all JS browser-native
- **Tests required** — unit coverage must remain at 100% for `src/` (excluding `app.js`)
- **No console.log** in production code — use structured logging patterns

## Pull requests

1. Fork → feature branch → PR to `main`
2. All CI jobs must pass (unit, E2E, lint)
3. Update `CHANGELOG.md` under `[Unreleased]`
4. One feature/fix per PR
