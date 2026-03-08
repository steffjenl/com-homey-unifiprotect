# AGENTS.md — Development Standards

All development standards for `com.ubnt.unifiprotect`. Every developer and AI agent must follow these rules.

See [specs/](specs/) for deeper documentation.

Last updated: March 2026

---

## Table of Contents
1. [Coding Standards](#1-coding-standards)
2. [Architecture Rules](#2-architecture-rules)
3. [Error Handling & Retry Rules](#3-error-handling--retry-rules)
4. [Logging Rules](#4-logging-rules)
5. [Testing Rules](#5-testing-rules)
6. [Git Workflow](#6-git-workflow)
7. [Documentation Workflow](#7-documentation-workflow)
8. [Security Rules](#8-security-rules)
9. [Release Process](#9-release-process)
10. [Definition of Done](#10-definition-of-done)

---

## 1. Coding Standards

- **Language:** JavaScript (CommonJS) — no TypeScript in app source (`tsconfig.json` is for editor tooling only)
- **Runtime:** Node.js ≥ 12.16.1
- `'use strict';` at top of every `.js` file
- **Modules:** `require()` / `module.exports` only — no `import/export`
- **Style:** ESLint `athom/homey-app` config — run `npx eslint .` before every commit
- **No** `console.log` — use `this.homey.app.debug()` or `this.log()`
- `async/await` preferred for new code
- String ID comparisons: always `String(id1) === String(id2)`

### Naming
| Item | Convention |
|------|-----------|
| Driver folder | kebab-case (`protect-nvr-alarm`) |
| Class | PascalCase (`NVRAlarmDriver`) |
| Constants | `UPPER_SNAKE_CASE` in `constants.js` |
| Flow card IDs | `ufp_` prefix + snake_case |
| Capability IDs | snake_case |
| Settings keys | `ufp:` prefix |

---

## 2. Architecture Rules

### Where Logic Goes
- **Flow cards + login** → `library/app-protect.js` (Protect) or `library/app-access.js` (Access)
- **REST API calls** → `library/protect-api-v2/protect-api.js` or `library/protectapi.js` (v1)
- **WS event routing** → `web-socket-events.js` (events) or `web-socket-devices.js` (device state)
- **Capability updates** → `drivers/<driver>/device.js`
- **Flow card registration** → `drivers/<driver>/driver.js → onInit()`
- **Constants** → `library/constants.js`

### Separation of Concerns
- Drivers do NOT make direct API calls — delegate to `this.homey.app.api` / `this.homey.app.apiV2`
- Devices do NOT register flow cards — drivers do
- WS classes do NOT hold device references — dispatch via `this.homey.drivers.getDriver(id)`
- All event/action IDs must be constants in `constants.js` before use

### Dual API Stack
- Do not break the v1 (cookie) API — legacy devices depend on it
- New features target **v2** when possible
- v2 API key is optional — app degrades gracefully
- **NVR alarm control** uses v1 API (`PATCH /proxy/protect/api/nvr`) — the v2 API NVR endpoint is GET-only

### New Driver Checklist
- [ ] `driver.js` — `onInit`, `onPair`, `onParseWebsocketMessage`, `getUnifiDeviceById`
- [ ] `device.js` — `onInit`, `waitForBootstrap`/`waitForConnection`, `initDevice`, `_createMissingCapabilities`
- [ ] `driver.compose.json`
- [ ] `pair/validate.html`
- [ ] `assets/images/` (small.png, large.png)
- [ ] Constants in `constants.js`
- [ ] Flow card JSON files
- [ ] i18n strings in ALL `locales/*.json`
- [ ] Registration in `app-protect.js`

---

## 3. Error Handling & Retry Rules

- Wrap synchronous errors in `try/catch` + `this.error(error)`
- Always `.catch(this.error)` or `.catch(error => this.error(error))` at chain end
- Flow run listeners return `Promise.resolve(true)` on success
- HTTP 401/403 → log clearly, **do not retry** (credentials are wrong)
- HTTP 429 → log "rate limited", backoff before retry
- Never silently swallow errors

### WebSocket Reconnection
- On WS `close`: clean up state, `loggedInStatus = 'Disconnected'`
- Do **NOT** auto-reconnect immediately (memory leak risk)
- Reconnection triggered by **hourly auth refresh** in `app-protect.js`
- Manual reconnect: call `reconnectNotificationsListener()`

### `waitForBootstrap` Polling
- Poll every **250 ms** using `this.homey.setTimeout(this.waitForBootstrap.bind(this), 250)`
- Stop once bootstrap loaded (v1) or WS connected (v2)
- Do NOT use `setInterval` for bootstrap polling

---

## 4. Logging Rules

1. **Never log secrets** — no API keys, passwords, cookies, CSRF tokens
2. `this.homey.app.debug(...)` for verbose/trace
3. `this.log(...)` for operational events (Device/Driver)
4. `this.error(...)` for errors
5. Prefix log messages with context: `'[NVRAlarmDevice]'`, `'[WS Devices]'`
6. Unhandled WS events → log at debug level in production

```javascript
// GOOD
this.homey.app.debug('[NVRAlarmDevice] isAway changed: ' + isAway);
// BAD
this.log('API key: ' + this.homey.app.apiV2.webclient._apiToken);
```

---

## 5. Testing Rules

> No framework exists yet (March 2026). Follow these when adding tests.

1. Every new driver/device → at least one integration test
2. Every bug fix → a regression test
3. Use `jest` + `nock` — add to `devDependencies` when introducing
4. Mock the Homey SDK — never require a real Homey in tests
5. Fixtures in `test/fixtures/`
6. Unit tests in `test/unit/`, integration tests in `test/integration/`

See [specs/testing-strategy.md](specs/testing-strategy.md) for fixture examples.

---

## 6. Git Workflow

### Branches
```
feature/<description>    # New features
fix/<description>        # Bug fixes
chore/<description>      # Deps, refactor, docs
```

### Commit Messages (Conventional Commits)
```
feat(protect-nvr-alarm): add NVR alarm driver with arm/disarm flow cards
fix(websocket): prevent memory leak on WS close
chore(deps): update ws package
docs(specs): update api notes with alarm endpoint
```

### PR Checklist
- [ ] `npx eslint .` passes
- [ ] `homey app validate` passes (CI runs automatically)
- [ ] `npm test` passes (once tests exist)
- [ ] New flow cards have i18n in ALL locale files
- [ ] New capabilities defined in `.homeycompose/capabilities/`
- [ ] Constants in `constants.js`
- [ ] `.homeychangelog.json` updated
- [ ] `specs/` updated if architecture/API/conventions changed
- [ ] No secrets committed

---

## 7. Documentation Workflow

Update specs when:
- New driver → check [repo-conventions.md](specs/repo-conventions.md)
- New API endpoint → update [unifi-protect-api-notes.md](specs/unifi-protect-api-notes.md)
- Auth flow changes → update [security-and-secrets.md](specs/security-and-secrets.md)
- New debug tooling → update [observability-and-debugging.md](specs/observability-and-debugging.md)
- New tests → update [testing-strategy.md](specs/testing-strategy.md)

Update `AGENTS.md` when architectural patterns or development rules change.

---

## 8. Security Rules

1. **No secrets in git** — ever
2. **`env.json` is gitignored** — only `DEBUG=true` locally
3. **Homey settings storage** for all credentials
4. **Redact in logs** — never log API key/password/token values
5. **`rejectUnauthorized: false`** is intentional (NVR self-signed TLS) — always add comment
6. **Dedicated local user** — setup guide must recommend non-admin local integration
7. **`npm audit`** before each release — critical CVEs must be resolved

---

## 9. Release Process

1. Merge all PRs to `main`
2. Validate:
   ```bash
   npx eslint .
   npx homey app validate
   npm test   # (once tests exist)
   ```
3. **Version + changelog** via GitHub Actions → `homey-updateversion` workflow:
   - `patch` = bug fix, `minor` = new feature, `major` = breaking change
4. **Publish** via GitHub Actions → `homey-publish` workflow
5. **Verify** app in Homey App Store

### QA Checklist
- [ ] App installs fresh without errors
- [ ] Settings page loads and saves
- [ ] NVR connection works (v1 login + v2 API key)
- [ ] At least one device pairs and shows data
- [ ] WebSocket events arrive (test motion/ring)
- [ ] Flow cards fire correctly
- [ ] Upgrade from previous version (no capability migration errors)
- [ ] No crash log errors after 5 minutes

---

## 10. Definition of Done

### Feature
- [ ] Merged via PR with all checklist items checked
- [ ] At least one test (once test framework exists)
- [ ] Relevant specs updated
- [ ] `.homeychangelog.json` entry added
- [ ] Works end-to-end on real Homey

### Bug Fix
- [ ] Root cause identified in PR description
- [ ] Fix merged via PR
- [ ] Regression test added (or noted as TODO)
- [ ] `.homeychangelog.json` entry added
- [ ] Confirmed fixed on real Homey or by reporter

---

## Patterns from `.ai/` Reference Projects

| Pattern | Source | Adopted as |
|---------|--------|-----------|
| `modelKey` routing in WS events | `.ai/repo-unifi-protect/` | `eventData.item.modelKey` checks in `web-socket-events.js` |
| `ProtectNvrConfigInterface.isAway` | `.ai/repo-unifi-protect/` | v1 `PATCH /proxy/protect/api/nvr` for alarm control |
| Cooldown for events | `.ai/repo-home-assistant/` | `ignoreEventsNfcFingerprint` / `ignoreEventsDoorbell` settings |
| Official v2 API endpoints | `.ai/unifi-protect-api-v2/Control Plane.html` | All v2 endpoint docs in [unifi-protect-api-notes.md](specs/unifi-protect-api-notes.md) |
| WS device message `{type, item}` wrap | `.ai/unifi-protect-api-v2/Control Plane.html` | Confirmed format in specs; used in `web-socket-devices.js` parsing |

