# UniFi Protect API Notes

Source: Official API documentation in `.ai/unifi-protect-api-v2/`.  
**API version: 6.2.88** — Base URL: `https://YOUR_CONSOLE_IP/proxy/protect/integration`

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

> ⚠️ **Important**: The official v2 API exposes NVR as **read-only** (GET only, no PATCH).  
> The `isAway` alarm mode must be controlled via the **v1 API** (`PATCH /proxy/protect/api/nvr`).

### Chimes
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/chimes` | Get all chimes |
| `GET` | `/v1/chimes/{id}` | Get chime details |
| `PATCH` | `/v1/chimes/{id}` | Patch chime settings |

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

The NVR `isAway` field is available in the **v1 API**:

- **Read**: `GET /proxy/protect/api/bootstrap` → `nvr.isAway: boolean`
- **Write**: `PATCH /proxy/protect/api/nvr` with `{ "isAway": true/false }`

The `isAway` field controls whether the NVR is in "away" (armed) mode.  
For the alarm driver, use the **v1 API** (`library/protectapi.js`) since the v2 API exposes NVR as read-only.

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

