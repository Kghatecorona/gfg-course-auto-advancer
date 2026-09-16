// ==UserScript==
// @name         GFG Course Auto-Advancer (v3.0 - Anti-Skip, Quiz-Bypass & Background UI Sync)
// @namespace    https://geeksforgeeks.org/
// @version      3.0
// @description  Automates GFG course tracks at 2x speed. Fixes video skipping, automatically skips quizzes to reach videos, and keeps background tab UI/progress synced across virtual desktops.
// @author       Kavyansh
// @match        https://*.geeksforgeeks.org/batch/*
// @match        https://geeksforgeeks.org/batch/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  if (window.__gfg_auto_advancer_v3_active) {
    console.log('[GFG Auto v3] Script already active!');
    return;
  }
  window.__gfg_auto_advancer_v3_active = true;

  // ----------------------------------------------------------------------
  // 1. BACKGROUND TAB UI SYNC: SPOOF VISIBILITY & UNTHROTTLE RAF
  // Fixes GFG sidebar video length, progress bar, and checkmarks in background
  // ----------------------------------------------------------------------
  function patchVisibility() {
    try {
      // Define on Document.prototype to cover main document and any frames
      Object.defineProperty(Document.prototype, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible', configurable: true });
      Object.defineProperty(Document.prototype, 'webkitHidden', { get: () => false, configurable: true });
      Object.defineProperty(Document.prototype, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
    } catch (e) {}

    try {
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    } catch (e) {}
  }
  patchVisibility();

  // Prevent GFG / React from pausing updates when window loses focus
  window.addEventListener('visibilitychange', (e) => {
    e.stopImmediatePropagation();
  }, true);
  document.addEventListener('visibilitychange', (e) => {
    e.stopImmediatePropagation();
  }, true);

  // Stop blur event from pausing GFG internal tracking timers
  window.addEventListener('blur', (e) => {
    e.stopImmediatePropagation();
  }, true);

  // Unfreeze requestAnimationFrame in background tabs (forces React to flush DOM updates)
  try {
    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function (callback) {
      let executed = false;
      const id = origRAF((timestamp) => {
        executed = true;
        callback(timestamp);
      });
      // Fallback timer: if Chrome background tab suppresses rAF, execute callback anyway
      setTimeout(() => {
        if (!executed) {
          callback(performance.now());
        }
      }, 40);
      return id;
    };
  } catch (e) {}

  // Request Screen Wake Lock so Windows doesn't sleep
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) await navigator.wakeLock.request('screen');
    } catch (e) {}
  }
  requestWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });

  // Periodically fire synthetic timeupdate & focus to ensure React re-renders sidebar
  setInterval(() => {
    try {
      const v = document.querySelector('video');
      if (v && !v.paused) {
        v.dispatchEvent(new Event('timeupdate'));
      }
      window.dispatchEvent(new Event('focus'));
    } catch (e) {}
  }, 2500);

  // ----------------------------------------------------------------------
  // 2. STATE CONTROLLER (ANTI-SKIP & QUIZ HANDLING)
  // ----------------------------------------------------------------------
  let targetSpeed = 2.0;
  let isMuted = true;
  let isPaused = false;
  let completedCount = 0;

  // Anti-skip state variables
  let isNavigating = false;
  let navigationCooldownUntil = 0;
  let activeVideoKey = '';
  let activeVideoPlayedSeconds = 0;
  let waitingForCredit = false;
  let creditDeadline = 0;
  let lastUrl = location.href;

  // Quiz / Non-video state variables
  let nonVideoPageTicks = 0;
  let isQuizSkipping = false;
  let quizSkipDeadline = 0;

  // ----------------------------------------------------------------------
  // 3. FLOATING HUD USER INTERFACE
  // ----------------------------------------------------------------------
  function createHUD() {
    if (document.getElementById('gfg-auto-hud')) return;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', createHUD, { once: true });
      return;
    }

    const hud = document.createElement('div');
    hud.id = 'gfg-auto-hud';
    hud.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999999;
      background: rgba(15, 23, 42, 0.95);
      color: #f8fafc;
      padding: 13px 17px;
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      min-width: 290px;
      border: 1px solid #38bdf8;
      backdrop-filter: blur(8px);
    `;

    hud.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 6px;">
        <span style="font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
          <span id="gfg-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
          GFG Auto-Advancer v3.0
        </span>
        <span id="gfg-badge-count" style="background: #1e293b; color: #38bdf8; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 600;">
          Done: 0
        </span>
      </div>
      
      <div id="gfg-status-msg" style="color: #cbd5e1; margin-bottom: 10px; font-size: 12px; min-height: 28px;">
        Initializing auto-player...
      </div>
      
      <div style="display: flex; gap: 5px; align-items: center; justify-content: space-between;">
        <div style="display: flex; gap: 4px;">
          <button id="gfg-btn-spd" style="background: #0284c7; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">2.0x</button>
          <button id="gfg-btn-vol" style="background: #334155; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 11px;">🔇 Muted</button>
          <button id="gfg-btn-skip" style="background: #eab308; color: #0f172a; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;" title="Skip current video or quiz immediately">⏩ Skip</button>
        </div>
        <button id="gfg-btn-state" style="background: #22c55e; color: white; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">Running</button>
      </div>
    `;
    document.body.appendChild(hud);

    document.getElementById('gfg-btn-spd').addEventListener('click', () => {
      targetSpeed = targetSpeed === 2.0 ? 1.0 : 2.0;
      document.getElementById('gfg-btn-spd').innerText = `${targetSpeed}x`;
      const v = document.querySelector('video');
      if (v) v.playbackRate = targetSpeed;
    });

    document.getElementById('gfg-btn-vol').addEventListener('click', () => {
      isMuted = !isMuted;
      document.getElementById('gfg-btn-vol').innerText = isMuted ? '🔇 Muted' : '🔊 Sound';
      const v = document.querySelector('video');
      if (v) v.muted = isMuted;
    });

    document.getElementById('gfg-btn-skip').addEventListener('click', () => {
      setStatus('Manual Skip triggered! Advancing...', '#eab308');
      waitingForCredit = false;
      isQuizSkipping = false;
      advanceToNext();
    });

    document.getElementById('gfg-btn-state').addEventListener('click', () => {
      isPaused = !isPaused;
      const btnState = document.getElementById('gfg-btn-state');
      const statusDot = document.getElementById('gfg-status-dot');
      if (isPaused) {
        btnState.innerText = 'Paused';
        btnState.style.background = '#ef4444';
        statusDot.style.background = '#ef4444';
        setStatus('Paused by user.', '#f87171');
      } else {
        btnState.innerText = 'Running';
        btnState.style.background = '#22c55e';
        statusDot.style.background = '#22c55e';
        setStatus('Resuming...', '#22c55e');
      }
    });
  }
  createHUD();

  function setStatus(text, color = '#cbd5e1') {
    const el = document.getElementById('gfg-status-msg');
    if (el) {
      el.innerText = text;
      el.style.color = color;
    }
  }

  // ----------------------------------------------------------------------
  // 4. NAVIGATION ENGINE (FINDS NEXT VIDEO OR SKIPS QUIZ)
  // ----------------------------------------------------------------------
  function findNextTarget() {
    // Strategy 1: Check sidebar for subsequent uncompleted VIDEO link
    const allSidebarLinks = Array.from(document.querySelectorAll('a[href*="/track/"]'));
    const currentPath = location.pathname;
    const currentLinkIndex = allSidebarLinks.findIndex(a => a.pathname === currentPath || a.href === location.href);

    if (currentLinkIndex !== -1) {
      // Look forward in the sidebar playlist for the next video link
      for (let i = currentLinkIndex + 1; i < allSidebarLinks.length; i++) {
        if (allSidebarLinks[i].href.includes('/video/')) {
          console.log('[GFG Auto v3] Found next video link in sidebar relative to current:', allSidebarLinks[i]);
          return allSidebarLinks[i];
        }
      }
    }

    // Strategy 2: Check all video links on the page for next or unwatched item
    const videoLinks = Array.from(document.querySelectorAll('a[href*="/video/"]'));
    if (videoLinks.length > 0) {
      const currIdx = videoLinks.findIndex(a => a.href === location.href || location.href.includes(a.getAttribute('href') || ''));
      if (currIdx !== -1 && currIdx + 1 < videoLinks.length) {
        console.log('[GFG Auto v3] Found next video in videoLinks list:', videoLinks[currIdx + 1]);
        return videoLinks[currIdx + 1];
      }

      // If on quiz/problem page: find first video link that is not marked done
      const unwatched = videoLinks.find(a => {
        const isDone = a.querySelector('svg, i, span')?.className?.includes?.('check') || 
                       a.classList.contains('completed') || 
                       a.textContent.includes('✔');
        return !isDone && a.href !== location.href;
      });
      if (unwatched) {
        console.log('[GFG Auto v3] Found unwatched video link in sidebar:', unwatched);
        return unwatched;
      }
    }

    // Strategy 3: Exact top-right "Next »", "Next >>", "Next"
    const all = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
    const exactNext = all.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return (text === 'next' || text === 'next >>' || text === 'next »' || text === 'next >' || text === 'next ›');
    });
    if (exactNext) return exactNext;

    // Strategy 4: "Next Track" button (advances to next section/module)
    const nextTrack = all.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return text.includes('next') && text.includes('track') && !text.includes('prev');
    });
    if (nextTrack) return nextTrack;

    // Strategy 5: Any generic button starting with "next" (not prev)
    const genericNext = all.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return text.startsWith('next') && !text.includes('prev');
    });
    if (genericNext) return genericNext;

    return null;
  }

  function advanceToNext() {
    const now = Date.now();
    if (now < navigationCooldownUntil) return;
    navigationCooldownUntil = now + 9000; // 9-second strict anti-skip cooldown

    isNavigating = true;
    activeVideoPlayedSeconds = 0;
    activeVideoKey = '';
    waitingForCredit = false;
    isQuizSkipping = false;

    setStatus('Advancing to next video/track...', '#38bdf8');
    const target = findNextTarget();

    if (target) {
      console.log('[GFG Auto v3] Advancing target:', target);
      
      // Dispatch complete synthetic mouse event chain
      ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(evtType => {
        try {
          target.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window }));
        } catch (e) {}
      });
      try { target.click(); } catch (e) {}

      // If it's a link, enforce navigation if React defers in background
      const destUrl = target.href || target.getAttribute('href') || target.querySelector('a')?.href;
      if (destUrl && !destUrl.startsWith('javascript:')) {
        const startUrl = location.href;
        setTimeout(() => {
          if (location.href === startUrl) {
            console.log('[GFG Auto v3] Background fallback navigation to:', destUrl);
            window.location.href = destUrl;
          }
        }, 1500);
      }

      completedCount++;
      const badgeCount = document.getElementById('gfg-badge-count');
      if (badgeCount) badgeCount.innerText = `Done: ${completedCount}`;
      setStatus('Advancing... Loading upcoming item.', '#22c55e');
    } else {
      setStatus('No Next item found. Checking playlist...', '#f59e0b');
    }
  }

  // ----------------------------------------------------------------------
  // 5. MAIN TICK CONTROLLER (RUNS EVERY 1 SECOND VIA WEB WORKER)
  // ----------------------------------------------------------------------
  function handleTick() {
    if (isPaused) return;

    // Detect SPA URL changes
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      isNavigating = false;
      waitingForCredit = false;
      isQuizSkipping = false;
      nonVideoPageTicks = 0;
      activeVideoPlayedSeconds = 0;
      activeVideoKey = '';
      setStatus('New page loaded. Initializing...', '#38bdf8');
      createHUD();
    }

    const video = document.querySelector('video');

    // -----------------------------------------------------------
    // CASE A: NO VIDEO PLAYER ON PAGE (QUIZ / ARTICLE / PROBLEM)
    // -----------------------------------------------------------
    if (!video) {
      nonVideoPageTicks++;

      const isQuizOrProblem = location.pathname.includes('/quiz/') || 
                              location.pathname.includes('/practice/') || 
                              location.pathname.includes('/problem/') || 
                              location.pathname.includes('/article/');

      // If on a quiz/problem page, or if no video player exists after 4 seconds
      if (isQuizOrProblem || nonVideoPageTicks >= 4) {
        if (!isQuizSkipping) {
          isQuizSkipping = true;
          quizSkipDeadline = Date.now() + 2500; // 2.5s auto-skip notice
          setStatus('📝 Quiz / Non-video page detected! Skipping in 2s...', '#eab308');
        } else {
          const remSec = Math.max(0, Math.ceil((quizSkipDeadline - Date.now()) / 1000));
          setStatus(`📝 Quiz detected! Skipping to next video in ${remSec}s...`, '#eab308');
          if (Date.now() >= quizSkipDeadline) {
            isQuizSkipping = false;
            advanceToNext();
          }
        }
      } else {
        setStatus('Waiting for video player...', '#94a3b8');
      }
      return;
    }

    // Reset non-video counter once video is found
    nonVideoPageTicks = 0;
    isQuizSkipping = false;

    // -----------------------------------------------------------
    // CASE B: VIDEO PLAYER EXISTS
    // -----------------------------------------------------------

    // Identify current video
    const currentVideoSrc = video.currentSrc || video.src || location.href;
    const currentVideoKey = location.href + '#' + currentVideoSrc;

    // If this is a newly loaded video
    if (activeVideoKey !== currentVideoKey) {
      // If video duration is loaded and video is near start
      if (video.duration > 5 && video.currentTime < 5) {
        activeVideoKey = currentVideoKey;
        activeVideoPlayedSeconds = 0;
        isNavigating = false;
        waitingForCredit = false;
        console.log('[GFG Auto v3] New video recognized. Duration:', video.duration);
      }
    }

    // If currently waiting for GFG server credit countdown
    if (waitingForCredit) {
      const remainingMs = creditDeadline - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setStatus(`Video finished! Waiting ${remainingSec}s for server credit...`, '#f59e0b');

      if (remainingMs <= 0) {
        waitingForCredit = false;
        advanceToNext();
      }
      return;
    }

    // While in navigation cooldown, do not trigger any completion checks!
    if (isNavigating || Date.now() < navigationCooldownUntil) {
      setStatus('Preparing video playback...', '#38bdf8');
      return;
    }

    // Enforce 2.0x playback speed
    if (video.playbackRate !== targetSpeed) {
      video.playbackRate = targetSpeed;
    }

    // Enforce mute state (enables reliable background autoplay)
    if (video.muted !== isMuted) {
      video.muted = isMuted;
    }

    // Autoplay if paused
    if (video.paused && !video.ended) {
      video.play().catch(() => {
        video.muted = true;
        isMuted = true;
        const btnVol = document.getElementById('gfg-btn-vol');
        if (btnVol) btnVol.innerText = '🔇 Muted';
        video.play().catch(() => {});
      });
      return;
    }

    // Track real watch time while playing
    if (!video.paused && video.duration > 5 && !video.ended) {
      activeVideoPlayedSeconds++;
    }

    // -----------------------------------------------------------
    // STRICT ANTI-SKIP COMPLETION CHECK
    // Must satisfy:
    // 1. Video duration must be valid (>5s)
    // 2. Video must have actually been played by this session (activeVideoPlayedSeconds >= 6,
    //    or activeVideoPlayedSeconds >= 2 if opening a video that was already near completion)
    // 3. Current time must be near the end (> duration - 1.0s) OR ended is true
    // 4. Video currentTime must be > 5s (never complete on newly loaded 0s videos)
    // -----------------------------------------------------------
    const hasSufficientWatchTime = (activeVideoPlayedSeconds >= 6) || 
      (video.duration > 5 && (video.duration - video.currentTime <= 3.0) && activeVideoPlayedSeconds >= 2);
    
    const isAtEnd = video.currentTime > 5 && hasSufficientWatchTime && 
      (video.ended || (video.duration > 5 && video.currentTime >= (video.duration - 1.0)));

    if (isAtEnd && !waitingForCredit) {
      waitingForCredit = true;
      creditDeadline = Date.now() + 4000; // 4-second credit heartbeat wait
      setStatus('Video ended! Recording credit (4s)...', '#f59e0b');
      return;
    }

    // Display Real-Time Playback Progress in HUD
    if (!video.paused && video.duration > 0) {
      const curM = Math.floor(video.currentTime / 60);
      const curS = Math.floor(video.currentTime % 60).toString().padStart(2, '0');
      const durM = Math.floor(video.duration / 60);
      const durS = Math.floor(video.duration % 60).toString().padStart(2, '0');
      const remSec = Math.max(0, Math.round((video.duration - video.currentTime) / targetSpeed));
      const remM = Math.floor(remSec / 60);
      const remS = (remSec % 60).toString().padStart(2, '0');
      setStatus(`Playing (${targetSpeed}x) • [${curM}:${curS} / ${durM}:${durS}] • ETA: ~${remM}m ${remS}s`, '#22c55e');
    }
  }

  // ----------------------------------------------------------------------
  // 6. UNTHROTTLED WEB WORKER HEARTBEAT (RUNS ON BACKGROUND VIRTUAL DESKTOPS)
  // ----------------------------------------------------------------------
  try {
    const workerScript = `
      setInterval(function() {
        postMessage('tick');
      }, 1000);
    `;
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = function () {
      handleTick();
    };
    console.log('[GFG Auto v3] Web Worker background heartbeat started.');
  } catch (err) {
    console.warn('[GFG Auto v3] Worker fallback to setInterval:', err);
    setInterval(handleTick, 1000);
  }

  setInterval(handleTick, 1000);

  console.log('%c[GFG Auto-Advancer v3] Anti-Skip + Quiz-Bypass + Background Sync Ready!', 'color: #22c55e; font-size: 13px; font-weight: bold;');
})();
