# Proxy Profiles Switcher

[![CI](https://github.com/eugeny-dementev/proxy-profiles-switcher/actions/workflows/ci.yml/badge.svg)](https://github.com/eugeny-dementev/proxy-profiles-switcher/actions/workflows/ci.yml)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE)

Proxy Profiles Switcher is a local-first Manifest V3 extension for Chrome and Chromium browsers. It turns saved HTTP, HTTPS, SOCKS4, and SOCKS5 endpoints into a compact, one-click list and always keeps **Direct** mode within reach.

This repository is a real GitHub fork of [rNeomy/proxy-switcher](https://github.com/rNeomy/proxy-switcher). It preserves the upstream project's proxy-setting foundation and MPL-2.0 provenance, while intentionally replacing its broad settings panel with a focused saved-profile workflow.

## Why this fork exists

The upstream extension exposes browser proxy modes through an editable settings-style interface. That is useful for ad hoc configuration, but repetitive when the same small set of proxies is used every day.

This fork optimizes for a different workflow:

- Save named single-endpoint profiles once.
- See protocol, host, and port directly in the popup.
- Activate a profile or Direct mode with one click.
- Confirm the setting Chrome actually applied instead of trusting cached UI state.
- Back up and restore profiles as versioned JSON.
- Keep all profile data on the current machine.

## Features

- Pinned **Direct** entry and one row per saved profile.
- HTTP, HTTPS, SOCKS4, and SOCKS5 endpoints.
- Custom bypass list per profile, with safe localhost and RFC1918 defaults.
- Add, edit, delete, and reorder profiles on a dedicated options page.
- Active-state detection from `chrome.proxy.settings.get()`.
- Clear policy and competing-extension conflict messages.
- Toolbar badges: `ON` for a saved profile, blank for Direct, `?` for an unmatched fixed proxy, and `!` for a control or application error.
- Versioned local JSON import/export.
- Safe migration from Proxy Switcher 0.6.x exports when a legacy profile has one endpoint or identical per-protocol endpoints.
- No network requests made by the extension itself.

## Intentionally not included

PAC scripts, Auto Detect, System Proxy, per-protocol endpoint sets, authenticated-proxy credential storage, per-tab routing, remote DNS toggles, free-proxy search, health checks, IP lookup, analytics, promotional pages, and managed-policy workarounds are outside this project's scope.

## Privacy and permissions

The manifest requests exactly two permissions:

- `proxy` — read and change Chrome's browser-level proxy configuration.
- `storage` — save profiles in `chrome.storage.local` on the current computer.

There are no host permissions, content scripts, analytics, remote code, telemetry, Chrome Sync data, or credentials. See [PRIVACY.md](PRIVACY.md) for the complete policy.

## Installation

### From a GitHub release

1. Download `proxy-profiles-switcher-<version>.zip` from [Releases](https://github.com/eugeny-dementev/proxy-profiles-switcher/releases).
2. Extract the ZIP to a permanent directory.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Select **Load unpacked** and choose the extracted directory.
6. Pin **Proxy Profiles Switcher** from Chrome's Extensions menu.

### From source

1. Clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the repository's `extension` directory.

Only one extension can control Chrome's regular proxy settings at a time. Disable another proxy-switching extension before activating a profile here.

Installing, starting, or reloading this extension never changes the active proxy. A route changes only after an explicit selection in the popup, or when an already-active profile is edited or deleted.

## Usage

1. Open **Manage profiles** from the popup.
2. Add a name, protocol, host, port, and optional bypass entries.
3. Return to the popup and select the profile.
4. Select **Direct** whenever Chrome should stop using a browser proxy.

Profiles use `fixed_servers.rules.singleProxy` with `scope: "regular"`. The configured endpoint covers browser URL requests; destinations matching the bypass list connect directly.

## Backup and migration

The options page exports a versioned JSON document containing only profile configuration. Import always shows a preview and never activates a proxy.

- **Merge** updates matching IDs or names and adds new profiles.
- **Replace all** replaces the saved profile list after confirmation.
- Proxy Switcher 0.6.x profiles with multiple distinct endpoints are skipped instead of being guessed or flattened incorrectly.
- Legacy-only fields are reported in the preview when ignored.

Chrome isolates extension storage, so this extension cannot silently read another extension's profiles. Export from the old extension and import the resulting JSON manually.

## Development

Requirements:

- Node.js 20 or newer.
- PowerShell 7 or Windows PowerShell 5.1 for ZIP packaging.

```powershell
npm ci
npx playwright install chromium
npm run check
npm run test:unit
npm run test:e2e
npm run package
```

`npm test` runs the unit and end-to-end suites. Browser automation always uses Playwright's bundled Chromium with a disposable user-data directory; tests never load the extension into a normal Chrome profile.

`npm run test:live` is an explicit, optional smoke test for proxy endpoints already running on the local machine. It defaults to `http://127.0.0.1:3328` and `socks5://127.0.0.1:1080`; override them with `PROXY_PROFILE_HTTP_URL` and `PROXY_PROFILE_SOCKS_URL`. The smoke test does not start, stop, or reconfigure proxies.

Packaging writes `dist/proxy-profiles-switcher-<manifest-version>.zip`. Tagged releases run the same validation and publish that ZIP through GitHub Actions.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development contracts and pull-request expectations.

Implementation details are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and the stable JSON interface is described in [docs/BACKUP_FORMAT.md](docs/BACKUP_FORMAT.md).

## Troubleshooting

- **Another extension controls proxy settings:** disable the competing proxy/VPN browser extension, then refresh the popup.
- **A policy controls proxy settings:** Chrome reports the setting as not controllable. This extension does not attempt to bypass policy.
- **The popup shows an unmatched proxy:** Chrome has a fixed proxy configuration that does not match a saved profile. Select Direct or a saved profile.
- **A local destination stops opening:** add its hostname, IP address, wildcard, or CIDR range to the profile's bypass list.
- **A proxy needs authentication:** Chrome may display its own prompt, but this extension intentionally does not store or provide credentials.
- **A proxy endpoint times out:** verify the endpoint independently. Saving a profile does not imply that the proxy server is healthy.

## Fork and license

The redesign is based on Proxy Switcher 0.6.8 at upstream commit [`e10d606`](https://github.com/rNeomy/proxy-switcher/commit/e10d606d9ba131b2abb16bc2e9e1ef111f0e27c9). See [NOTICE](NOTICE) for detailed provenance.

Source code is available under the [Mozilla Public License 2.0](LICENSE). This fork is independently maintained and is not affiliated with or endorsed by the upstream author.
