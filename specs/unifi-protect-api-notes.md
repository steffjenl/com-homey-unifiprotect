# UniFi Protect API Notes

Source: Official API documentation in `.ai/unifi-protect-api-v2/`, cross-checked against
`specs/protect-integration-v2-openapi.json`.  
**API version: 7.1.87** — Base URL: `https://YOUR_CONSOLE_IP/proxy/protect/integration`
(the spec also documents a `https://api.ui.com/v1/connector/consoles/{consoleId}/proxy/protect/integration`
cloud-connector server variant; this app only uses the local console URL)

---

## Authentication

### v2 Integration API (API Key)
1. Generate key in UniFi Console → Protect → Settings → Integrations → Add New Integration
2. All requests include header: `X-API-KEY: <apiKey>`
3. All WebSocket connections include same header
4. Keys are long-lived — no expiry, manual revocation only

### v1 Legacy (Cookie)
1. `POST /api/auth/login` with `{username, password}`
2. Extract `Set-Cookie` → `_cookieToken`; `X-CSRF-Token` → `_csrfToken`
3. Cookie refreshed every **45 minutes** in `app-protect.js`

### Access v2 (Bearer)
1. API key from UniFi Console → Access → Settings → Integrations
2. Header: `Authorization: Bearer <apiKey>`
3. Port **12445** for WebSocket

---

## How to Create an API Key

### UniFi Protect API Key
1. Log in to UniFi Console (`https://<NVR_IP>`)
2. **UniFi Protect** → **Settings** → **Integrations** → **Local Access**
3. Click **Add New Integration** → give it a name (e.g. "Homey")
4. Copy the generated key → paste in Homey app Settings → **UniFi Protect V2 API Key**

### UniFi Access API Key
1. Log in to UniFi Console (`https://<NVR_IP>`)
2. **UniFi Access** → **Settings** → **Integrations** → **Local Access**
3. Click **Add New Integration** → copy key → paste in Homey app Settings → **API Key** (Access tab)

> ⚠️ **Security**: Create a dedicated local user/integration with minimal permissions. Never use admin or cloud accounts. See [security-and-secrets.md](security-and-secrets.md).

---

## Official REST Endpoints (v2)

All paths relative to `https://<NVR_IP>:443/proxy/protect/integration`.

### Meta
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/meta/info` | Get application version info |

### Cameras
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/cameras` | Get all cameras |
| `GET` | `/v1/cameras/{id}` | Get camera details |
| `PATCH` | `/v1/cameras/{id}` | Patch camera settings |
| `GET` | `/v1/cameras/{id}/snapshot` | Get camera snapshot |
| `POST` | `/v1/cameras/{id}/rtsps-stream` | Create RTSPS stream |
| `DELETE` | `/v1/cameras/{id}/rtsps-stream` | Delete RTSPS stream |
| `GET` | `/v1/cameras/{id}/rtsps-stream` | Get RTSPS stream |
| `POST` | `/v1/cameras/{id}/talkback-session` | Create talkback session |
| `POST` | `/v1/cameras/{id}/disable-mic-permanently` | Permanently disable mic |

### Camera PTZ
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/cameras/{id}/ptz/patrol/start/{slot}` | Start PTZ patrol |
| `POST` | `/v1/cameras/{id}/ptz/patrol/stop` | Stop PTZ patrol |
| `POST` | `/v1/cameras/{id}/ptz/goto/{slot}` | Go to PTZ preset |
| `POST` | `/v1/cameras/{id}/ptz/home` | Go to PTZ home |

### Sensors
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/sensors` | Get all sensors |
| `GET` | `/v1/sensors/{id}` | Get sensor details |
| `PATCH` | `/v1/sensors/{id}` | Patch sensor settings |

### NVR
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/nvrs` | Get NVR details (returns array) |

> ⚠️ **Important**: The official v2 integration API keeps `nvrs` read-only (GET only, no PATCH).  
> Alarm arming is handled via dedicated alarm action endpoints (see **NVR Alarm / Away Mode** below), not via `PATCH /v1/nvrs/{id}`.

### Chimes
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/chimes` | Get all chimes |
| `GET` | `/v1/chimes/{id}` | Get chime details |
| `PATCH` | `/v1/chimes/{id}` | Patch chime settings |

