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

> **SDK test utilities:** The `homey` devDependency (`^3.9.4`, already installed) exports `Homey.SimpleClass` and base classes that can be used in unit tests without a real Homey device. Import with `const Homey = require('homey')`. The `homey-apps-sdk-v3-types` package (installed as `@types/homey`) provides TypeScript type definitions for mock type-checking.

---

## Widget API Testing

Widget `api.js` handlers are plain `async` functions — they can be unit-tested without any Homey runtime:

```javascript
// test/widgets/camera.test.js
const api = require('../../widgets/camera/api');

test('getSnapshotUrl returns cloudUrl', async () => {
    const mockDevice = { cloudUrl: 'https://example.com/snap.jpg', getData: () => ({ id: '123' }) };
    const mockDriver = { getUnifiDeviceById: () => mockDevice };
    const mockHomey = { drivers: { getDriver: () => mockDriver } };

    const result = await api.getSnapshotUrl({ homey: mockHomey, query: { deviceId: '123' } });
    expect(result).toBe('https://example.com/snap.jpg');
});

test('getSnapshotUrl throws when device not found', async () => {
    const mockDriver = { getUnifiDeviceById: () => null };
    const mockHomey = { drivers: { getDriver: () => mockDriver } };

    await expect(api.getSnapshotUrl({ homey: mockHomey, query: { deviceId: 'bad' } }))
        .rejects.toThrow('not found');
});
```

The same pattern applies to `api.js` root-level endpoints (status, testCredentials, etc.).

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

