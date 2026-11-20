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

## Debug Recording & "Save Debug Info"

Settings → Status tab → **Debug info**. Lets users send real-world data to the developer.

- **Recording:** `library/debug-recorder.js` (`this.homey.app.debugRecorder`). Start for 1 / 6 / 24 h
  (`DEBUG_RECORDING_DURATIONS`). Every websocket `message` handler calls `recorder.record(source, msg)`
  (sources `v1` (decoded packet), `v2-events`, `v2-devices`, `access`) **before** any filtering. No-op when not recording.
- **Storage:** JSONL `{ t, src, msg }` in `/userdata/debug-ws.jsonl`, buffered and appended every 2 s.
  Auto-stops at `DEBUG_RECORDING_MAX_BYTES` (10 MB) or when the duration elapses. State persisted in
  setting `ufp:debugRecording`, so a recording resumes after an app restart.
- **Export:** the settings page runs in a sandboxed iframe on my.homey.app (no `allow-downloads`), so a Blob
  download is silently blocked. Instead "Save Debug Info" calls `POST /debug/download-link`, which returns a
  local (`http://<ip>/api/app/<id>/debug-export/unifiprotect-debug-YYYYMMDD-HHMM.json?code=…`) and a cloud
  (`https://<homeyId>.connect.athom.com/…`) URL, and opens one with `Homey.openURL()` in a real browser tab.
  The query parameter is `code`, never `token`: Homey's Web API reads `?token=` as its own bearer token and
  answers 401 "Missing Session ID in Token" before the app handler runs.
  The `.json` file name in the path is only there so the browser proposes it on Ctrl+S (no headers can be set).
  `GET /debug-export/:filename` is a **public** endpoint: only a random 48-hex token, valid 15 min / 5 uses, in memory
  only (`DEBUG_DOWNLOAD_TOKEN_*`), returns data. The response holds app/Homey version, connection status, paired
  Homey devices, fresh raw V1 bootstrap (max 100 events), V2 nvr/cameras/lights/sensors/chimes/relays and
  `websocketMessages`. The user saves the tab with Ctrl+S.
- **Clear revokes links:** `clear()` also drops every issued download token, and the settings page hides the link buttons.
- **No zip / file download possible:** app API responses are always JSON, the iframe blocks downloads, and a
  Homey Image rejects non-image content (`Invalid Image Buffer`). So the export is JSON in a browser tab.
- **Redaction (`redact()`):** keys matching token/password/secret/cookie/csrf/apikey/accesskey/rtspAlias/… →
  `<removed>`; MAC/IP/host/e-mail/user names/NFC/fingerprint/PIN/phone/location/serial/license plate →
  `<redacted:xxxxxxxx>` (salted SHA-1, salt per recording so ids stay correlatable within one export);
  IPv4/MAC/e-mail patterns inside free text are masked too (`*version*` / `*firmware*` keys excepted).
  Add new sensitive field names to the patterns at the top of `debug-recorder.js`.

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

V2 websockets (`web-socket-events.js`, `web-socket-devices.js`):
- `Unauthorized (API key rejected, HTTP 401|403)` → the NVR refused the API key. No reconnect is scheduled; the next attempt comes from the hourly auth refresh or a settings save. Log line: `[V2 Events WS] API key rejected (HTTP 401); not reconnecting until the next auth refresh or settings change.`
- Any other close → reconnect with exponential backoff (10 s → 5 min). `reconnect attempt #N` in the log must increase while the controller stays unreachable; a constant `#1` means the backoff is being reset.

---

## Common Debug Scenarios

**App doesn't connect:**
1. Check Settings → Status tab for login error
2. Enable persistent log → check `/userdata/application-log.log`
3. Verify NVR reachable at `https://<ip>:<port>`

**WebSocket events not received:**
1. Check `getProtectV2WebsocketStatus` in status tab
2. Verify v2 API key is set
3. Status `Unauthorized (API key rejected, HTTP 401)` → create a new API key on the console itself (by IP, with an account that has Protect access) and save it in the settings
4. Check last WS message time — stale = silent disconnect

**`ECONNREFUSED <ip>:<port>` in the log:**
1. The port is the one saved in the settings (V1: `ufp:nvrport`, V2: `ufp:v2nvr`) — check for a typo; the default is 443

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

