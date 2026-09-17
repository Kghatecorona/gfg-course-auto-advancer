# GFG Course Auto-Advancer (v5.0.0)

A lightweight, robust Chrome Extension (Manifest V3) that automates GeeksforGeeks course videos at 2.0x speed muted, accurately detects completed lessons, bypasses quizzes/problems, and works reliably in the background across virtual desktops.

## Key Features

1. **Bulletproof Green Tick Detection**:
   - Analyzes GeeksforGeeks official CDN SVG assets (`Group11(1)` vs `Group11`).
   - Verifies inline SVG attributes (`stroke="white"` and `<circle fill="#2F8D46">` vs hollow checkmarks).
   - Inspects internal React Fiber component properties (`isCompleted: true`).
2. **Instant Skip for Completed Videos**:
   - Skips videos that already possess a solid dark green completion checkmark.
3. **Smart Replay for Glitched End-Frames**:
   - If an uncompleted video opens stuck at the end frame (`-0:00`), it automatically rewinds to `0:00` and plays through at 2x muted to earn the completion checkmark.
4. **Quiz & Problem Bypass**:
   - Automatically detects non-video modules (quizzes, coding problems, contests, assignments) and bypasses them directly to the Next Track.
5. **Silent 2.0x Speed & Muted Playback**:
   - Automatically enforces `playbackRate = 2.0` and `muted = true` without injecting any buttons or HUD overlays into your interface.
6. **Virtual Desktop & Background Tab Keep-Alive**:
   - Uses Web Worker intervals, background service worker pulse alarms, and a Web Audio silent oscillator to ensure Chrome never freezes or throttles video playback when switching virtual desktops.

## Installation / Reloading

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. If previously installed, click **Remove** on the old GFG Auto-Advancer, or click the **Reload** (circular arrow) icon.
4. Click **Load unpacked** and select:
   `C:\Users\kavya\Desktop\Sem5\GFG_Auto_Player`
5. Navigate to any GeeksforGeeks course batch track and watch it run!
