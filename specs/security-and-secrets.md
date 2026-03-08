# Security and Secrets

---

## What is a Secret

- NVR username/password (`ufp:credentials`)
- Protect v2 API key (`ufp:tokens.protectV2ApiKey`)
- Access API key (`ufp:tokens.accessApiKey`)
- Session cookies and CSRF tokens
- `HOMEY_PAT` GitHub Actions token

---

## Storage Rules

| Storage | Allowed | Notes |
|---------|---------|-------|
| `homey.settings` | ✅ Yes | All credentials here — Homey encrypts this |
| `env.json` | ⚠️ Dev only | Only `DEBUG=true` — never commit real keys |
| Git repo | ❌ Never | No secrets in source code |
| Log files | ❌ Never | Redact before logging |
| `homey.log` | ❌ Never | Redact before logging |

---

## Redaction Rules

**Never log the value of:** passwords, API keys, cookies, CSRF tokens.

**BAD:**
```javascript
this.homey.app.debug('API key: ' + tokens.protectV2ApiKey);
```

**GOOD:**
```javascript
this.homey.app.debug('API key set: ' + (tokens.protectV2ApiKey ? 'yes' : 'no'));
```

---

## `env.json` and `Homey.env`

Listed in `.gitignore`. Only use for:
```json
{ "DEBUG": "true" }
```

> **Important:** `env.json` values are accessed via **`Homey.env.DEBUG`**, not `process.env.DEBUG`. The Homey SDK injects `env.json` into the `Homey.env` object at runtime. Using `process.env` will return `undefined`.

```javascript
// CORRECT
if (Homey.env.DEBUG === 'true') { ... }

// WRONG — always undefined at runtime
if (process.env.DEBUG === 'true') { ... }
```

Never add credentials, API keys, or tokens to `env.json`.

---

## GitHub Actions Secrets

| Secret | Used by | Purpose |
|--------|---------|---------|
| `HOMEY_PAT` | `homey-publish.yml` | Authenticate with Athom for publishing |

No NVR credentials should ever be in GitHub secrets.

---

## TLS Note

`rejectUnauthorized: false` is **intentional** — UniFi NVRs use self-signed certificates on the local network. This is not a security mistake. Always document with a comment:

```javascript
rejectUnauthorized: false, // NVR uses a self-signed certificate on the local network
```

---

## API Key Rotation

If a key is compromised:
1. UniFi Console → Protect/Access → Settings → Integrations
2. Delete the compromised integration
3. Create a new integration → copy new key
4. Update in Homey app settings → app auto-reconnects via `homey.settings.on('set', 'ufp:tokens', ...)`

---

## User Setup Guidance

The settings page should always advise:
> "Create a dedicated local user/integration with minimal permissions. Do not use admin or cloud accounts."

