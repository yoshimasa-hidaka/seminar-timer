# Seminar Talk Timer / 研究会 講演タイマー

[日本語](README.md) | **English**

A talk timer for academic seminars. **Run it on a Mac, show the big countdown on an iPad, and control it from the Mac.**
Zero dependencies (Node.js standard library only) and **fully offline** — no `npm install`, no internet, nothing sent anywhere.

---

## Two modes (pick by use case)

| Mode | Setup | Network | When |
|---|---|---|---|
| **① Two-device** | Launch on the Mac → display on iPad, control on Mac | Mac & iPad on the same LAN | iPad faces the audience; you control from the Mac |
| **② iPad-only** | One iPad does both display and control | Offline at run time — iPad needs the network **once, to install** | Avoid all connection hassle; iPad is the only device |

**② is the newly added mode.** On iPad, install it as a **PWA (home-screen app)** — open it once over HTTPS, "Add to Home Screen", then it runs offline. On Android / Windows / Mac you can just open the single file `seminar-timer-ipad.html`. The trade-off is that control and display share one screen. See "iPad-only mode" below.

## Quick start (① two-device)

1. Double-click `start.command` in Finder (or run `node server.js` in a terminal).
2. **The control screen (on the Mac) opens in your browser automatically.** The iPad URL and a QR code appear at the top.
3. On the **iPad**, scan the QR (or type the URL) → open the display page → **tap once** to enable sound & go full screen.
4. Keep the Mac and iPad on the **same WiFi** (or use the Mac's Internet Sharing if there is no venue WiFi).

> If port 8080 is busy it automatically falls back to 8081, etc. (the port is shown in the startup log and the control screen).

## iPad-only mode (② PWA, home-screen app)

On iPad, install it as a **PWA (a web app added to the Home Screen)**. **Open it once in Safari and add it; after that it launches fully offline from the Home Screen icon** (no Mac, no network at the venue).

> ⚠️ **Important: offline PWA requires HTTPS** (service workers only run over HTTPS or `localhost`).
> So **adding to the Home Screen from the Mac server's `http://<IP>:<port>/solo` does NOT make it offline** (over plain HTTP the iPad won't register the service worker, so launching the icon shows "couldn't connect to server"). **Install from HTTPS (GitHub Pages) below instead.**
> Also, **opening a local `.html` file directly does NOT work on iPad** (the Files app only previews it; JS/audio/storage disabled). The single-file `seminar-timer-ipad.html` is for **browsers that can run local HTML** (Android / Windows / Mac).

**Publish once (GitHub Pages)**

1. Push this repo to GitHub (the bundled `.github/workflows/pages.yml` deploys `public/` to Pages).
2. In GitHub, set **Settings → Pages → Source = "GitHub Actions"**. After a few minutes `https://<user>.github.io/<repo>/` is live.

**Install on the iPad (once, on normal internet)**

3. In **Safari** on the iPad, open **`https://<user>.github.io/<repo>/solo.html`** (opening the root `…/` redirects to solo).
4. Tap **Share → Add to Home Screen**. A green clock icon is added.
5. From then on, **launch from the Home Screen icon**. The service worker has cached the whole app, so it **runs fully offline** at a venue with no Mac and no network.

**Use it**: tap once to enable sound, then use the controls in the lower half (start/pause, manual bells 🔔1/🔔2/🔔3, presets, warnings, …). **While running the panel shrinks to the control row so the timer is largest** — the settings below are reached by scrolling. Settings (durations, warnings, bell sound, presets, …) are **saved on the iPad (localStorage)** and restored next time.

> To just preview it first, open **`http://<IP>:<port>/solo`** in Safari while the Mac server runs (works online; this path does not enable offline).
> **Both modes share the same state machine (`public/timer-core.js`)**, so the timer, warnings, and auto-advance behave identically.
> The single file `seminar-timer-ipad.html` is **auto-generated** from `public/solo.html` + `timer-core.js` + `bell.js` via `node build-solo.js`; icons are generated with `node make-icons.js`.

## For first-time users (giving / receiving mode ①, the Mac app)

**Mode ① (two-device) runs on Node.js on the Mac** (mode ② — the iPad PWA — needs no Node; see "iPad-only mode"). For ①, the recipient only needs to check this once:

1. **Install Node.js**: if it isn't installed, `start.command` shows a notice (and warns if the version is too old). Install the **LTS** version from [nodejs.org](https://nodejs.org/) and double-click again.
2. **If macOS says "cannot verify the developer"** (Gatekeeper quarantine on downloaded/emailed/AirDropped files):
   **right-click `start.command` → Open → Open** (first time only).
3. **If double-clicking opens a text editor** (the executable bit was lost when unzipping):
   run `chmod +x start.command` once, or use right-click → Open as above.
4. **To quit**: press `Ctrl + C` in the black terminal window.

> Zipping the whole folder is the easiest way to share it (macOS Archive Utility preserves the executable bit).

---

## Features

### Timer (two phases)
- Separate **Talk** and **Q&A** phases (e.g. 20-min talk + 10-min Q&A).
- **Auto-advances to Q&A** when the talk time runs out; or move early with "To Q&A".
- The iPad shows the current phase (Talk / Q&A) and a large remaining time.
- **Click the big number** to toggle between "remaining in this phase" and "total remaining (incl. Q&A)" — synced across iPad and control.
- **Projected end time** (e.g. "Ends ~ 14:35") shown while running.

### Bells
- **Warning bell** a few minutes before the talk ends — up to **two warnings** (e.g. 5 min and 1 min before). The 2nd warning is off by default (0 disables it).
- **2 bells** at talk end → Q&A. **3 bells** at Q&A end (whole session over) → then a red blinking overtime count.
- **Color coding**: green (normal) → amber → red + blink (overtime). Amber means **talk = within the warning time / Q&A = last 60 seconds** (Q&A is color-only, no bell).
- **Manual bells**: ring 🔔1 / 🔔2 / 🔔3 anytime from the control screen (①) and from the iPad-only app (②).

