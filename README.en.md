# Seminar Talk Timer / 研究会 講演タイマー

[日本語](README.md) | **English**

A talk timer for academic seminars. **Run it on a Mac, show the big countdown on an iPad, and control it from the Mac.**
Zero dependencies (Node.js standard library only) and **fully offline** — no `npm install`, no internet, nothing sent anywhere.

---

## Quick start

1. Double-click `start.command` in Finder (or run `node server.js` in a terminal).
2. **The control screen (on the Mac) opens in your browser automatically.** The iPad URL and a QR code appear at the top.
3. On the **iPad**, scan the QR (or type the URL) → open the display page → **tap once** to enable sound & go full screen.
4. Keep the Mac and iPad on the **same WiFi** (or use the Mac's Internet Sharing if there is no venue WiFi).

> If port 8080 is busy it automatically falls back to 8081, etc. (the port is shown in the startup log and the control screen).

## For first-time users (giving / receiving the app)

This app runs on **Node.js**. The recipient only needs to check this once:

> **Check your environment first**: double-click `check.command` to verify Node.js (presence/version) and that the files are complete — it does not start the server. If you see `[NG]`, see below.

1. **Install Node.js**: if it isn't installed, `start.command` shows a notice. Install the **LTS** version from [nodejs.org](https://nodejs.org/) and double-click again.
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
- **Color coding**: green (normal) → amber (within warning) → red + blink (overtime).
- **Manual bells**: ring 🔔1 / 🔔2 / 🔔3 anytime from the control screen.

### Bell sound (synthesized — no audio files)
- **Timbre**: Chime / Bell / Beep (previews when selected).
- **Volume** and **Pitch** sliders.
- **iPad sound and Mac sound can be toggled independently** (e.g. connect the Mac to the room speakers).

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
- Durations, warnings, bell sound/volume/pitch, iPad sound, presets, language, and display scope are **saved to `config.json` and restored on restart** (the running clock is not saved). `config.json` is per-device local state and is not committed to the repo.

---

## Offline & networking

The app makes **no external requests** (no CDN, no web fonts, no APIs; the QR is generated locally), so it **works with no internet**. All it needs is a local network path between the Mac and the iPad.

If there is no usable venue WiFi, make a closed two-device WiFi without any internet:

- **Option 1: Make the Mac the hotspot (recommended)** — System Settings → Internet Sharing → On, and connect the iPad to the Mac's WiFi. This works even with no internet connection (the server auto-detects the Mac's IP even when it lands on `bridge100`, and puts it in the URL/QR).
- **Option 2: Make the iPad the hotspot** — turn on the iPad's Personal Hotspot and connect the Mac to it.
- Even with venue WiFi, **AP isolation** (blocking device-to-device traffic) can prevent the connection. Switch to Option 1/2 in that case.

> On the iPad, **tap the display once** after opening it (sound is enabled by that tap). If there's no sound, also check the device volume / mute (the bell icon in Control Center).

---

## Layout

| File | Role |
|---|---|
| `server.js` | HTTP + SSE server (single source of truth, broadcasts state to all clients, persists settings) |
| `public/control.html` | Mac control screen |
| `public/display.html` | iPad display screen |
| `public/bell.js` | Bell-sound synthesis (WebAudio, shared by both screens) |
| `public/qr.js` | QR code generation (offline, no dependencies) |
| `start.command` | Double-click launcher for Finder |
| `check.command` | Environment check (Node presence, etc.; does not start the server) |
| `config.json` | Runtime-saved settings (gitignored, per device) |

No dependencies. Runs on Node.js (macOS). It also runs elsewhere via `node server.js` (the macOS-specific bits are only browser auto-open and IP auto-detection).

## License

MIT License (see `LICENSE`).
