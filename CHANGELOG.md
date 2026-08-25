# Changelog

All notable changes to Proxy Profiles Switcher are documented here.

The project follows semantic versioning for extension releases.

## [Unreleased]

### Fixed

- Request-level Chrome proxy errors no longer appear as global profile-activation failures.
- Genuine proxy-setting application failures remain visible in the popup and toolbar badge.

## [1.0.0] - 2026-08-25

### Added

- Manifest V3 Chrome extension with Direct and named fixed-server profiles.
- HTTP, HTTPS, SOCKS4, and SOCKS5 single-endpoint support.
- Local profile management, ordering, bypass lists, and versioned backup files.
- Safe Proxy Switcher 0.6.x import preview and conversion.
- Actual Chrome proxy-state matching and control-conflict reporting.
- Unit, disposable Chromium end-to-end, proxy-fixture, and optional live smoke tests.
- Deterministic ZIP packaging and GitHub CI/release workflows.

### Changed from upstream

- Replaced the broad proxy settings panel with a compact one-click profile list.
- Removed PAC, Auto Detect, System Proxy, free-proxy search, promotional calls, managed configuration, and credentials.

[Unreleased]: https://github.com/eugeny-dementev/proxy-profiles-switcher/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/eugeny-dementev/proxy-profiles-switcher/releases/tag/v1.0.0
