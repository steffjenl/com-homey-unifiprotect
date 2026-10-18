# Known issues found while writing tests

Bugs that tests exposed. Fixed ones keep a regression test; open ones use `test.failing` (passes
while the bug exists, turns red once fixed, then drop the `.failing`).

## Open

None.

## Fixed

1. `JSON.parse` outside try/catch in the V2 events/devices websockets — malformed frames are now
   ignored and logged. Tests: `web-socket-events.test.js`, `web-socket-devices.test.js`.
2. access-reader `apple_pass` read `touch_pass` — now reads `apple_pass`.
   Test: `driver-parse-access.test.js`.
3. access-intercom used truthiness checks — now `hasOwnProperty` like door/garagedoor.
   Test: `driver-parse-access.test.js`.
4. protectlight wrote `undefined` into `last_motion_at` when a PIR update had no `lastMotion` —
   now skipped. Test: `protectlight-device.test.js`.
5. `getCameras` (v1) crashed on a camera without `featureFlags` — now treated as a camera.
   Test: `protectapi-bootstrap.test.js`.
7. `_findArmProfileIdByName` matched a profile without id and ignored a later valid one — profiles
   without id are skipped. Test: `protectapi-bootstrap.test.js`.
8. V1 `decodeUpdatePacket` threw on corrupt JSON / deflate inside a correctly sized frame — now
   returns null. Test: `web-socket-v1.test.js`.
9. V1 message handler had no dispatch try/catch — body moved to `_handleUpdateMessage`, wrapped
   like the V2 handlers. Test: `web-socket-v1.test.js`.
10. V1 `shouldProcessEvent` dropped `chime` / `siren` updates (their routing branches were dead
    code) — both now accepted. Test: `web-socket-v1-routing.test.js`.
    Behaviour change: chime/siren volume updates on V1 now reach the devices; confirm on a real
    Homey with a V1-only setup.
6. NVR alarm control is now v1 first (`arm/enable|disable`), v2 alarm profiles as fallback, which
   matches AGENTS.md; AGENTS.md and `specs/unifi-protect-api-notes.md` were updated to describe
   the fallback. Auth errors are never retried. `_canFallbackToV1FromV2Error` was removed.
   Tests: `protectapi-bootstrap.test.js` ("setNvrAwayMode (v1 first, v2 fallback)").
7b. `_findV2AlarmProfileIdByName` matched a profile whose id was not a UUID and ignored a later
    valid one — only profiles with a UUID id can match now. Test: `protectapi-bootstrap.test.js`.