### Chime test tone (v1 API)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `chimes/{id}/play-speaker` | Play test tone on chime speaker |

### Viewers
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/viewers` | Get all viewers |
| `GET` | `/v1/viewers/{id}` | Get viewer details |
| `PATCH` | `/v1/viewers/{id}` | Patch viewer settings (`name`, `liveview`) |

### Live Views
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/liveviews` | Get all live views |
| `GET` | `/v1/liveviews/{id}` | Get live view details |
| `PATCH` | `/v1/liveviews/{id}` | Patch live view |
| `POST` | `/v1/liveviews` | Create live view |

---

## WebSocket Subscriptions (v2)

### `/v1/subscribe/events` — Protect Events
- URL: `wss://<NVR_IP>:443/proxy/protect/integration/v1/subscribe/events`
- Auth: `X-API-KEY` header
- Implemented: `library/protect-api-v2/web-socket-events.js`

**Message format:**
```json
{
  "type": "add" | "update",
  "item": {
    "id": "66d025b301ebc903e80003ea",
    "modelKey": "event",
    "type": "ring" | "motion" | "smartDetectZone",
    "start": 1445408038748,
    "end": 1445408048748,
    "device": "<cameraId>",
    "smartDetectTypes": ["person", "vehicle", "animal", "package", "licensePlate", "face"]
  }
}
```

**Handled:**
- `add` + `type=ring` → doorbell ring
- `add` + `type=motion` → camera motion
- `update` + `type=smartDetectZone` + `smartDetectTypes != []` → smart detection

### `/v1/subscribe/devices` — Device State Updates
- URL: `wss://<NVR_IP>:443/proxy/protect/integration/v1/subscribe/devices`
- Auth: `X-API-KEY` header
- Implemented: `library/protect-api-v2/web-socket-devices.js`

**Message format (from official docs):**
```json
{
  "type": "add" | "update" | "remove",
  "item": {
    "id": "66d025b301ebc903e80003ea",
    "modelKey": "nvr" | "camera" | "light" | "sensor" | "siren" | "viewer",
    "name": "string",
    "...": "device-specific fields"
  }
}
```

---

## NVR Alarm / Away Mode

Protect firmware now exposes alarm actions through dedicated **v2** endpoints, with **v1** fallback for compatibility.

### Preferred v2 endpoints (observed on UNVR Instant 7.1.69)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v2/alarms/profiles/{profileId}/actions/arm` | Arm selected alarm profile |
| `POST` | `/api/v2/alarms/profiles/{profileId}/actions/disarm` | Disarm selected alarm profile |
| `POST` | `/api/v2/alarms/actions/disarm` | Generic disarm fallback endpoint |

Notes:
- These calls use cookie + CSRF auth (same as v1 web session), not `X-API-KEY`.
- Current app behavior: try profile-specific v2 endpoint first, then fallback.

### Legacy v1 fallback endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/proxy/protect/api/arm/enable` | Enable away mode (arm) |
| `POST` | `/proxy/protect/api/arm/disable` | Disable away mode (disarm) |

> ⚠️ **Important**: Do NOT use `PATCH /proxy/protect/api/nvr` with `isAway` for alarm control.  
> Use alarm action endpoints only (`/api/v2/alarms/...` preferred, `arm/enable|disable` fallback).

### State sources used by the app

Primary state comes from bootstrap (`nvr.armMode`) and websocket events.

`nvr.armMode` can include statuses such as:
```json
{ "status": "armed" }
```
or
```json
{ "status": "disarmed" }
```
or
```json
{ "status": "disabled" }
```

Legacy shapes also occur on older paths:
```json
{ "isEnabled": true }
```
```json
{ "isAway": true }
```

### WebSocket alarm state messages (observed)

The app now handles all three patterns below:

