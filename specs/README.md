# specs/ — Engineering Specifications Index

This folder contains the living engineering specifications for the **com.ubnt.unifiprotect** Homey app (UniFi Protect & Access integration for Athom Homey).

These specs are written for the development team and must be kept up-to-date as the codebase evolves. Reference them in PRs, code reviews, and planning sessions.

Official SDK documentation:
- [Homey Apps Developer Docs](https://apps.developer.homey.app/)
- [SDK v3 API Reference](https://apps-sdk-v3.developer.homey.app/)

---

## Index

| File | Purpose |
|------|---------|
| [homey-app-architecture.md](homey-app-architecture.md) | Homey SDK v3 app structure, drivers, devices, capabilities, flow cards, pairing, app API, widgets, settings |
| [unifi-protect-api-notes.md](unifi-protect-api-notes.md) | Official API v2 (6.2.88) endpoints, auth, WebSocket events, device models |
| [repo-conventions.md](repo-conventions.md) | Folder structure, naming, coding style, CLI commands, logging, error handling |
| [testing-strategy.md](testing-strategy.md) | Test pyramid, mocking approach, fixtures, widget API testing, CI expectations |
| [security-and-secrets.md](security-and-secrets.md) | API keys, tokens, `Homey.env` vs `process.env`, redaction in logs, secure storage |
| [observability-and-debugging.md](observability-and-debugging.md) | Debug flags, log structure, `homey-log` crash reporting, persistent log, diagnostic capture |

---

## How to use these specs

1. **Before adding a new feature** — read the relevant spec(s) first.
2. **When adding a new driver** — follow [homey-app-architecture.md](homey-app-architecture.md) and [repo-conventions.md](repo-conventions.md).
3. **When changing the API layer** — update [unifi-protect-api-notes.md](unifi-protect-api-notes.md).
4. **When adding secrets/credentials handling** — read [security-and-secrets.md](security-and-secrets.md) first.
5. **When adding a widget or app API endpoint** — see the dedicated sections in [homey-app-architecture.md](homey-app-architecture.md).
6. **After a release** — update any specs where behaviour changed.

---

## Maintenance

- Specs are updated as part of the **Definition of Done** (see [AGENTS.md](../AGENTS.md)).
- Outdated specs are worse than no specs — keep them honest.
- Last reviewed: March 2026 (aligned with Homey SDK v3 docs)

