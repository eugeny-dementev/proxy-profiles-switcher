## Summary

Describe the user-visible change and why it belongs in the focused profile workflow.

## Verification

- [ ] `npm run check`
- [ ] `npm run test:unit`
- [ ] `npm run test:e2e`
- [ ] `npm run package`

## Safety and compatibility

- [ ] Manifest permissions remain exactly `proxy` and `storage`.
- [ ] Install, startup, and reload do not change proxy settings.
- [ ] No credentials, telemetry, host permissions, remote code, or machine-specific profiles were added.
- [ ] Storage or import changes include deterministic migration tests.
- [ ] UI changes include a screenshot where useful.