1) **NVR model update** (`modelKey: nvr`) with `payload.armMode` and/or `payload.isAway`.

2) **NVR event message** (`modelKey: event`, `recordModel: nvr`) with `payload.type`:
```json
{
  "action": { "action": "add", "modelKey": "event", "recordModel": "nvr" },
  "payload": {
    "type": "armed",
    "metadata": {
      "armProfileId": "019e3e47-6673-7c32-b4bf-37da150c9ed9",
      "armProfileName": "Alarm Profiel Thuis"
    }
  }
}
```
and
```json
{
  "action": { "action": "add", "modelKey": "event", "recordModel": "nvr" },
  "payload": {
    "type": "disarmed",
    "metadata": {
      "armProfileId": "019e3e47-6673-7c32-b4bf-37da150c9ed9",
      "armProfileName": "Alarm Profiel Thuis"
    }
  }
}
```

3) **External alarm profile update** (`modelKey: externalArmProfile`) with `payload.state` (`armed`/`disarmed`).

---

## Sensor Alarm & Extreme-Value Events (new in 7.1.87)

As of API v7.1.87 the `sensor` device schema and its event set grew several security/alarm
features. Diffed against the previously checked-in v7.1.69 spec, the **only** real additions are
Sensor-related; no REST paths were added or removed (54 paths, identical set, both versions).

### New `sensor` schema fields

| Field | Type | Notes |
|---|---|---|
| `glassBreakSettings` | `{isEnabled, sensitivity, sensitivityWhenArmed}` | Glass-break detection config |
| `alarmSettings` | `{isEnabled}` | Smoke + CO alarm sensor toggle |
| `scheduleMode` | `"always" \| "when_armed"` | Applies to both glass-break and motion detection |
| `armProfileIds` | `string[] \| null` | Restricts `when_armed` detection to specific arm profiles |
| `hasCustomSensitivityWhenArmed` | `boolean` | Use `sensitivityWhenArmed` values while armed |

> ⚠️ `sensorStats` (the official v2 OpenAPI `stats.{light,humidity,temperature}` schema returned
> for every sensor) is **unchanged** — it still has no AQI/CO2/VOC/PM field, documented or
> otherwise. **However**, a real UP-AirQuality bootstrap capture confirms continuous readings
> for these metrics *do* exist — just outside that schema, under `sensor.airQuality` (see
> below). That field is undocumented in the official OpenAPI spec; it's only confirmed present
> via the **v1 legacy bootstrap/websocket** (`library/protectapi.js`, `library/websocket.js`),
> which this app already runs as its primary/fallback API path. It's unconfirmed whether it's
> also present on the v2 `/v1/sensors/{id}` REST response or the v2 `/v1/subscribe/devices`
> websocket for this device.

### UP-AirQuality continuous readings (`sensor.airQuality`, v1 legacy only, confirmed on real hardware)

Real bootstrap capture (`GET bootstrap`, API v1) for a UP-AirQuality unit (`type:
"UP-AirQuality"`, `modelKey: "sensor"` - same collection as every other Sensor) includes:

```json
"airQuality": {
  "aqi": {"value": 0, "status": "neutral"},
  "vape": {"value": 0, "status": "neutral"},
  "tvoc": {"value": 11.6, "status": "neutral"},
  "pm1p0": {"value": 0, "status": "neutral"},
  "pm2p5": {"value": 0, "status": "neutral"},
  "pm4p0": {"value": 0, "status": "neutral"},
  "pm10p0": {"value": 0, "status": "neutral"},
  "humidity": {"value": 40.2, "status": "neutral"},
  "temperature": {"value": 28.07, "status": "neutral"},
  "voc": {"value": 74, "status": "neutral"},
  "co2": {"value": 494, "status": "neutral"}
}
```

