# Seminar Talk Timer / 研究会 講演タイマー

[日本語](README.md) | **English**

A talk timer for seminars. Launch it on a Mac, show the remaining time large on an iPad, and control it from the Mac. No extra packages are needed (Node's standard library only), and it works offline without sending anything externally.

To try it on iPad right away, open the live page [https://yoshimasa-hidaka.github.io/seminar-timer/solo.html](https://yoshimasa-hidaka.github.io/seminar-timer/solo.html) in Safari (adding it to the Home Screen is covered in "iPad-only mode" below).

---

## Two modes

There are two ways to use it, depending on your needs.

| Mode | Setup | Network | When |
|---|---|---|---|
| ① Two-device | Launch on the Mac; display on iPad, control on Mac | Mac and iPad on the same LAN | iPad faces the audience; you control from the Mac |
| ② iPad-only | One iPad does both display and control | Not needed at run time; the iPad needs the network once, to install | Avoid the connection hassle; iPad is your only device |

② is installed on the iPad as a PWA (home-screen app). Open it once in Safari and "Add to Home Screen", and it then launches offline. On Android, Windows, or Mac browsers you can simply open the single file `seminar-timer-ipad.html`. In ②, control and display share one screen.

## Quick start (① two-device)

1. Double-click `start.command` (or run `node server.js` in a terminal).
2. The control screen opens in the Mac's browser. The iPad URL and a QR code appear at the top.
3. On the iPad, scan the QR (or type the URL) to open the display page. Tap the screen once to enable sound and go full screen.
4. Put the Mac and iPad on the same Wi-Fi. If there's no venue Wi-Fi, use the Mac's Internet Sharing.

If port 8080 is in use, it falls back to 8081, and so on. The actual port is shown in the startup log and the control screen.

## iPad-only mode (② PWA)

Open the live page [https://yoshimasa-hidaka.github.io/seminar-timer/solo.html](https://yoshimasa-hidaka.github.io/seminar-timer/solo.html) in Safari on the iPad and choose "Add to Home Screen" from the Share menu. From then on, launch it from the Home Screen icon; it runs fully offline, even at a venue.

After it starts, tap the screen once to enable sound. Use the controls in the lower half — start/pause, manual bells (🔔1/🔔2/🔔3), presets, warnings, and so on. While running, the panel shrinks to the control row so the timer is as large as possible; the settings below are reached by scrolling. Settings such as durations, warnings, bell sound, and presets are saved on the iPad (localStorage) and restored next time.

## For first-time users (giving / receiving mode ①, the Mac app)

Mode ① (two-device) runs on Node.js on the Mac (mode ②, the iPad PWA, needs no Node). Someone receiving ① only needs to check this once:

1. Install Node.js. If it isn't installed, `start.command` shows a notice (and warns if the version is too old). Install the LTS version from [nodejs.org](https://nodejs.org/) and double-click again.
2. If macOS says "cannot verify the developer" (a protection on files received via download, email, or AirDrop), right-click `start.command`, choose **Open**, then click **Open** again in the dialog that appears (first time only).
3. If double-clicking opens a text editor (the executable bit was lost when unzipping), run `chmod +x start.command` in a terminal, or use the right-click → Open above.
4. To quit, press `Ctrl + C` in the black terminal window.

Zipping the whole folder is the easiest way to share it (macOS Archive Utility preserves the executable bit).

---

## Features

### Timer (two phases)
- Manage the talk and the Q&A separately (e.g. a 20-min talk + 10-min Q&A).
- When the talk time runs out it advances to Q&A automatically; if it ends early, move manually with "To Q&A".
- The iPad shows the current phase (Talk / Q&A) and a large remaining time.
- Press the big number to switch between the remaining time in the current phase and the total remaining (including Q&A) — synced between the iPad and the control screen.
- The projected end time is shown while running (e.g. "Ends ~ 14:35").

### Bells
- A warning bell can sound a few minutes before the talk ends. You can set two (warning 1 and warning 2, e.g. 5 min and 1 min before); warning 2 is off by default (0 disables it).
- Two bells at talk end, three bells at Q&A end (the whole session), after which a red blink shows overtime.
- The color goes green (normal) → amber → red + blink (overtime). It turns amber within the warning time during the talk, and in the last 60 seconds during Q&A (Q&A is color-only, no bell).
- You can ring the manual bells 🔔1 / 🔔2 / 🔔3 anytime, from the control screen (① Mac) and the iPad-only app (②).

### Bell sound (synthesized — no audio files)
- Choose from 11 timbres (each previews when selected): Desk bell (the timekeeper's call bell, the default), Timer (kitchen-timer beeps), Alarm (two-tone warble), School bell (Westminster chimes), Doorbell, Chime, Bell, Gong, Xylophone, Beep, and Buzzer. For 1, 2, and 3 bells, Desk bell / Timer / Alarm / Gong / Buzzer strike one, two, or three times, and School bell plays one, two, or three phrases.
- Adjust volume and pitch with sliders. Pitch moves in semitones from −12 to +12 (one octave down or up), shows the current value, and double-click (double-tap on iPad) resets it.
- In ①, the iPad sound and the Mac sound can be toggled independently (useful when the Mac is connected to the room speakers; ② has a single sound on/off).

### Messages
- From the Mac, flash a message such as "5 minutes left" large across the top of the iPad (quick phrases and free text).
- The message currently showing also appears on the control screen, so you don't forget to clear it.

### Control screen (Mac)
- Apply a preset (e.g. 10+5 / 15+5 / 25+5 / 30+10 / 45+15) with one tap. You can add, edit, and delete your own freely, and the warnings are remembered too.
- Time settings apply instantly (input fields and −/+ steppers).
- Keyboard: Space = start/pause, R = reset, Q = to Q&A, T = to Talk, ←/→ = ±10 s, ↑/↓ = ±1 min.
- To prevent mistakes, time settings and reset are disabled while running, and deleting a preset asks for confirmation.
- Switch between 日本語 / English (the control screen, iPad display, and messages all follow).

### iPad display
- It keeps the screen awake via the Screen Wake Lock API (iPadOS 16.4+). To be sure, set the device's Auto-Lock to "Never".
- Adding it to the Home Screen hides Safari's UI and runs full screen.

### Saved settings
- (Mode ①) Durations, warnings, bell sound/volume/pitch, iPad sound, presets, language, and display scope are saved to `config.json` and restored on restart (the running clock is not saved). `config.json` is per-device local state and is not committed to the repo.
- (Mode ②) The iPad app saves the same settings in the iPad's localStorage (also per-device, restored next time).

---

## Offline & networking (mode ①, Mac ↔ iPad)

This section is about connecting the Mac and iPad in mode ①. Mode ② (iPad-only) needs no network except the one-time install.

The app makes no external requests (no CDN, web fonts, or APIs; the QR is generated locally), so it works with no internet. All it needs is a local network path between the Mac and the iPad.

If there's no usable venue Wi-Fi, make a closed two-device Wi-Fi with no internet:

- Option 1: Make the Mac the hotspot (recommended)
  1. Open System Settings (Apple menu → System Settings…).
  2. In the sidebar, go to General → Sharing.
  3. Click the ⓘ button on the Internet Sharing row, and set "Share your connection to computers using" to Wi-Fi. Use "Wi-Fi Options…" to set a network name and password (WPA2), then click OK.
  4. Turn the Internet Sharing switch On (confirm with "Start").
  5. On the iPad, go to Settings → Wi-Fi and join the Mac's Wi-Fi you just created.
  - This works even with no internet connection (the server auto-detects the Mac's IP even when it lands on `bridge100`, and puts it in the URL/QR).
- Option 2: Make the iPad the hotspot (cellular iPads only; Wi-Fi-only models don't have this)
  1. On the iPad, open Settings → Personal Hotspot (or Settings → Cellular → Personal Hotspot).
  2. Turn "Allow Others to Join" on and note the Wi-Fi password shown.
  3. On the Mac, click the Wi-Fi icon in the menu bar (or System Settings → Wi-Fi) and pick the iPad.
- Even with venue Wi-Fi, AP isolation (which blocks device-to-device traffic) can prevent the connection. Use Option 1 or 2 in that case.

Item names vary slightly by macOS version (older macOS: System Preferences → Sharing → Internet Sharing). If you can't find it, type "Internet Sharing" in the settings search box.

After opening the display page on the iPad, tap the screen once (this enables sound). If there's no sound, also check the device volume and mute (the bell icon in Control Center).

---

## Developer notes

The rest is for people who fork the repo to host their own copy or modify it (you don't need it just to use the app).

### Hosting it yourself (the iPad offline PWA)

Making the iPad PWA work offline requires HTTPS. Service workers only run over HTTPS (and localhost), so adding to the Home Screen from the Mac server's plain HTTP (`http://<IP>:<port>/solo`) will not make it offline. GitHub Pages is an easy, free way to get HTTPS.

1. Push this repo to GitHub.
2. In Settings → Pages, set Source to "GitHub Actions" (the bundled `.github/workflows/pages.yml` deploys `public/`).
3. The first time, the Deploy may have run and failed before Pages was enabled; in that case re-run "Deploy PWA to GitHub Pages" from the Actions tab. After a few minutes `https://<user>.github.io/<repo>/` is live, and subsequent pushes update it automatically.

Note that on iPad you cannot open a local `.html` file directly (the Files app only previews it, with JavaScript, audio, and storage disabled). The single file `seminar-timer-ipad.html` is for Android, Windows, and Mac browsers that can run local HTML.

### Checking & building

- To check single-device mode locally, open `http://localhost:<port>/solo` (from an iPad, `http://<IP>:<port>/solo`) while the server runs. This path is not offline.
- Modes ① and ② share the same state machine (`public/timer-core.js`), so the timer, warnings, and auto-advance behave identically.
- The single file `seminar-timer-ipad.html` is generated from `public/solo.html`, `timer-core.js`, and `bell.js` via `node build-solo.js`. Icons can be regenerated with `node make-icons.js`.

### Layout

| File | Role |
|---|---|
| `server.js` | HTTP + SSE server (① two-device; manages state centrally; persists settings) |
| `public/timer-core.js` | The state machine (tick, commands, warnings, auto-advance). Shared by server.js and solo.html, so the logic is not duplicated |
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
| `make-icons.js` | Generates the PWA icon PNGs with no dependencies (`node make-icons.js`) |
| `seminar-timer-ipad.html` | Single-file build (generated; for Android/Win/Mac — iPad uses the PWA) |
| `.github/workflows/pages.yml` | CI that deploys `public/` to GitHub Pages (HTTPS) for ②'s offline mode |
| `start.command` | Double-click launcher for Finder (①) |
| `config.json` | Runtime-saved settings (① ; gitignored, per device) |

No extra packages. Runs on Node.js (macOS). It also runs on Linux and elsewhere via `node server.js` (the only macOS-specific bits are auto-opening the browser and auto-detecting the IP).

## License

MIT License (see `LICENSE`).
