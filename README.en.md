# Seminar Talk Timer / 研究会 講演タイマー

[日本語](README.md) | **English**

A talk timer for seminars. Launch it on a PC (Mac, Windows, or Linux), show the remaining time large on an iPad, and control it from the PC. No extra packages are needed (Node's standard library only), and it works offline without sending anything externally.

To try it on iPad right away, open the live page [https://yoshimasa-hidaka.github.io/seminar-timer/solo.html](https://yoshimasa-hidaka.github.io/seminar-timer/solo.html) in Safari (adding it to the Home Screen is covered in "iPad-only mode" below).

---

## Two modes

There are two ways to use it, depending on your needs.

| Mode | Setup | Network | When |
|---|---|---|---|
| ① Two-device | Launch on a PC (Mac, Windows, or Linux); display on iPad, control on the PC | PC and iPad on the same LAN | iPad faces the audience; you control from the PC |
| ② iPad-only | One iPad does both display and control | Not needed at run time; the iPad needs the network once, to install | Avoid the connection hassle; iPad is your only device |

② is installed on the iPad as a PWA (home-screen app). Open it once in Safari and "Add to Home Screen", and it then launches offline. On Android, Windows, or Mac browsers you can simply open the single file `seminar-timer-ipad.html`. In ②, control and display share one screen.

## Quick start (① two-device)

1. Start it: double-click `start.command` on a Mac or `start.cmd` on Windows, or run `start.sh` on Linux (on any OS, `node server.js` in a terminal also works).
2. The control screen opens in the PC's browser (if it doesn't, open the `http://localhost:8080/control` URL printed in the startup log). The iPad URL and a QR code appear at the top.
   - On Windows, a "Windows Security Alert" appears the first time. **Check both "Private networks" and "Public networks"** and click "Allow access". Venue Wi-Fi is usually classified as public, and with only one box checked the iPad cannot connect.
3. On the iPad, scan the QR (or type the URL) to open the display page. Tap the screen once to enable sound and go full screen.
4. Put the PC and iPad on the same Wi-Fi. If there's no venue Wi-Fi, use the PC's or the iPad's hotspot (see "Offline & networking" below).

To operate from another PC or phone as well, open the QR under "Control from another PC" in the control screen's details (or `http://<IP>:8080/control`). Any number of control screens stay in sync.

If the iPad cannot connect, try one of the other IPs listed under the QR on the control screen. PCs with virtual networks (WSL, Hyper-V, VirtualBox, VPNs, and so on) have several candidates; the server ranks them by likelihood, but it can guess wrong.

If port 8080 is in use, it falls back to 8081, and so on. The actual port is shown in the startup log and the control screen.

## iPad-only mode (② PWA)

Open the live page [https://yoshimasa-hidaka.github.io/seminar-timer/solo.html](https://yoshimasa-hidaka.github.io/seminar-timer/solo.html) in Safari on the iPad and choose "Add to Home Screen" from the Share menu. From then on, launch it from the Home Screen icon; it runs fully offline, even at a venue.

After it starts, tap the screen once to enable sound. Use the controls in the lower half — start/pause, manual bells (🔔1/🔔2/🔔3), presets, warnings, and so on. In a PC browser, the 🖥 button opens a display-only window: put it full screen on the projector and operate from the original window (no server needed; the two windows sync inside the browser, and sound comes from the control window). While running, the panel shrinks to the control row so the timer is as large as possible; the settings below are reached by scrolling. Settings such as durations, warnings, bell sound, and presets are saved on the iPad (localStorage) and restored next time.

## For first-time users (giving / receiving mode ①)

Mode ① (two-device) runs on Node.js on the PC (mode ②, the iPad PWA, needs no Node). Someone receiving ① only needs to check this once:

- All platforms: install Node.js. If it isn't installed, the start script shows a notice (and warns if the version is too old). Install the LTS version from [nodejs.org](https://nodejs.org/) and start again. To quit, press `Ctrl + C` in the black terminal window or close it.
- Mac:
  1. If macOS says "cannot verify the developer" (a protection on files received via download, email, or AirDrop), right-click `start.command`, choose **Open**, then click **Open** again in the dialog that appears (first time only).
  2. If double-clicking opens a text editor (the executable bit was lost when unzipping), run `chmod +x start.command` in a terminal, or use the right-click → Open above.
- Windows:
  1. Double-click `start.cmd`. If SmartScreen says "Windows protected your PC", click "More info" → "Run anyway" (first time only; this protection is attached to downloaded zips).
  2. In the Windows Firewall alert that follows, check both Private and Public and allow access (see step 2 of Quick start).
- Linux: run `bash start.sh` in a terminal (to launch from a file manager, `chmod +x start.sh` and choose "Run in Terminal").

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
- You can ring the manual bells 🔔1 / 🔔2 / 🔔3 anytime, from the control screen (① PC) and the iPad-only app (②).

### Bell sound (synthesized — no audio files)
- Choose from 11 timbres (each previews when selected): Desk bell (the timekeeper's call bell, the default), Timer (kitchen-timer beeps), Alarm (two-tone warble), School bell (Westminster chimes), Doorbell, Chime, Bell, Gong, Xylophone, Beep, and Buzzer. For 1, 2, and 3 bells, Desk bell / Timer / Alarm / Gong / Buzzer strike one, two, or three times, and School bell plays one, two, or three phrases.
- Adjust volume and pitch with sliders. Pitch moves in semitones from −12 to +12 (one octave down or up), shows the current value, and double-click (double-tap on iPad) resets it.
- The gap between strikes for 2 and 3 bells is adjustable too (0.5× to 3× the voice's natural spacing; the readout shows seconds for the selected voice, and releasing previews two bells).
- In ①, the iPad sound and the PC sound can be toggled independently (useful when the PC is connected to the room speakers; ② has a single sound on/off).

### Messages
- From the PC, flash a message such as "5 minutes left" large across the top of the iPad (quick phrases and free text).
- The message currently showing also appears on the control screen, so you don't forget to clear it.

### Control screen (PC)
- Apply a preset (e.g. 10+5 / 15+5 / 25+5 / 30+10 / 45+15) with one tap. In "Edit presets" under the details section you can type the talk, Q&A, warning 1, and warning 2 minutes directly, and add or delete rows.
- Time settings apply instantly (input fields and −/+ steppers).
- Keyboard: Space = start/pause, R = reset, Q = to Q&A, T = to Talk, ←/→ = ±10 s, ↑/↓ = ±1 min.
- To prevent mistakes, time settings and reset are disabled while running, and deleting a preset asks for confirmation.
- Switch between 日本語 / English (the control screen, iPad display, and messages all follow).

### iPad display
- It keeps the screen awake via the Screen Wake Lock API (iPadOS 16.4+). To be sure, set the device's Auto-Lock to "Never".
- Adding it to the Home Screen hides Safari's UI and runs full screen.

### Keeping the PC awake (①)
If the PC sleeps, the server freezes and the timer stops.
- Mac: `start.command` wraps the server in `caffeinate` (released automatically on exit).
- Linux: `start.sh` uses `systemd-inhibit` to block idle and sleep (systemd systems; whether the screen also stays on depends on the desktop environment).
- Windows: the start script cannot block sleep. Keeping the control screen open in Chrome or Edge keeps the display on (Wake Lock). To be sure, set Settings → System → Power → Sleep to "Never" while in use.

### Saved settings
- (Mode ①) Durations, warnings, bell sound/volume/pitch, iPad sound, presets, language, and display scope are saved to `config.json` and restored on restart (the running clock is not saved). `config.json` is per-device local state and is not committed to the repo.
- (Mode ②) The iPad app saves the same settings in the iPad's localStorage (also per-device, restored next time).

---

## Offline & networking (mode ①, PC ↔ iPad)

This section is about connecting the PC and iPad in mode ①. Mode ② (iPad-only) needs no network except the one-time install.

The app makes no external requests (no CDN, web fonts, or APIs; the QR is generated locally), so it works with no internet. All it needs is a local network path between the PC and the iPad.

If there's no usable venue Wi-Fi, make a closed two-device Wi-Fi with no internet:

- Option 1 (Mac): Make the Mac the hotspot (recommended)
  1. Open System Settings (Apple menu → System Settings…).
  2. In the sidebar, go to General → Sharing.
  3. Click the ⓘ button on the Internet Sharing row, and set "Share your connection to computers using" to Wi-Fi. Use "Wi-Fi Options…" to set a network name and password (WPA2), then click OK.
  4. Turn the Internet Sharing switch On (confirm with "Start").
  5. On the iPad, go to Settings → Wi-Fi and join the Mac's Wi-Fi you just created.
  - This works even with no internet connection (the server auto-detects the Mac's IP even when it lands on `bridge100`, and puts it in the URL/QR).
- Option 1 (Windows): Make the Windows PC the hotspot
  1. Open Settings → Network & internet → Mobile hotspot, check (or edit) the network name and password, and turn it on.
  2. On the iPad, go to Settings → Wi-Fi and join that network.
  - Windows may refuse to turn the hotspot on when the PC itself has no internet connection. In that case use Option 2 (iPad as hotspot).
  - The hotspot side gets the IP `192.168.137.1`. If the PC is also on the venue Wi-Fi, the control screen lists that IP first, so switch to `192.168.137.1` under the QR.
- Option 1 (Linux): Make the Linux PC the hotspot
  - On GNOME: Settings → Wi-Fi → menu in the top-right → "Turn On Wi-Fi Hotspot". Other desktops: use NetworkManager's hotspot feature (`nmcli device wifi hotspot` also works).
- Option 2: Make the iPad the hotspot (cellular iPads only; Wi-Fi-only models don't have this)
  1. On the iPad, open Settings → Personal Hotspot (or Settings → Cellular → Personal Hotspot).
  2. Turn "Allow Others to Join" on and note the Wi-Fi password shown.
  3. On the PC, pick the iPad from the Wi-Fi list.
- Even with venue Wi-Fi, AP isolation (which blocks device-to-device traffic) can prevent the connection. Use Option 1 or 2 in that case.
- On Windows, if the iPad cannot connect, check that Node.js is allowed through the firewall (Windows Security → Firewall & network protection → Allow an app through firewall → Node.js, both Private and Public).

Item names vary slightly by OS version (older macOS: System Preferences → Sharing → Internet Sharing). If you can't find it, type "Internet Sharing" or "Mobile hotspot" in the settings search box.

After opening the display page on the iPad, tap the screen once (this enables sound). If there's no sound, also check the device volume and mute (the bell icon in Control Center).

---

## Developer notes

The rest is for people who fork the repo to host their own copy or modify it (you don't need it just to use the app).

### Hosting it yourself (the iPad offline PWA)

Making the iPad PWA work offline requires HTTPS. Service workers only run over HTTPS (and localhost), so adding to the Home Screen from the PC server's plain HTTP (`http://<IP>:<port>/solo`) will not make it offline. GitHub Pages is an easy, free way to get HTTPS.

1. Push this repo to GitHub.
2. In Settings → Pages, set Source to "GitHub Actions" (the bundled `.github/workflows/pages.yml` deploys `public/`).
3. The first time, the Deploy may have run and failed before Pages was enabled; in that case re-run "Deploy PWA to GitHub Pages" from the Actions tab. After a few minutes `https://<user>.github.io/<repo>/` is live, and subsequent pushes update it automatically.

Note that on iPad you cannot open a local `.html` file directly (the Files app only previews it, with JavaScript, audio, and storage disabled). The single file `seminar-timer-ipad.html` is for Android, Windows, and Mac browsers that can run local HTML.

### Checking & building

- To check single-device mode locally, open `http://localhost:<port>/solo` (from an iPad, `http://<IP>:<port>/solo`) while the server runs. This path is not offline.
- Modes ① and ② share the same state machine (`public/timer-core.js`), so the timer, warnings, and auto-advance behave identically.
- The single file `seminar-timer-ipad.html` is generated from `public/solo.html`, `timer-core.js`, and `bell.js` via `node build-solo.js`. Icons can be regenerated with `node make-icons.js`.
- Tests: `node test/platform.test.js` (LAN IP ranking and parsing of the per-OS route commands), `node test/bell.test.js` (every voice's schedule and the sound allow-list), and `node test/server.smoke.js` (server start, pages, SSE, commands). The bundled `.github/workflows/test.yml` runs both on Linux, Windows, and macOS on every push.

### Layout

| File | Role |
|---|---|
| `server.js` | HTTP + SSE server (① two-device; manages state centrally; persists settings) |
| `platform.js` | The only OS-specific code (LAN IP detection, opening the default browser, per-OS startup notes). Mac / Windows / Linux differences stay here |
| `start.command` / `start.cmd` / `start.sh` | Double-click launchers (Mac / Windows / Linux). Check for Node; on Mac and Linux also block sleep |
| `test/` | Unit tests and the server smoke test (run on 3 OSes by `.github/workflows/test.yml`) |
| `public/timer-core.js` | The state machine (tick, commands, warnings, auto-advance). Shared by server.js and solo.html, so the logic is not duplicated |
| `public/control.html` | PC control screen (for ①) |
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