Refreshed at `airQualitySettings.readingInterval` seconds (15s by default) - this is a genuine
live feed, not event-only. Note `sensor.stats.{humidity,temperature}` stay `null` on this device;
`sensor.airQuality.{humidity,temperature}` is the real source for those two on UP-AirQuality.
`sensor.airQuality.vape` is a 0-100 index (separate from the `alarm_vape`/`sensorVapeEvent`
boolean detection signal) - not currently mapped to a Homey capability (no system "vape index"
capability exists).

Also present on the same device object:
- `sensor.smokeStatus`: `{smokeAlarm, coAlarm, batteryLow, smokeSensorFault, coSensorFault,
  endOfLife, enabled, ready, testing, smokeValue, coValue, batteryVoltage, ...}` - continuous
  smoke/CO alarm state, complements the discrete `sensorAlarmEvent`.
- `sensor.batteryStatus`: `{percentage, isLow, modelKey: "sensorBatteryStatus"}` - present on
  every sensor; `percentage` stays `null` on wired/PoE units like UP-AirQuality.
- `sensor.airQualitySettings`: per-metric enable + threshold config (`aqiSettings`,
  `tvocSettings`, `pm1p0Settings`, ..., `vapeSettings.{isEnabled,lowThreshold,highThreshold}`,
  `vapeSensitivitySettings`, `ringLedMetric` (`0`=CO2, `1`=AQI), `readingInterval`,
  `nightModeEnabled`/`nightModeStartTime`/`nightModeEndTime`).

All of the above are consumed in `drivers/protectsensor/device.js` via
`onAirQualityChange`/`onBatteryStatusChange`/`onSmokeStatusChange` (live updates, routed from
`payload.airQuality`/`batteryStatus`/`smokeStatus` in `driver.js::onParseWebsocketMessage`) and
in `_createMissingCapabilities`/`_initSensorData` (bootstrap).

**Confirmed against a real captured websocket stream** (v1 `modelKey: "sensor"` update packets,
UP-AirQuality unit, `readingInterval: 1`s in that capture):
- `payload: {"airQuality": {...}, "nvrMac": "..."}` - `airQuality` updates arrive **alone**,
  never bundled with a `stats` key. So the theoretical risk previously noted here (`library/
  websocket.js`'s `shouldProcessEvent()` drops any sensor `update` packet whose payload contains
  a `stats` key, `if (updatePacket.payload.stats) return false;` - added to filter noisy camera
  video-stats updates) does not materialize in practice for this device.
- `airQualitySettings` changes push live as their own `payload: {"airQualitySettings": {...}}`
  packet - not currently consumed (capability gating only re-evaluates from a fresh full
  bootstrap fetch, same as every other settings-driven capability in this driver, e.g.
  `motionSettings`), so a live settings change (e.g. enabling vape alerting) only takes effect on
  next reconnect/bootstrap refresh, not instantly. Consistent with existing behavior elsewhere in
  this driver, not a regression.
- Battery/wireless sensors (unrelated to UP-AirQuality) confirm `payload.batteryStatus` arrives
  standalone too: `{"percentage": 96, "isLow": false, "modelKey": "sensorBatteryStatus"}`,
  exactly matching `onBatteryStatusChange`'s expected shape.

### New/extended events (`/v1/subscribe/events`)

| `item.type` | Schema | Payload | Meaning |
|---|---|---|---|
| `sensorVape` | `sensorVapeEvent` | `{id, modelKey, type, start, end, device}` | Sensor detected vape (UP-AirQuality) |
| `sensorAlarm` | `sensorAlarmEvent` | `+ metadata.alarmType.text` | Alarm state started/ended. `alarmType.text` enum extended to: `smoke`, `CO`, `glassBreak`, `sensorButtonPress`, `tamper`, `short`, `cut` (previously only `smoke`/`CO`/`sensorButtonPress`) |
| `sensorExtremeValues` | `sensorExtremeValueEvent` | `+ metadata.sensorType.text`, `metadata.sensorValue.text`, `metadata.status.text` | A metric went in/out of its configured range. `sensorType.text` enum extended with UP-AirQuality metrics: `aqi`, `vape`, `tvoc`, `pm1p0`, `pm2p5`, `pm4p0`, `pm10p0`, `co2`, `voc` (previously only `temperature`/`light`/`humidity`) |
| `sensorTamper` | `sensorTamperEvent` | `{id, modelKey, type, start, end, device}` | Tamper detected |
| `sensorBatteryLow` | `sensorBatteryLowEvent` | `{id, modelKey, type, start, end, device}` | Battery low |

