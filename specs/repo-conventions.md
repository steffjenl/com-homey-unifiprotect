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

## `.homeycompose` vs `app.json`

- **Source of truth:** `.homeycompose/` folder
- `app.json` is **generated** — never edit it directly
- Run `homey app build` (or `npx homey app build`) after any `.homeycompose/` change

---

## New Driver Checklist

- [ ] `drivers/<id>/driver.js` — `onInit`, `onPair`, `onParseWebsocketMessage`, `getUnifiDeviceById`
- [ ] `drivers/<id>/device.js` — `onInit`, `waitForBootstrap`, `initDevice`, `_createMissingCapabilities`
- [ ] `drivers/<id>/driver.compose.json`
- [ ] `drivers/<id>/pair/validate.html` (copy from existing)
- [ ] `drivers/<id>/assets/images/` — small.png, large.png
- [ ] Constants in `library/constants.js`
- [ ] Flow card JSON files
- [ ] i18n strings in all `locales/*.json`
- [ ] Registration in `library/app-protect.js`

