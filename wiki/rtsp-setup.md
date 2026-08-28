# Enable the RTSP(S) Stream for a Camera or Doorbell

This guide explains how to share the video stream of a UniFi Protect camera or doorbell, so the **UniFi Protect & Access Homey integration** can show live video.

> ℹ️ **Adding the device already works without this.** Motion, smart detection, doorbell ring events and all flow cards keep working. Only the live video and the video tile in Homey need the stream.

---

## Table of Contents
1. [Why RTSP is needed](#1-why-rtsp-is-needed)
2. [UniFi Protect — Share Livestream (v2 / API key)](#2-unifi-protect--share-livestream-v2--api-key)
3. [UniFi Protect — RTSP channel (v1 / local user)](#3-unifi-protect--rtsp-channel-v1--local-user)
4. [Package camera (doorbells)](#4-package-camera-doorbells)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Why RTSP is needed

Homey does not pull video through the UniFi Protect app — it opens the camera's own stream directly. UniFi Protect keeps that stream **off** until you share it per camera:

- **v2 / Integration API key** → the stream is shared as **RTSPS** (encrypted).
- **v1 / local user** → the stream is shared as **RTSP** per channel (High / Medium / Low).

If nothing is shared, the app shows the warning *"No RTSP URL available for this camera"* and the video tile stays empty.

---

## 2. UniFi Protect — Share Livestream (v2 / API key)

Use this when you connected the Homey app with a **UniFi Protect V2 API Key**.

### Steps

1. Open `https://<YOUR_NVR_IP>` and log in
2. Click **UniFi Protect** in the sidebar
3. Go to **Devices** and click the camera or doorbell
4. Open **Settings** → **Advanced**
5. Find **Share Livestream** and enable **Enable Secure RTSPS Output**
6. Enable at least the **High** quality — the Homey app prefers High, and falls back to Medium/Low
7. Repeat for every camera and doorbell you want to watch in Homey

> 💡 Homey never enables sharing for you. The app only *reads* the stream state while pairing, so nothing is shared behind your back.

---

## 3. UniFi Protect — RTSP channel (v1 / local user)

Use this when you connected the Homey app with a **local username and password**.

### Steps

1. Open `https://<YOUR_NVR_IP>` and log in
2. Click **UniFi Protect** → **Devices** → your camera or doorbell
3. Open **Settings** → **Advanced** → **RTSP**
4. Enable the **High** channel (Medium and Low are optional)
5. Repeat for every camera and doorbell

The app then builds the URL itself as `rtsp://<NVR_IP>:<RTSP_PORT>/<alias>` — you do not have to copy anything.

---

## 4. Package Camera (doorbells)

Doorbells with a package camera (e.g. G4 Doorbell Pro) have a **second** stream, listed as **Package Camera**. It has its own switch:

- **v2**: enable the **Package** quality under **Share Livestream**
- **v1**: enable RTSP on the **Package Camera** channel

Without it, the main video works but the package camera tile in Homey stays empty.

---

## 5. Troubleshooting

| Problem | Solution |
|---------|---------|
| Warning stays after enabling | Restart the device in Homey (Device → ⋯ → Restart) or restart the app — the URL is fetched when the device starts. |
| Warning during pairing, but stream is on | The check is skipped when the console cannot be reached. Check the **Status** tab in the app settings. |
| Video tile empty, no warning | A custom **RTSP URL** may be filled in under device settings. Clear it to let the app detect the stream itself. |
| Only the package camera fails | Enable the Package Camera stream separately, see step 4. |
| Stream stutters | Lower the shared quality in UniFi Protect, or share only the **High** channel to reduce load on the console. |

---

## Related

- [Setup Guide — Create a Local User and API Key](setup-guide.md)
