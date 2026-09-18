# GFG Course Auto-Advancer (v5.2.0)

A lightweight, robust Chrome Extension (Manifest V3) that automates GeeksforGeeks course videos at up to 10x speed muted, with a visible floating interactive HUD, accurate green tick detection, quiz/problem bypassing, and persistent background execution across virtual desktops.

## What's New in v5.2.0

1. **Visible, Draggable Floating HUD**:
   - Sleek dark glassmorphism interface in the bottom-right corner.
   - Shows live video title, current playback time, total duration, and exact remaining ETA calculated at your current speed.
   - Draggable across the screen so it never obstructs your view.
   - Can be minimized to a compact pill (`_` button) or expanded (`⤢` button).
2. **Dedicated `⚡ 10x` Speed Button**:
   - Quick speed buttons: `1x`, `2x`, `5x`, `⚡ 10x` (prominent), and `16x` (hardware max).
   - Speed is strictly locked: if GFG's player attempts to reset the speed, the extension immediately forces it back to your selected speed.
   - Speed choice persists across video navigation.
3. **Manual Action Controls**:
   - **`⏭ Skip`**: Instantly skips to the next uncompleted lesson in the course.
   - **`↺ Replay 0:00`**: Rewinds the current video to the beginning and restarts playback.
4. **Dual-World Background Persistence**:
   - Injected in the `MAIN` world to spoof page visibility for GFG's React scripts.
   - Connected via an unthrottled 1-second background service worker port so playback and advancement never halt in other virtual desktops.

## How to Install / Reload in Chrome

1. Open Google Chrome and go to `chrome://extensions/`.
2. Ensure **Developer mode** is enabled in the top right.
3. Click the **Reload** (circular arrow) icon on **GFG Course Auto-Advancer** (or click **Load unpacked** and select `C:\Users\kavya\Desktop\Sem5\GFG_Auto_Player`).
4. Refresh your GeeksforGeeks course batch tab!
