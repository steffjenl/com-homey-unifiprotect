# Homey App Architecture

SDK: **Homey SDK v3** (`"sdk": 3` in `app.json`). Entry point: `app.js`.

---

## Directory Layout

```
app.js                          # UniFiProtect extends Homey.App
app.json                        # GENERATED — do not edit. Edit .homeycompose/ instead.
.homeycompose/
  app.json                      # App manifest source
  capabilities/                 # Custom capability JSON files
  flow/
    actions/                    # Global action flow card JSON files
    triggers/                   # Global trigger flow card JSON files
drivers/
  <driver-id>/
    driver.js                   # Homey.Driver subclass
    device.js                   # Homey.Device subclass
    driver.compose.json         # Driver manifest
    driver.flow.compose.json    # Driver-scoped flow cards
    driver.settings.compose.json # (optional) Per-device settings
    assets/images/              # small.png, large.png (xlarge optional)
    pair/                       # validate.html (+ other pair views)
library/
  app-protect.js                # Protect flow card registration + login logic
  app-access.js                 # Access flow card registration + login logic
  baseclass.js                  # BaseClass extends Homey.SimpleClass
  constants.js                  # All event/action string constants
  protectapi.js                 # v1 API (cookie-based)
  webclient.js                  # v1 HTTP client
  websocket.js                  # v1 WebSocket (binary protocol)
  protect-api-v2/
    protect-api.js              # v2 REST: cameras, lights, sensors, chimes, nvr
    web-client.js               # v2 HTTPS client (X-API-KEY header)
    web-socket-events.js        # v2 WS /subscribe/events
    web-socket-devices.js       # v2 WS /subscribe/devices
  access-api-v2/
    access-api.js               # Access REST: doors, readers, hubs
    web-client.js               # Access HTTPS client (Bearer header)
    web-socket.js               # Access WebSocket
    base-class.js               # Base for Access library classes
locales/                        # i18n (en.json, nl.json, de.json, …)
settings/                       # App settings page (index.html + settings.css)
widgets/                        # Dashboard widgets (camera, doorbell)
api.js                          # Homey app API endpoints (status, test, etc.)
```

---

## App Class (`app.js`)

`UniFiProtect extends Homey.App` — the singleton for the entire app.

Key responsibilities:
- Instantiates `AppProtect`, `AppAccess`, `ProtectAPI v1`, `ProtectAPIV2`, `AccessAPI`
- Listens to `homey.settings.on('set', ...)` → triggers re-login when credentials change
- Exposes `this.homey.app.api` (v1), `this.homey.app.apiV2` (v2), `this.homey.app.accessApi`
- `debug(…)` method: writes to Homey log when `DEBUG=true`, optionally to `/userdata/application-log.log`

---

## Dual API Architecture

| Stack | Auth | Base URL | Class |
|-------|------|----------|-------|
| **v1 Legacy** | Cookie + CSRF | `/proxy/protect/api/` | `library/protectapi.js` |
| **v2 Integration** | `X-API-KEY` header | `/proxy/protect/integration/v1/` | `library/protect-api-v2/protect-api.js` |
| **Access v2** | `Bearer` token | Port 12445 | `library/access-api-v2/access-api.js` |

Both v1 and v2 run in parallel. The v2 API key is optional — app degrades gracefully.

---

## Standard Driver Pattern

```javascript
'use strict';
const Homey = require('homey');

class MyDriver extends Homey.Driver {
    async onInit() {
        this.homey.app.debug('MyDriver initialized');
    }

    onPair(session) {
        const homey = this.homey;
        session.setHandler('validate', async (data) => {
            const nvrip = homey.settings.get('ufp:nvrip');
            return (nvrip ? 'ok' : 'nok');
        });
        session.setHandler('list_devices', async (data) => {
            return (await homey.app.api.getDevices()).map(d => ({
                name: d.name,
                data: { id: String(d.id) },
            }));
        });
    }

    onParseWebsocketMessage(device, payload) {
        if (Object.prototype.hasOwnProperty.call(device, '_events')) {
            if (payload.hasOwnProperty('someField')) {
                device.onSomeChange(payload.someField);
            }
        }
    }

    getUnifiDeviceById(deviceId) {
        try {
            const devices = this.getDevices();
            const device = devices.find(d => String(d.getData().id) === String(deviceId));
            return device || false;
        } catch (e) {
            return false;
        }
    }
}
module.exports = MyDriver;
```

---

## Standard Device Pattern

```javascript
'use strict';
const Homey = require('homey');

class MyDevice extends Homey.Device {
    async onInit() {
        await this.waitForBootstrap();
    }

    async waitForBootstrap() {
        // For v1: wait until bootstrap is loaded
        if (this.homey.app.api.getLastUpdateId() !== null) {
            await this.initDevice();
        } else {
            this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
        }
    }

    async initDevice() {
        this.registerCapabilityListener('some_capability', async (value) => {
            return this.homey.app.api.setSomething(this.getData(), value);
        });
        await this._createMissingCapabilities();
        await this._initDeviceData();
    }

    async _createMissingCapabilities() {
        // Add new capabilities, remove deprecated ones
        if (!this.hasCapability('new_cap')) {
            await this.addCapability('new_cap');
        }
    }
}
module.exports = MyDevice;
```

Key rules:
- `waitForBootstrap()` polls every **250 ms** using `homey.setTimeout`
- For **v2-only devices**: poll `homey.app.apiV2.websocket.isWebsocketConnected()` instead
- `getData().id` is the UniFi device UUID — always compare with `String()`
- `_createMissingCapabilities()` handles capability migration between app versions

---

## Capabilities

Custom capabilities: `.homeycompose/capabilities/<name>.json`

Example:
```json
{
  "type": "boolean",
  "title": { "en": "Away mode" },
  "getable": true,
  "setable": false,
  "uiComponent": "sensor"
}
```

Built-in Homey capabilities (e.g. `alarm_generic`, `alarm_motion`, `locked`) need no JSON file.

---

## Flow Cards

| Type | Location | Fired via |
|------|----------|-----------|
| Global triggers | `.homeycompose/flow/triggers/<id>.json` | `homey.flow.getTriggerCard(id).trigger(tokens)` |
| Global actions | `.homeycompose/flow/actions/<id>.json` | `homey.flow.getActionCard(id).registerRunListener(...)` |
| Device triggers | `driver.flow.compose.json → triggers[]` | `homey.flow.getDeviceTriggerCard(id).trigger(device, tokens)` |
| Device actions | `driver.flow.compose.json → actions[]` | Registered in `driver.onInit()` |

---

## Settings Storage Keys

| Key | Type | Value |
|-----|------|-------|
| `ufp:nvrip` | string | NVR IP address |
| `ufp:nvrport` | string | NVR port (default 443) |
| `ufp:credentials` | object | `{username, password}` |
| `ufp:tokens` | object | `{accessApiKey, protectV2ApiKey}` |
| `ufp:settings` | object | `{useCameraSnapshot, ignoreEventsNfcFingerprint, ignoreEventsDoorbell, saveLogToPersistentStorage}` |

---

## Pair Flow (Standard)

3 views: `validate` → `list_devices` → `add_devices`

`pair/validate.html` calls `Homey.emit('validate')` → driver returns `'ok'` or `'nok'`.

