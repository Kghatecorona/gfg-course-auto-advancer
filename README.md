# GFG Course Auto-Advancer (v5.3.0)

A lightweight, robust Chrome Extension (Manifest V3) that automates GeeksforGeeks course videos at locked 2.0x speed muted, with accurate green tick detection, quiz/problem bypassing, and guaranteed background execution across virtual desktops.

## What's Changed in v5.3.0

1. **Removed All Speed Buttons & Locked to 2.0x**:
   - GeeksforGeeks' server-side tracking rejects playback speeds faster than 2.0x (e.g. 10x or 16x), preventing videos from earning the completion checkmark.
   - All speed buttons have been removed. The extension now enforces a strict, legitimate **2.0x** playback rate that is accepted and validated by GFG's backend.
2. **True Chromium Background-Video-Pause Bypass**:
   - Chromium browsers automatically suspend the video decoder for **muted** videos when running in background tabs or occluded virtual desktops to conserve GPU resources.
   - v5.3.0 keeps the `<video>` element unmuted at the DOM level while muting the tab directly at the browser level (`chrome.tabs.update`) and connecting a zero-gain Web Audio node.
   - To Chromium, the video appears actively audible, completely preventing Chromium from pausing the video decoder in the background!
3. **Streamlined Floating HUD**:
   - Displays live video progress, total duration, and exact remaining ETA at 2.0x.
   - Compact action buttons: **`⏭ Skip`** (manual advance) and **`↺ Replay 0:00`** (rewind).
   - Minimizable to a small pill or expandable.
4. **Resilient Background Navigation**:
   - Adds a direct URL navigation fallback so that advancing to the next lesson never stalls even if React synthetic events are deferred in background tabs.

## How to Reload in Chrome

1. Go to `chrome://extensions/`.
2. Click the **Reload** (circular arrow) icon on **GFG Course Auto-Advancer**.
3. Refresh your GeeksforGeeks course tab.
