# FOB Pipeline Smoke Test

This test (`test/unit/fob-pipeline.test.js`) validates the new FOB event pipeline:

1. Parse websocket `sensorButtonPressed` payload into normalized `fob.button`
2. Map `doublePress` action handling
3. Verify duplicate event suppression within dedupe window

Run:

```bash
npx jest test/unit/fob-pipeline.test.js
```

