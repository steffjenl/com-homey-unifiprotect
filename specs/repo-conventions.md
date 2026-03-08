# Repository Conventions

---

## Naming

| Item | Convention | Example |
|------|-----------|---------|
| Driver folder | kebab-case | `protect-nvr-alarm/` |
| Class names | PascalCase | `NVRAlarmDriver` |
| Constants | `UPPER_SNAKE_CASE` in `constants.js` | `EVENT_NVR_ALARM_STATE_CHANGED` |
| Flow card IDs | `ufp_` prefix + snake_case | `ufp_nvr_alarm_state_changed` |
| Capability IDs | snake_case | `alarm_generic`, `nvr_away_mode` |
| Settings keys | `ufp:` prefix | `ufp:tokens`, `ufp:nvrip` |

---

## JavaScript Style

- `'use strict';` at top of every `.js` file
- **CommonJS only** — `require()` / `module.exports` (no ES modules)
- Class-based OOP — extend `Homey.App`, `Homey.Driver`, `Homey.Device`, or `BaseClass`
- `async/await` preferred for new code; existing Promise chains acceptable
- ESLint: `.eslintrc.json` → `extends: "athom/homey-app"` — run `npx eslint .` before commit
- No `console.log`, no unused variables
- String ID comparisons: always `String(id1) === String(id2)`

---

## Class Hierarchy

```
Homey.SimpleClass
  └── BaseClass (library/baseclass.js)
        ├── AppProtect (library/app-protect.js)
        ├── AppAccess (library/app-access.js)
        ├── ProtectAPI v2 / WebClient v2 / WS events / WS devices
        └── AccessAPI v2 / WebClient / WebSocket

Homey.App → UniFiProtect (app.js)
Homey.Driver → all drivers
Homey.Device → all devices
```

`BaseClass` provides `this.homey` via `setHomeyObject(homey)`.

---

## Constants (`library/constants.js`)

**All** event/action/device string IDs are centralised here.

Naming:
- `EVENT_*` — WebSocket/flow trigger IDs
- `ACTION_*` — Flow action IDs
- `DEVICE_*` — Device type identifiers
- `PROTECT_*` — Timing constants

Rule: **Never** hardcode flow card IDs or event names inline.

---

## Error Handling

- Always `.catch(this.error)` at end of promise chains
- Flow `runListener` returns `Promise.resolve(true)` on success
- HTTP 403 → log "no permission" clearly, don't retry
- HTTP 429 → log "rate limited", backoff before retry
- Never silently swallow errors — always log at minimum

---

## WebSocket Pattern

All WS classes follow:
1. `launchNotificationsListener()` — create WS with auth header
2. `configureNotificationsListener()` — attach `message` handler (once)
3. `reconnectNotificationsListener()` — disconnect + re-launch
4. `heartbeat()` — ping every 30 seconds
5. `disconnectEventListener()` — close WS, clean up timers

---

## `.homeycompose/` vs `.homeybuild/`

| Directory | Role | Edit? | Commit? |
|-----------|------|-------|---------|
| `.homeycompose/` | **Source** — global flows, actions, triggers, shared capabilities | ✅ Yes | ✅ Yes |
| `.homeybuild/` | **Generated output** — produced by `homey app publish` | ❌ Never | ❌ Never |
| `app.json` | **Generated** — produced alongside `.homeybuild/` | ❌ Never | ❌ Never |

`.homeybuild/` is listed in `.gitignore` and excluded from `tsconfig.json` so IDEs do not index it.

The **source of truth** for driver-scoped configuration is the compose files inside each driver folder:

```
drivers/<id>/driver.compose.json           # Driver manifest
drivers/<id>/driver.flow.compose.json      # Driver-scoped flow cards
drivers/<id>/driver.settings.compose.json  # (optional) Per-device settings
```

Global flow cards and shared capabilities live in:

```
.homeycompose/
  flow/
    triggers/   # Global trigger flow card JSON files
    actions/    # Global action flow card JSON files
  capabilities/ # Shared custom capability JSON files
```

---

## Homey CLI Commands

| Command | Purpose | Generates |
|---------|---------|-----------|
| `npx homey app validate` | Validate `app.json` against the SDK schema | — |
| `npx homey app run` | Deploy to a real Homey for live testing | `.homeybuild/` |
| `npx homey app publish` | Build + submit to the Homey App Store | `.homeybuild/` |
| `npx homey app logs` | Stream live app logs from the connected Homey | — |

> Install the CLI globally: `npm install -g homey` or use `npx homey` from the project root.
> `.homeybuild/` is generated output — **never commit or edit it directly**.

---

## `driver.settings.compose.json`

Some drivers (e.g. `protectcamera`, `protectdoorbell`) expose per-device settings. The schema follows the same format as app settings:

```json
[
  {
    "id": "useCameraSnapshot",
    "type": "checkbox",
    "label": { "en": "Use camera snapshot" },
    "value": false
  }
]
```

Changed values arrive in the device via `onSettings({ oldSettings, newSettings, changedKeys })`. Throw a human-readable `Error` to reject and revert a setting change.

## New Driver Checklist

- [ ] `drivers/<id>/driver.js` — `onInit`, `onPair`, `onParseWebsocketMessage`, `getUnifiDeviceById`
- [ ] `drivers/<id>/device.js` — `onInit`, `onAdded`, `onDeleted`, `waitForBootstrap`, `initDevice`, `_createMissingCapabilities`
- [ ] `drivers/<id>/driver.compose.json` — `id`, `name`, `class`, `capabilities`
- [ ] `drivers/<id>/driver.flow.compose.json` — triggers, actions, conditions
- [ ] `drivers/<id>/driver.settings.compose.json` — (optional) per-device settings
- [ ] `drivers/<id>/pair/validate.html` (copy from existing driver)
- [ ] `drivers/<id>/assets/images/` — small.png (75×75), large.png (500×500)
- [ ] Constants in `library/constants.js`
- [ ] Flow card JSON files
- [ ] i18n strings in all `locales/*.json`
- [ ] Registration in `library/app-protect.js` (or `app-access.js`)
- [ ] Run `npx homey app build` and `npx homey app validate`

