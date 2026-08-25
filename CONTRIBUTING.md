# Contributing

Issues and pull requests are welcome. Please keep changes aligned with the extension's local-first, single-endpoint design.

## Setup

```powershell
git clone https://github.com/eugeny-dementev/proxy-profiles-switcher.git
cd proxy-profiles-switcher
npm ci
npx playwright install chromium
```

## Required checks

Run these before opening a pull request:

```powershell
npm run check
npm run test:unit
npm run test:e2e
npm run package
```

End-to-end tests must use Playwright's bundled Chromium and a disposable user-data directory. Do not point tests at a normal Chrome profile.

## Design contracts

- Keep manifest permissions limited to `proxy` and `storage`.
- Do not add host permissions, content scripts, remote code, telemetry, health checks, or IP lookup.
- Do not change proxy settings on install, browser startup, or extension reload.
- Treat `chrome.proxy.settings.get()` as the active-state source of truth.
- Preserve Direct mode and clear policy or competing-extension errors.
- Keep profiles single-endpoint and machine-local in `chrome.storage.local`.
- Preserve import preview and never guess when a legacy profile has multiple endpoints.
- Preserve MPL-2.0 notices and upstream attribution.

## Pull requests

Keep each pull request focused. Describe observable behavior changes, permissions changes, storage migrations, and the tests that cover them. Include screenshots for popup or options-page changes.

New schema versions require a deterministic migration and unit tests. New permissions require explicit justification and are likely out of scope.
