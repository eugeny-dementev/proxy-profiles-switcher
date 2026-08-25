# Architecture

Proxy Profiles Switcher is a static Manifest V3 extension. It has no application server, content scripts, remote code, or extension-owned network client.

## Components

- `extension/core/profiles.js` validates and normalizes profile data.
- `extension/core/storage.js` owns the versioned `chrome.storage.local` document and short-lived runtime status.
- `extension/core/proxy.js` builds, applies, verifies, and matches Chrome proxy configurations.
- `extension/core/import.js` converts current backups and compatible Proxy Switcher 0.6.x exports.
- `extension/popup` derives current state and performs explicit one-click switching.
- `extension/options` owns profile CRUD, ordering, import, and export.
- `extension/service-worker.js` observes proxy and storage changes and updates the toolbar badge.

## State flow

1. Popup and options pages load normalized profile state from `chrome.storage.local`.
2. They request the current regular setting through `chrome.proxy.settings.get()`.
3. Pure matching logic classifies the setting as Direct, a saved profile, an unmatched fixed proxy, or externally controlled.
4. An explicit user selection calls `chrome.proxy.settings.set()` with either Direct or a single fixed server.
5. The setting is read back and verified before the UI reports success.

Stored selection is never treated as proof that a profile is active. Chrome's current setting is always authoritative.

## Lifecycle safety

Install, startup, and service-worker restart perform normalization and badge refresh only. They do not call the proxy setter.

Editing an active profile reapplies the edited configuration. If reapplication fails, the storage change is rolled back. Deleting an active profile switches to Direct before removing it.

## Proxy representation

Each profile maps to:

```json
{
  "mode": "fixed_servers",
  "rules": {
    "singleProxy": {
      "scheme": "socks5",
      "host": "127.0.0.1",
      "port": 1080
    },
    "bypassList": ["<local>", "localhost", "127.0.0.1"]
  }
}
```

Direct mode maps to `{ "mode": "direct" }`. Both are applied with `scope: "regular"`.

## Tests

Pure modules are covered with Node's test runner. End-to-end tests launch Playwright's bundled Chromium with a disposable persistent profile, load the unpacked extension, and terminate/restart its service worker. Disposable HTTP and SOCKS5 fixtures verify that browser traffic follows the selected profile and respects bypass entries.