### Bell sound (synthesized — no audio files)
- **Timbre**: Chime / Bell / Beep (previews when selected).
- **Volume** and **Pitch** sliders.
- **iPad sound and Mac sound can be toggled independently** (mode ①; e.g. connect the Mac to the room speakers — mode ② has a single sound on/off).

### Messages
- Flash a message ("5 minutes left", etc.) **large across the top of the iPad** from the Mac (quick phrases + free text).
- The currently-shown message is also displayed on the control screen so you don't forget to clear it.

### Control screen (Mac)
- **Presets** (e.g. 10+5 / 15+5 / 25+5 / 30+10 / 45+15) apply with one tap. Fully **add / edit / delete** your own (warnings are remembered too).
- **Time settings apply instantly** (input fields and −/+ steppers).
- **Keyboard**: Space = start/pause, R = reset, Q = to Q&A, T = to Talk, ←/→ = ±10 s, ↑/↓ = ±1 min.
- **Mistake guards**: time settings and reset are disabled while running; deleting a preset asks for confirmation.
- **日本語 / English** switch (control screen, iPad display, and messages all follow).

### iPad display
- **Stay awake** via the Screen Wake Lock API (iPadOS 16.4+). For certainty, set the device's Auto-Lock to "Never".
- Add it to the Home Screen to hide Safari's UI and run full screen.

### Saved settings
- (**mode ①**) Durations, warnings, bell sound/volume/pitch, iPad sound, presets, language, and display scope are **saved to `config.json` and restored on restart** (the running clock is not saved). `config.json` is per-device local state and is not committed to the repo.
- (**mode ②**) The iPad app saves the same settings in the iPad's **localStorage** (also per-device; restored next time).

---

## Offline & networking (mode ①, Mac ↔ iPad)

> This section is about **connecting the Mac and iPad in mode ①**. Mode ② (iPad-only) needs no network except the one-time install.

The app makes **no external requests** (no CDN, no web fonts, no APIs; the QR is generated locally), so it **works with no internet**. All it needs is a local network path between the Mac and the iPad.

If there is no usable venue WiFi, make a closed two-device WiFi without any internet:

- **Option 1: Make the Mac the hotspot (recommended)**
  1. Open **System Settings** (Apple menu → System Settings…).
  2. In the sidebar, go to **General → Sharing**.
  3. Click the ⓘ (info) button on the **Internet Sharing** row. Set **"Share your connection to computers using" to Wi-Fi**, then use **Wi-Fi Options…** to set a network name and password (WPA2) and click OK.
  4. Turn the **Internet Sharing** switch **On** (confirm with "Start").
  5. On the **iPad: Settings → Wi-Fi**, pick the Mac's Wi-Fi network you just created.
  - This works even with no internet connection (the server auto-detects the Mac's IP even when it lands on `bridge100`, and puts it in the URL/QR).
- **Option 2: Make the iPad the hotspot** (**cellular iPads only** — Wi-Fi-only models don't have this)
  1. On the iPad: **Settings → Personal Hotspot** (or Settings → Cellular → Personal Hotspot).
  2. Turn **"Allow Others to Join" On**, and note the Wi-Fi password shown.
  3. On the Mac, click the **Wi-Fi icon in the menu bar** (or System Settings → Wi-Fi) and pick the iPad.
- Even with venue WiFi, **AP isolation** (blocking device-to-device traffic) can prevent the connection. Switch to Option 1/2 in that case.

> Item names vary slightly by macOS version (older macOS: System Preferences → Sharing → Internet Sharing). If you can't find it, type "Internet Sharing" in the settings search box.

> On the iPad, **tap the display once** after opening it (sound is enabled by that tap). If there's no sound, also check the device volume / mute (the bell icon in Control Center).

---

## Layout

| File | Role |
|---|---|
| `server.js` | HTTP + SSE server (① two-device; single source of truth; persists settings) |
| `public/timer-core.js` | **The state machine** (tick, commands, warnings, auto-advance). Shared by server.js and solo.html — no duplicated logic |
| `public/control.html` | Mac control screen (for ①) |
| `public/display.html` | iPad display screen (for ①) |
| `public/solo.html` | iPad-only mode (② display + control in one page; PWA) |
| `public/index.html` | Entry redirect for ② (opening the Pages root forwards to solo) |
| `public/manifest.webmanifest` | PWA manifest (Add to Home Screen, icon, full screen) |
| `public/sw.js` | Service worker (caches ② for offline launch) |
| `public/icon-512.png`, … | PWA / home-screen icons (generated by `make-icons.js`) |
| `public/bell.js` | Bell-sound synthesis (WebAudio, shared by all screens) |
| `public/qr.js` | QR code generation (offline, no dependencies) |
| `build-solo.js` | Builds the single-file bundle from solo.html + shared JS (`node build-solo.js`) |
| `make-icons.js` | Generates the PWA icon PNGs with zero dependencies (`node make-icons.js`) |
| `seminar-timer-ipad.html` | Single-file build (generated; for Android/Win/Mac — iPad uses the PWA) |
| `.github/workflows/pages.yml` | CI that deploys `public/` to GitHub Pages (HTTPS) for ②'s offline mode |
| `start.command` | Double-click launcher for Finder (①) |
| `config.json` | Runtime-saved settings (① ; gitignored, per device) |

No dependencies. Runs on Node.js (macOS). It also runs elsewhere via `node server.js` (the macOS-specific bits are only browser auto-open and IP auto-detection).

## License

MIT License (see `LICENSE`).
