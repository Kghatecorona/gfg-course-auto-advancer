# GFG Course Auto-Advancer (v5.4.0)

A lightweight, robust Chrome Extension (Manifest V3) that automates GeeksforGeeks course videos at locked 2.0x speed muted, with accurate green tick detection, quiz/problem bypassing, and guaranteed background execution across virtual desktops.

## What's Changed in v5.4.0

1. **Complete Background Tab & Virtual Desktop Hardening**:
   - **IntersectionObserver Patch**: Web browsers report `isIntersecting = false` when tabs are occluded on other virtual desktops, causing video players to pause. v5.4.0 patches `window.IntersectionObserver` so elements are always reported as 100% visible and intersecting.
   - **Comprehensive Event Suppression**: Intercepts and drops `freeze`, `pagehide`, `lostpointercapture`, `visibilitychange`, `blur`, and `focusout` events in the capturing phase so GFG's player never detects tab occlusion.
   - **requestAnimationFrame Fallback**: Emulates `rAF` with a 16ms timer in background tabs, preventing internal player rendering loops from halting.
   - **User Activation Spoofing**: Patches `navigator.userActivation` so Chrome treats the tab as having active user gestures.
   - **Tab Auto-Discard Protection**: Sets `autoDiscardable: false` via `chrome.tabs.update` so Chrome never freezes or discards the tab from RAM.
2. **Guaranteed Muted Autoplay**:
   - In accordance with Chromium's autoplay policy, `video.muted = true` is enforced so that `video.play()` is 100% guaranteed never to be rejected or blocked.
   - Tab is additionally muted at the browser level for complete silence.
3. **Immediate Non-Blocking Navigation**:
   - Eliminated delayed `setTimeout` navigations. When a video finishes, the extension immediately executes a direct URL transition (`window.location.href = destUrl`), advancing in background tabs without stalling.
4. **Clean Floating HUD (NO speed buttons)**:
   - Locked to legitimate **2.0x** playback verified by GFG's backend.
   - Live video status, duration, and remaining ETA.
   - Quick **`⏭ Skip`** and **`↺ Replay 0:00`** buttons.

## How to Install / Reload in Chrome

1. Open `chrome://extensions/` in Chrome.
2. Click the **Reload** (circular arrow) icon on **GFG Course Auto-Advancer**.
3. Refresh your GeeksforGeeks course batch tab!
