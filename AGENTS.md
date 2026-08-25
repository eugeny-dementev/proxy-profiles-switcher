# AGENTS.md

## Project intent

Proxy Profiles Switcher is an open-source, local-first Chrome Manifest V3 extension. Its purpose is one-click switching between Direct mode and named single-endpoint proxy profiles.

## Non-negotiable behavior

- Never alter the operating-system proxy, VPN, Docker networks, or the user's normal Chrome profile during development or tests.
- Never change Chrome proxy settings during extension install, startup, or reload.
- Keep manifest permissions limited to proxy and storage.
- Do not add host permissions, content scripts, telemetry, remote code, IP lookup, proxy search, or health-check traffic.
- Store profile data only in chrome.storage.local; do not add Chrome Sync or credentials.
- Keep profiles single-endpoint. Do not reintroduce PAC, Auto Detect, System Proxy, or per-protocol endpoint forms.
- Treat chrome.proxy.settings.get() as the active-state source of truth.
- If another extension or policy controls the proxy setting, show the conflict and do not attempt a workaround.
- All browser automation must use Playwright's bundled Chromium with a disposable user-data directory.
- Do not add machine-specific proxy endpoints, exported profiles, credentials, or normal Chrome profile data to the repository.

## Architecture

- extension/core contains pure validation, import, storage, and Chrome proxy configuration logic.
- extension/popup is the one-click switcher.
- extension/options owns profile CRUD, ordering, backup, and migration UI.
- extension/service-worker.js observes proxy/storage events and maintains toolbar status without changing routing on startup.
- tests/unit covers pure behavior.
- tests/e2e loads the unpacked extension into isolated Chromium and uses disposable local proxy fixtures.

## Data and migrations

The persisted document is proxyProfilesState with schemaVersion 1. Profile IDs are stable UUIDs; names are case-insensitively unique. Import must preview before writing, never activate a proxy, and never guess when a legacy profile has multiple distinct endpoints.

## Upstream and licensing

This repository is the GitHub fork `eugeny-dementev/proxy-profiles-switcher` of `rNeomy/proxy-switcher`. The redesign is pinned to upstream commit e10d606d9ba131b2abb16bc2e9e1ef111f0e27c9. Preserve LICENSE, NOTICE, the upstream remote, and accurate provenance. The extension name and icon are project-specific.

The public branch contains source, tests, documentation, and GitHub workflows. Keep `dist`, `graphify-out`, Playwright output, normal-browser data, and local profile exports untracked.

## Verification

Before handoff run:

    npm run check
    npm run test:unit
    npm run test:e2e
    npm run package

Use npm run test:live only for isolated localhost proxy smoke tests. Do not disable or reconfigure the user's VPN, Docker proxy containers, or installed Chrome extensions.

CI runs on Windows because the distributable ZIP is built by PowerShell. A `v*` tag must match `extension/manifest.json` before the release workflow is triggered.
