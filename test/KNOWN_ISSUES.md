# Known issues found while writing tests

Not fixed yet. Tests documenting them use `test.failing` (passes while the bug exists, fails once
fixed, so remove the `.failing` then) or an explicit "known gap" test title.

1. **`JSON.parse` outside try/catch** — `library/protect-api-v2/web-socket-events.js` and
   `web-socket-devices.js`: a malformed websocket frame throws out of the `message` handler.
   Test: `web-socket-events.test.js` "invalid JSON throws out of the handler".
2. **access-reader `apple_pass` copy/paste** — `drivers/access-reader/driver.js`
   `onParseWebsocketMessage`: the `apple_pass` branch calls `onTouchPassConfigChange` with
   `access_method.touch_pass` instead of `apple_pass`. Test: `driver-parse-access.test.js`.
3. **access-intercom uses truthiness** (minor inconsistency) — `if (payload.state.lock)` /
   `if (payload.state.dps)` instead of `hasOwnProperty` like door/garagedoor, so an empty-string
   `dps` is skipped. Probably harmless.
4. **protectlight motion token** (minor) — `onMotionDetected(payload.lastMotion, ...)` is called
   even when the payload has no `lastMotion` (undefined timestamp).
5. **`getCameras` crashes without `featureFlags`** — `library/protectapi.js` `getCameras()` does
   `obj.featureFlags.isDoorbell` with no guard (TypeError rejects via the JSON/filter path), while
   `getDoorbells()` uses `?.`. Test: `protectapi-bootstrap.test.js` (`test.failing`).
6. **Doc/code mismatch (AGENTS.md §2 "Dual API Stack")** — AGENTS.md says NVR alarm control uses
   the dedicated v1 `arm/enable|disable` endpoints; `setNvrAwayMode` actually tries the v2 alarm
   profile endpoints first and only uses v1 as fallback. Decide which is right and align.
7. **`_findArmProfileIdByName` shadowing** (minor) — `library/protectapi.js`: `find()` stops at the
   first profile whose name matches, even when it has no `id`, so a later matching profile with an
   `id` is ignored. Test: `protectapi-bootstrap.test.js` (`test.failing`).
8. **V1 `decodeUpdateFrame` throws on corrupt JSON** — `library/websocket.js`: `JSON.parse` /
   `zlib.inflateSync` run outside the try/catch in `decodeUpdatePacket`, so a correctly-sized but
   corrupt frame throws out of the `message` handler. Test: `web-socket-v1.test.js` (`test.failing`).
9. **V1 message handler has no dispatch try/catch** (minor) — `library/websocket.js`
   `configureUpdatesListener`: unlike the V2 handlers, `getDriver(...)` / device calls are not
   wrapped, so a missing driver or throwing device handler escapes the `message` handler.
