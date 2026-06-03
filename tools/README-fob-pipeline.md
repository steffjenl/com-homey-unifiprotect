# FOB Pipeline Smoke Test

This smoke test validates the new FOB event pipeline:

1. Parse websocket `sensorButtonPressed` payload into normalized `fob.button`
2. Map `doublePress` action handling
3. Verify duplicate event suppression within dedupe window

Run:

```bash
node tools/fob-pipeline-smoke.js
```

