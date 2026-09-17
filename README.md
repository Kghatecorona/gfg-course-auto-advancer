# 🚀 GFG Course Auto-Advancer

[![Version](https://img.shields.io/badge/Version-v4.0_Released-success.svg?style=flat-square)](https://github.com/Kghatecorona/gfg-course-auto-advancer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-blue.svg?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![JavaScript](https://img.shields.io/badge/Language-Vanilla_JS-F7DF1E.svg?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

A lean, purpose-built browser automation extension for **GeeksforGeeks Batch Course** video tracks. Built from the ground up to do exactly 4 things with zero bloat:

1. 💻 **Works in Background & Virtual Desktops:** Background Service Worker heartbeats and Web Worker timers keep the tab active without timer throttling or freezing when minimized or placed on another desktop.
2. ⚡ **Muted & 2.0x Speed:** Enforces 2.0x speed and muted autoplay so playback never pauses and doesn't make noise.
3. 🟢 **Skips Already Completed Videos:** Accurately identifies videos marked with a solid green checkmark in the sidebar and skips ahead to the next video immediately.
4. 🛡️ **Never Skips Uncompleted Videos:** Ensures every uncompleted video (or videos glitched/unmarked by GFG) is played completely from start to finish.

---

## ✨ Features (v4.0 Clean Redesign)

- 🔄 **Direct Native Next Navigation:** Prioritizes GFG's native `Next »` button above the player for reliable SPA page transitions.
- ⏭️ **Auto-Advance to Next Track:** Automatically advances to the next track when all videos in the current track are done or when prompted with `Go to Problems »`.
- 🎛️ **Minimal, Non-Intrusive HUD:** Clean status indicator that never blocks buttons or clicks.

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
