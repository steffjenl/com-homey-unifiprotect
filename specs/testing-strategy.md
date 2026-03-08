# Testing Strategy

> **Current state (March 2026):** No test framework exists. `package.json` has no `test` script or test dependencies. This spec defines what to add when introducing tests.

---

## Test Pyramid

```
         ┌────────────────┐
         │  Manual / E2E  │  Real Homey + real NVR
         ├────────────────┤
         │  Integration   │  Mock HTTP/WS + real driver/device lifecycle
         ├────────────────┤
         │     Unit       │  Pure logic: event parsing, capability mapping
         └────────────────┘
```

---

## Recommended Stack

| Tool | Purpose |
|------|---------|
| `jest` | Test runner + assertions + mocking |
| `nock` | HTTP request mocking (`node:https`) |
| `ws` (already installed) | Mock WebSocket server |

Add to `package.json`:
```json
"devDependencies": {
  "jest": "^29.0.0",
  "nock": "^13.0.0"
},
"scripts": {
  "test": "jest"
}
```

---

## Fixtures (`test/fixtures/`)

### `ws-event-ring.json`
```json
{"type":"add","item":{"id":"event-001","modelKey":"event","type":"ring","start":1445408038748,"device":"doorbell-001"}}
```

### `ws-event-motion.json`
```json
{"type":"add","item":{"id":"event-002","modelKey":"event","type":"motion","start":1445408038651,"device":"camera-001"}}
```

### `ws-event-smart-detect.json`
```json
{"type":"update","item":{"id":"event-003","modelKey":"event","type":"smartDetectZone","start":1445408038984,"device":"camera-001","smartDetectTypes":["person"]}}
```

### `ws-device-nvr-update.json`
```json
{"type":"update","item":{"id":"nvr-001","modelKey":"nvr","name":"Test NVR"}}
```

### `bootstrap.json`
```json
{
  "lastUpdateId": "test-update-id-001",
  "nvr": {
    "id": "nvr-001",
    "name": "Test NVR",
    "isAway": false,
    "systemInfo": {
      "cpu": {"temperature": 45},
      "storage": {"available": 500000000000, "used": 100000000000, "size": 600000000000}
    }
  },
  "cameras": [{"id":"camera-001","name":"Front Door Camera","isConnected":true}],
  "lights": [], "sensors": [], "sirens": [], "chimes": []
}
```

---

## Mock Homey (`test/mocks/homey.mock.js`)

Stub implementations for:
- `homey.settings.get/set`
- `homey.flow.getTriggerCard / getActionCard / getDeviceTriggerCard`
- `homey.log / homey.error / homey.app.debug`
- `homey.setTimeout / homey.setInterval / homey.clearTimeout / homey.clearInterval`
- `homey.drivers.getDriver(id)`

---

## CI Integration

Once tests are added, extend `.github/workflows/homey-validation.yml`:
```yaml
- name: Install dependencies
  run: npm ci
- name: Run tests
  run: npm test
```

---

## Priority

1. `web-socket-events.js` event parsing (highest failure risk)
2. Each driver's `onParseWebsocketMessage`
3. `_createMissingCapabilities` migration logic
4. Bootstrap parsing in `protectapi.js`
5. NVR alarm state transitions in `protect-nvr-alarm` driver

