# protect-v1-debug

Standalone Node.js debug collector for UniFi Protect V1.

It does three things:
- Logs in with username/password from `.env`
- Downloads `bootstrap` and writes it to a JSON file
- Connects to V1 websocket updates and writes decoded packets to rolling NDJSON logs

## Files written

Inside `OUTPUT_DIR` (default `./output`):
- `bootstrap-YYYYMMDD-HHMMSS.json`
- `decoded-YYYY-MM-DD.ndjson`
- `decoded-YYYY-MM-DD-1.ndjson` (when size limit reached)

Daily rollover is automatic. Size-based rollover is controlled by `MAX_LOG_SIZE_MB`.

## Configuration

Copy `.env.example` to `.env` and fill in values:

- `PROTECT_HOST` (required)
- `PROTECT_PORT` (default: `443`)
- `PROTECT_USERNAME` (required)
- `PROTECT_PASSWORD` (required)
- `RUN_SECONDS` (default: `3600`, so 60 minutes)
- `OUTPUT_DIR` (default: `./output`)
- `MAX_LOG_SIZE_MB` (default: `50`)
- `RECONNECT_DELAY_MS` (default: `5000`)

## Run

```bash
cd /Users/stephan/Projects/Homey/com-homey-unifiprotect/tools/protect-v1-debug
npm install
cp .env.example .env
# edit .env
npm start
```

## Self-test (decoder only)

```bash
cd /Users/stephan/Projects/Homey/com-homey-unifiprotect/tools/protect-v1-debug
npm test
```

## Notes

- TLS certificate validation is disabled on purpose because Protect deployments often use self-signed certificates.
- The tool does not write credentials or cookie values to log files.
- Runtime ends automatically when `RUN_SECONDS` is reached, or earlier via `Ctrl+C`.
