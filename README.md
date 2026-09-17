# 🚀 GFG Course Auto-Advancer

[![Version](https://img.shields.io/badge/Version-v3.6_Released-success.svg?style=flat-square)](https://github.com/Kghatecorona/gfg-course-auto-advancer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-blue.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![JavaScript](https://img.shields.io/badge/Language-Vanilla_JS-F7DF1E.svg?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

A lightweight browser automation tool for **GeeksforGeeks Batch Course** video tracks. It locks playback to **2.0x speed**, autoplays subsequent videos, grants a credit buffer, skips already watched videos, problems, and quizzes, and advances videos continuously even in **background tabs, minimized windows, or other Windows virtual desktops**.

---

## ✨ What's New in v3.6

- 🎯 **Fixed Video Progression Stall (Native Next » Priority):** Eliminated the sidebar row click interceptor that failed to trigger React navigation and froze the HUD on `Video finished! Waiting 1s for server credit...`. Playback advancement now exclusively and reliably triggers GFG's official `Next »` button above the player.
- 🔊 **Audio-Clock Background Keep-Alive (Virtual Desktop Fix):** Integrated an inaudible Web Audio API `AudioContext` keep-alive stream driven by the OS hardware audio clock. This permanently exempts the tab from Chrome's background tab freezing, window occlusion discarding, and 1-minute timer throttling across Windows virtual desktops!
- 🟢 **Strict Solid Dark-Green Checkmark Detection:** Fixed false positives where unwatched lessons with green outline borders were misidentified as completed. It now strictly checks for filled solid green circle backgrounds (`#2f8d46` / `#308e47`).
- ⏭️ **Intelligent Next Track Transition:** Skips `Go to Problems »` and quizzes, seamlessly clicking `>> Next Track` to keep multi-track video playlists playing back-to-back.

---

## ✨ What's New in v3.5

- ⏭️ **Auto-Advance to Next Track (Skips Problems & Quizzes):** When all videos in a track reach 100% completion or when GFG prompts `Go to Problems »`, the extension automatically clicks the `>> Next Track` button at the bottom of the sidebar, skipping coding problems and quizzes to keep video playback uninterrupted across course modules.
- 🛑 **Cooldown Auto-Expiry Fix:** Eliminated permanent stalls on `Preparing video playback...` by replacing static state locks with strict 4-second timestamp cooldowns that auto-reset.
- 🔍 **Unticked Video Fast-Seek:** Scans sidebar video rows and immediately jumps to the first unwatched (unticked) video if playback hasn't started.
- 🛡️ **Quiz & Practice Auto-Bypass:** Safely detects `/quiz/`, `/problem/`, and `/practice/` pages and advances directly to the next track within 2 seconds.

---

## ✨ What's New in v3.4

- 🔄 **Fixed Infinite Page Reload Loop:** Resolved the issue where fallback navigation triggered `window.location.href = location.href`, causing the page to reload every 3 seconds. Fallbacks now strictly require `destUrl !== location.href`.
- ⏩ **Native GFG `Next »` Button Integration:** Directly triggers GeeksforGeeks' official `Next »` button above the video player, ensuring smooth SPA transitions through the track to reach unwatched videos like *Sieve of Eratosthenes*.
- ⏱️ **0:00 False End-Frame Elimination:** Added strict `currentTime > 5s` guard to prevent newly loaded videos at 0:00 from falsely triggering completion logic.
- 🟢 **Solid Dark-Green Checkmark Skip:** Automatically clicks `Next »` through previously watched videos until an uncompleted video is reached.
- 🏠 **Batch Home Scope:** Remains in `Standby` on overview pages.
- ⏩ **Manual Skip Control:** Instant `⏩ Skip` button in the floating HUD.

---

## ✨ Features

- ⚡ **Enforced 2.0x Speed:** Plays videos at 2.0x (the maximum officially verified speed allowed by GFG to count towards course completion).
- 🔄 **Smart Auto-Next:** Automatically detects when the current video finishes and advances to the next video or track in the playlist.
- ⏱️ **5-Second Credit Buffer:** Pauses for 5 seconds after video completion to guarantee GFG's backend heartbeat registers the green checkmark before navigating.
- 🔇 **Muted Background Autoplay:** Defaults to muted playback to bypass Chrome's background autoplay restrictions and prevent noisy audio while doing other work.
- 💤 **Screen Wake Lock:** Prevents your Windows laptop from sleeping or locking the screen during long video tracks.
- 🎛️ **Floating HUD Control:** Sleek on-screen control badge showing live ETA, videos completed count, and one-click toggles for speed, mute, and pause.

---

## ⚡ 1-Click Install (Fastest Method)

If someone has **Tampermonkey** or **Violentmonkey** installed, they can install this in **1 single click**:

[![Install Userscript](https://img.shields.io/badge/⚡_Install_Userscript-Click_Here-22c55e?style=for-the-badge&logo=tampermonkey&logoColor=white)](https://raw.githubusercontent.com/Kghatecorona/gfg-course-auto-advancer/main/gfg_auto_advancer.user.js)

*(Clicking the link above automatically triggers the Tampermonkey installer. Click "Install" and it's active immediately!)*

---

## 📥 Manual Installation Options

### Option 1: Chrome Extension (Recommended)
1. Clone or download this repository:
   ```bash
   git clone https://github.com/Kghatecorona/gfg-course-auto-advancer.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. In the top-right corner, enable **Developer mode**.
4. Click **Load unpacked** in the top-left corner.
5. Select the repository folder.
6. Open your GeeksforGeeks course video tab and refresh (`F5`).

---

### Option 2: Tampermonkey Userscript
If you prefer running via a Userscript manager (Tampermonkey, Violentmonkey):
1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension.
2. Create a new script in the Tampermonkey dashboard.
3. Copy and paste the contents of [`gfg_auto_advancer.user.js`](./gfg_auto_advancer.user.js).
4. Save (`Ctrl + S`).

---

### Option 3: Quick DevTools Console Run (Zero Install)
1. Open your GFG course video page in Chrome.
2. Press `F12` $\rightarrow$ switch to the **Console** tab.
3. Paste the contents of [`content.js`](./content.js) and press `Enter`.

---

## ⚙️ How It Works Under the Hood

GeeksforGeeks uses server-side watch verification. Scrubbing or skipping forward causes the backend to reject course credit because insufficient real-time elapsed. 

This automation works within the platform's constraints:
1. Keeps playback rate at **2.0x**, which is natively supported and credited.
2. Monitors `video.currentTime` against `video.duration`.
3. Enters a `WAITING_FOR_CREDIT` countdown state upon video end to allow the platform's heartbeat API call to complete.
4. Executes a multi-tier target search:
   - Primary: Top-right `Next »` button.
   - Secondary: Bottom-left `>> Next Track` button.
   - Tertiary: Next uncompleted item in the left sidebar playlist.

---

## 📜 Disclaimer

This project is an independent open-source tool created for educational efficiency and is not affiliated with, sponsored by, or endorsed by GeeksforGeeks.

---

## 📄 License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for more information.
