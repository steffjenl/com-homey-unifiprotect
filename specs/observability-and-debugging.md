# Observability and Debugging

---

## Log Levels

| Method | Level | When |
|--------|-------|------|
| `this.homey.app.debug(...)` | DEBUG | Verbose trace; only when `DEBUG=true` or persistent log enabled |
| `this.log(...)` | INFO | Normal operational events (from Device/Driver) |
| `this.homey.app.log(...)` | INFO | Normal operational events (from library/app) |
| `this.error(...)` | ERROR | Errors affecting functionality |

---

## Debug Mode

Activate via `env.json`:
```json
{ "DEBUG": "true" }
```

When active: `debug()` writes to `homey.log` and optionally to `/userdata/application-log.log`.

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