None of these are currently routed by `library/protect-api-v2/web-socket-events.js` — that file
today only dispatches camera/doorbell `itemType`s (`ring`, `motion`, `smartDetectZone`,
`smartAudioDetect`). Sensor event routing was added to support the UP-AirQuality ("Vape
Detection & Air Quality Sensor") device — see `drivers/protectsensor/device.js`
(`onVapeDetected`, `onExtremeValue`, `onSensorAlarm`).

### Metric → Homey capability mapping

Same mapping used for both the continuous `sensor.airQuality.<metric>.value` (bootstrap/live) and
the discrete `sensorExtremeValues.metadata.sensorType.text` event - see
`AIR_QUALITY_METRIC_CAPABILITIES` in `drivers/protectsensor/device.js`. Almost all map to
existing Homey **system** capabilities (`node_modules/homey-lib/assets/capability/capabilities/`)
- only `measure_pm4` is custom since Homey has no PM4.0 tier:

| metric key | Homey capability | System or custom |
|---|---|---|
| `aqi` | `measure_aqi` | system |
| `co2` | `measure_co2` | system |
| `voc` | `measure_tvoc_index` | system (unitless VOC index, matches Ubiquiti's 1-500 range) |
| `tvoc` | `measure_tvoc` | system (µg/m³ concentration) |
| `pm1p0` | `measure_pm1` | system |
| `pm2p5` | `measure_pm25` | system |
| `pm4p0` | `measure_pm4` | **custom** (`.homeycompose/capabilities/measure_pm4.json`) |
| `pm10p0` | `measure_pm10` | system |
| `vape` | *(no numeric capability; `alarm_vape` is sourced from `sensorVapeEvent` instead)* | — |

`sensorAlarmEvent.metadata.alarmType.text` → capability: `smoke`→`alarm_smoke` (system),
`CO`→`alarm_co` (system), `tamper`→`alarm_tamper` (system), `glassBreak`→`alarm_glassbreak`
(**custom**, no system equivalent). `sensorButtonPress`/`short`/`cut` have no capability mapping
yet. `sensorVapeEvent` → `alarm_vape` (**custom**). `alarm_smoke`/`alarm_co` are also kept live
from the continuous `sensor.smokeStatus.{smokeAlarm,coAlarm}` (see above), not just the discrete
event. `sensor.batteryStatus.isLow`/`.percentage` → `alarm_battery`/`measure_battery` (both
system), present on every sensor (not just UP-AirQuality).

---

## v1 Legacy Endpoints

All paths relative to `https://<NVR_IP>:<port>/proxy/protect/api/`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login → returns cookie + CSRF |
| `GET` | `bootstrap` | Full bootstrap (all devices, users, NVR info) |
| `GET` | `nvr` | NVR info |
| `PATCH` | `nvr` | **Update NVR settings (e.g. `isAway`)** |
| `GET` | `cameras` | Camera list |
| `PATCH` | `cameras/{id}` | Update camera |
| `GET` | `sirens` | Siren list |
| `PATCH` | `sirens/{id}` | Update siren |

---

## Known Quirks

- `GET /v1/nvrs` returns an **array** — always take `result[0]` or find by ID
- Device IDs are strings in v2 but may be numbers from v1 bootstrap — always `String()` compare
- `rejectUnauthorized: false` is required — NVRs use self-signed TLS certificates
- WebSocket connections need a **ping every 30 seconds** to prevent timeout
- The v2 `/subscribe/devices` NVR item does NOT include `isAway` in its official schema
- Newer firmware can emit alarm transitions as `event` (`recordModel: nvr`, `type: armed|disarmed`) and `externalArmProfile` updates instead of only `nvr.armMode` updates

