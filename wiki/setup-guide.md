# Setup Guide — Create a Local User and API Key

This guide explains how to set up a dedicated local user and API key for the **UniFi Protect & Access Homey integration**.

> ✅ **Recommended**: Always use a dedicated local account/integration — never use your admin account or cloud credentials.

---

## Table of Contents
1. [UniFi Protect — Create a Local User (v1 / Legacy)](#1-unifi-protect--create-a-local-user-v1--legacy)
2. [UniFi Protect — Create an Integration API Key (v2)](#2-unifi-protect--create-an-integration-api-key-v2)
3. [UniFi Access — Create an Integration API Key](#3-unifi-access--create-an-integration-api-key)
4. [Enter credentials in Homey](#4-enter-credentials-in-homey)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. UniFi Protect — Create a Local User (v1 / Legacy)

The v1 (cookie-based) connection uses a local UniFi OS user. This is needed for full device support (cameras, lights, sensors, siren, doorbell, NVR alarm).

### Steps

1. Open your browser and go to `https://<YOUR_NVR_IP>` (e.g. `https://192.168.1.1`)
2. Log in with your **admin** account
3. Go to **UniFi OS** → **Users** → **Admins**
4. Click **Add Admin**
5. Fill in:
   - **Username**: e.g. `homey-integration`
   - **Password**: choose a strong password
   - **Role**: `Limited Admin` or `Read-Only` — the minimum role needed
   - **Access**: Make sure **UniFi Protect** is enabled
6. Click **Add**
7. Note down the username and password — you will enter these in the Homey app Settings

> ⚠️ **Do not use your personal admin account.** A dedicated limited user limits the blast radius if credentials are ever compromised.

---

## 2. UniFi Protect — Create an Integration API Key (v2)

The v2 API key gives access to the modern REST API and WebSocket event stream. This is recommended for new features and real-time updates.

### Steps

1. Open `https://<YOUR_NVR_IP>` and log in
2. Click **UniFi Protect** in the sidebar
3. Go to **Settings** (gear icon, bottom left)
4. Click **Integrations** → **Local Access**
5. Click **Add New Integration**
6. Give it a name, e.g. `Homey`
7. Click **Create**
8. **Copy the API key** — it is shown only once! Store it safely.
9. Paste the key in the Homey app Settings → **UniFi Protect V2 API Key**

> 💡 If you lose the key, you can delete the integration and create a new one. The Homey app will reconnect automatically when you save the new key.

---

## 3. UniFi Access — Create an Integration API Key

Only needed if you use **UniFi Access** devices (doors, readers, hubs).

### Steps

1. Open `https://<YOUR_NVR_IP>` and log in
2. Click **UniFi Access** in the sidebar
3. Go to **Settings** (gear icon) → **Integrations** → **Local Access**
4. Click **Add New Integration**
5. Give it a name, e.g. `Homey`
6. Click **Create**
7. **Copy the API key** — it is shown only once!
8. Paste the key in the Homey app Settings → **API Key** (Access tab)

---

## 4. Enter Credentials in Homey

1. Open the **Homey app** on your phone or at [my.homey.app](https://my.homey.app)
2. Go to **Apps** → **UniFi Protect** → **Settings**
3. Fill in the **UniFi Protect** tab:
   - **IP address**: your NVR IP (e.g. `192.168.1.1`)
   - **Port**: `443` (default, do not change unless needed)
   - **Username** / **Password**: the local user you created in step 1
   - **UniFi Protect V2 API Key**: the key from step 2
4. If you use UniFi Access, fill in the **UniFi Access** tab:
   - **API Key**: the key from step 3
5. Click **Save**
6. The app will connect automatically. Check the **Status** tab to verify.

---

## 5. Troubleshooting

| Problem | Solution |
|---------|---------|
| "Credentials are invalid" | Check username/password for the local user. Not a cloud account — must be a local UniFi OS account. |
| WebSocket not connected | Verify the v2 API key is correct. Check Status tab in app settings. |
| Devices not appearing | Make sure the local user has **UniFi Protect** access enabled in UniFi OS. |
| NVR Alarm Manager not updating | The alarm state uses the v1 connection — make sure username/password are also saved, not just the API key. |
| "No permission" errors | The local user's role may be too restrictive. Try `Limited Admin` instead of `Read-Only`. |
| Self-signed certificate warning | This is normal — the app intentionally accepts self-signed certificates for local NVR connections. |

---

## Security Tips

- 🔑 Use a **dedicated** local user/integration — never your personal admin account
- 🔄 **Rotate keys** if you suspect compromise: delete the integration in UniFi Console, create a new one, update in Homey Settings
- 🚫 **Never share** your API key or username/password
- 📵 The API key and password are stored **securely inside Homey** — they are never logged or exposed

