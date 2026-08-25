# Privacy policy

Effective date: 2026-08-25

Proxy Profiles Switcher stores proxy profile configuration locally in the browser and does not collect, transmit, sell, or share personal data.

## Data stored

The extension stores the following in `chrome.storage.local`:

- Profile IDs and names.
- Proxy protocol, hostname or IP address, and port.
- Per-profile bypass entries.
- The ID of the last explicitly selected profile.
- A short local runtime error message when Chrome rejects a proxy operation.

This data remains in the current Chrome profile. Chrome Sync is not used. Proxy usernames and passwords are not supported or stored.

## Network activity

The extension makes no network requests of its own. It does not perform proxy health checks, IP lookups, analytics, telemetry, advertising, or update checks outside Chrome's extension mechanisms.

When the user activates a profile, Chrome sends eligible browser traffic through the configured proxy. That traffic is governed by the selected proxy operator and the visited service, not by this extension.

## Permissions

- `proxy` is required to read and change Chrome's regular proxy configuration.
- `storage` is required to save profiles locally.

The extension requests no host permissions and injects no content scripts.

## Export, deletion, and retention

JSON backup is initiated only by the user. Exported files are outside extension storage and remain wherever the user saves them.

Profiles can be deleted from the options page. Removing the extension clears its browser-managed local storage according to Chrome's normal extension lifecycle.

## Changes

Material changes to this policy will be documented in the repository and release notes. Changes that require additional Chrome permissions must also be visible in `extension/manifest.json`.

## Contact

Open a privacy issue at https://github.com/eugeny-dementev/proxy-profiles-switcher/issues.
