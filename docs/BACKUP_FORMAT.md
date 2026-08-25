# Backup format

Proxy Profiles Switcher exports UTF-8 JSON. The format is versioned independently from the extension release.

## Schema version 1

```json
{
  "format": "proxy-profiles-switcher",
  "schemaVersion": 1,
  "profiles": [
    {
      "id": "c4cde592-7850-4ef8-997d-3d297943074d",
      "name": "Work",
      "scheme": "http",
      "host": "127.0.0.1",
      "port": 3128,
      "bypassList": [
        "<local>",
        "localhost",
        "127.0.0.1",
        "192.168.0.0/16"
      ]
    }
  ],
  "lastSelectedProfileId": "c4cde592-7850-4ef8-997d-3d297943074d"
}
```

`scheme` is one of `http`, `https`, `socks4`, or `socks5`. Ports are integers from 1 through 65535. Profile names are case-insensitively unique. Hosts are ASCII hostnames or IP literals without a URL scheme, path, query, or credentials.

The selected ID records the last explicit choice for continuity and export. Active state is still derived from Chrome's current proxy setting.

## Import modes

- `merge` updates a matching stable ID or case-insensitive name and preserves the existing stable ID.
- `replace` discards the existing list and uses the validated imported list.

Both modes show a preview before writing and never activate an imported profile.

## Proxy Switcher 0.6.x conversion

Legacy exports identify profiles by name and may contain `singleProxy`, `proxyForHttp`, `proxyForHttps`, `proxyForFtp`, and `fallbackProxy` rules.

- A profile with one usable endpoint is converted.
- Identical endpoints repeated across protocol rules are collapsed to one endpoint.
- Multiple distinct endpoints are skipped instead of guessed.
- Legacy Remote DNS and No Prompt metadata is reported and ignored.

Authentication data is never imported or stored.
