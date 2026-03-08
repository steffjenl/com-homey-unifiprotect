# Observability and Debugging

Official reference: [Homey SDK v3 — Logging](https://apps-sdk-v3.developer.homey.app/tutorial-Logging.html)

---

## Log Levels

| Method | Level | When | Where output goes |
|--------|-------|------|-------------------|
| `this.homey.app.debug(...)` | DEBUG | Verbose trace; only when `Homey.env.DEBUG === 'true'` or persistent log enabled | Homey app log + optionally `/userdata/application-log.log` |
| `this.log(...)` | INFO | Normal operational events (from Device/Driver) | Homey app log (visible in Homey Developer Tools) |
| `this.homey.app.log(...)` | INFO | Normal operational events (from library/app) | Homey app log |
| `this.error(...)` | ERROR | Errors affecting functionality | Homey app log + automatic Sentry report via `homey-log` |

> `this.log` and `this.error` are inherited from `Homey.SimpleClass` (the base of `Homey.App`, `Homey.Driver`, and `Homey.Device`). Output is visible in the **Homey Developer Tools** app log panel at [developer.homey.app](https://developer.homey.app) or via the CLI with `homey app logs`.

---

## Crash Reporting (`homey-log`)

This app uses the [`homey-log`](https://www.npmjs.com/package/homey-log) package (v2) to ship crash and unhandled rejection reports to Athom's Sentry instance.

```javascript
// app.js — onInit()
this.homeyLog = new Log({ homey: this.homey });
```

- `homeyLog` is **passive** — it automatically intercepts unhandled errors and `process.on('uncaughtException')`.
- Do **not** call `this.homeyLog.captureException()` manually; use `this.error(...)` for handled errors.
- Crash reports include the app version and Homey firmware version.
- No credentials or user data should ever reach Sentry — see [security-and-secrets.md](security-and-secrets.md) for redaction rules.

---

## Debug Mode

Activate via `env.json`:
```json
{ "DEBUG": "true" }
```

When active: `debug()` writes to `homey.log` and optionally to `/userdata/application-log.log`.

> **Note:** `env.json` values are accessed via `Homey.env.DEBUG` (not `process.env.DEBUG`). The Homey SDK injects `env.json` into `Homey.env` at runtime.

---

## Persistent Log File

- Path: `/userdata/application-log.log`
- Enabled in Settings → "Save log to persistent storage"
- Auto-deleted when > 25 MB
- Readable via settings page Status tab

---

## Status Page (Realtime Events)

| Event constant | Purpose |
|----------------|---------|
| `EVENT_SETTINGS_STATUS` | Login/auth status |
| `EVENT_SETTINGS_WEBSOCKET_STATUS` | WS connection state |
| `EVENT_SETTINGS_WEBSOCKET_LASTPONG` | Last pong received |
| `EVENT_SETTINGS_WEBSOCKET_LASTMESSAGE` | Last message timestamp |

---

## WebSocket State

Each WS class exposes:
- `isWebsocketConnected()` → `boolean`
- `getLastWebsocketMessageTime()` → `string|null` (ISO, truncated to minute)
- `loggedInStatus` → `'Unknown'|'Connecting'|'Connected'|'Disconnected'|<error message>`

---

## Common Debug Scenarios

**App doesn't connect:**
1. Check Settings → Status tab for login error
2. Enable persistent log → check `/userdata/application-log.log`
3. Verify NVR reachable at `https://<ip>:<port>`

**WebSocket events not received:**
1. Check `getProtectV2WebsocketStatus` in status tab
2. Verify v2 API key is set
3. Check last WS message time — stale = silent disconnect

**Flow card doesn't fire:**
1. Check event constant registered in `app-protect.js`
2. Add `debug()` in `onParseWebsocketMessage`
3. Verify event arrives in WS log but check routing

**Device shows unavailable:**
1. Check `isConnected` in WS device events
2. Verify `getUnifiDeviceById` — check number vs string ID mismatch

**NVR alarm state not updating:**
1. Verify v1 cookie login is working (bootstrap loaded)
2. Check `isAway` in bootstrap NVR object
3. v2 WS device stream does NOT include `isAway` — must use v1 bootstrap or poll

