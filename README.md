# 🚀 GFG Course Auto-Advancer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![JavaScript](https://img.shields.io/badge/Language-Vanilla_JS-F7DF1E.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

A lightweight browser automation tool for **GeeksforGeeks Batch Course** video tracks. It locks playback to **2.0x speed**, autoplays subsequent videos, grants a 5-second progress credit buffer, and automatically clicks the **Next Video / Track** button so you don't have to babysit the player.

---

## ✨ Features

- ⚡ **Enforced 2.0x Speed:** Plays videos at 2.0x (the maximum officially verified speed allowed by GFG to count towards course completion).
- 🔄 **Smart Auto-Next:** Automatically detects when the current video finishes and advances to the next video or track in the playlist.
- ⏱️ **5-Second Credit Buffer:** Pauses for 5 seconds after video completion to guarantee GFG's backend heartbeat registers the green checkmark before navigating.
- 🔇 **Muted Background Autoplay:** Defaults to muted playback to bypass Chrome's background autoplay restrictions and prevent noisy audio while doing other work.
- 💤 **Screen Wake Lock:** Prevents your Windows laptop from sleeping or locking the screen during long video tracks.
- 🎛️ **Floating HUD Control:** Sleek on-screen control badge showing live ETA, videos completed count, and one-click toggles for speed, mute, and pause.

---

## 📥 Installation

You can run this project in **two ways**:

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
