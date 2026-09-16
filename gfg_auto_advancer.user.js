// ==UserScript==
// @name         GFG Course Auto-Advancer (Background Tab / Multi-Desktop Compatible)
// @namespace    https://geeksforgeeks.org/
// @version      2.0
// @description  Automates GFG batch course videos with 2x speed, background tab keep-alive, unthrottled Web Worker timers, and auto-next across Windows virtual desktops.
// @author       Kavyansh
// @match        https://*.geeksforgeeks.org/batch/*
// @match        https://geeksforgeeks.org/batch/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (window.__gfg_auto_advancer_active) {
    console.log('[GFG Auto] Script already active!');
    return;
  }
  window.__gfg_auto_advancer_active = true;

  let targetSpeed = 2.0;
  let isMuted = true;
  let isPaused = false;
  let completedCount = 0;
  let waitingForCredit = false;
  let creditDeadline = 0;
  let lastAdvanceTime = 0;
  let currentUrl = location.href;
  let attachedVideo = null;

  // ---------------------------------------------------------
  // 1. SCREEN WAKE LOCK & BACKGROUND AUDIO KEEP-ALIVE
  // Prevents Chrome and Windows from sleeping/suspending the tab
  // ---------------------------------------------------------
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        await navigator.wakeLock.request('screen');
      }
    } catch (e) {}
  }
  requestWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });



  // ---------------------------------------------------------
  // 2. FLOATING HUD UI
  // ---------------------------------------------------------
  const hud = document.createElement('div');
  hud.id = 'gfg-auto-hud';
  hud.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 99999999;
    background: rgba(15, 23, 42, 0.94);
    color: #f8fafc;
    padding: 14px 18px;
    border-radius: 12px;
    box-shadow: 0 12px 30px rgba(0,0,0,0.45);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    min-width: 275px;
    border: 1px solid #38bdf8;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
  `;

  hud.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 6px;">
      <span style="font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
        <span id="gfg-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
        GFG Auto-Advancer v2
      </span>
      <span id="gfg-badge-count" style="background: #1e293b; color: #38bdf8; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 600;">
        Done: 0
      </span>
    </div>
    
    <div id="gfg-status-msg" style="color: #cbd5e1; margin-bottom: 10px; font-size: 12px; min-height: 28px;">
      Initializing background controller...
    </div>
    
    <div style="display: flex; gap: 6px; align-items: center; justify-content: space-between;">
      <div style="display: flex; gap: 5px;">
        <button id="gfg-btn-spd" style="background: #0284c7; color: white; border: none; padding: 4px 9px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">2.0x</button>
        <button id="gfg-btn-vol" style="background: #334155; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 11px;">🔇 Muted</button>
      </div>
      <button id="gfg-btn-state" style="background: #22c55e; color: white; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">Running</button>
    </div>
  `;
  document.body.appendChild(hud);

  const statusMsg = document.getElementById('gfg-status-msg');
  const statusDot = document.getElementById('gfg-status-dot');
  const badgeCount = document.getElementById('gfg-badge-count');
  const btnSpd = document.getElementById('gfg-btn-spd');
  const btnVol = document.getElementById('gfg-btn-vol');
  const btnState = document.getElementById('gfg-btn-state');

  btnSpd.addEventListener('click', () => {
    targetSpeed = targetSpeed === 2.0 ? 1.5 : (targetSpeed === 1.5 ? 1.0 : 2.0);
    btnSpd.innerText = targetSpeed.toFixed(1) + 'x';
    const video = document.querySelector('video');
    if (video) video.playbackRate = targetSpeed;
  });

  btnVol.addEventListener('click', () => {
    isMuted = !isMuted;
    btnVol.innerText = isMuted ? '🔇 Muted' : '🔊 Sound';
    const video = document.querySelector('video');
    if (video) video.muted = isMuted;
  });

  btnState.addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) {
      btnState.innerText = 'Paused';
      btnState.style.background = '#ef4444';
      statusDot.style.background = '#ef4444';
      statusMsg.innerText = 'Automation paused by user.';
    } else {
      btnState.innerText = 'Running';
      btnState.style.background = '#22c55e';
      statusDot.style.background = '#22c55e';
      statusMsg.innerText = 'Resuming auto-player...';
    }
  });

  function setStatus(text, color = '#cbd5e1') {
    if (statusMsg) {
      statusMsg.innerText = text;
      statusMsg.style.color = color;
    }
  }

  // ---------------------------------------------------------
  // 3. TARGET FINDER FOR NEXT VIDEO / TRACK
  // ---------------------------------------------------------
  function findNextTarget() {
    const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));

    // Priority 1: Top-Right "Next »", "Next >>", "Next"
    const exactNext = candidates.find(el => {
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return (text === 'next' || text === 'next >>' || text === 'next »' || text === 'next >' || text === 'next ›');
    });
    if (exactNext) return exactNext;

    // Priority 2: "Next Track" button
    const nextTrack = candidates.find(el => {
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return text.includes('next') && text.includes('track') && !text.includes('prev');
    });
    if (nextTrack) return nextTrack;

    // Priority 3: Next video item in the left sidebar list
    const videoLinks = Array.from(document.querySelectorAll('a[href*="/video/"]'));
    if (videoLinks.length > 0) {
      const currIdx = videoLinks.findIndex(a => a.href === location.href || location.href.includes(a.getAttribute('href') || ''));
      if (currIdx !== -1 && currIdx + 1 < videoLinks.length) {
        return videoLinks[currIdx + 1];
      }
    }

    // Priority 4: Any element starting with 'next' (not prev)
    const genericNext = candidates.find(el => {
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return text.startsWith('next') && !text.includes('prev');
    });
    if (genericNext) return genericNext;

    return null;
  }

  // ---------------------------------------------------------
  // 4. FORCED NAVIGATION (WORKS IN BACKGROUND TABS & VIRTUAL DESKTOPS)
  // ---------------------------------------------------------
  function advanceToNext() {
    const now = Date.now();
    if (now - lastAdvanceTime < 4000) return;
    lastAdvanceTime = now;

    setStatus('Advancing to next video...', '#38bdf8');
    const target = findNextTarget();

    if (target) {
      console.log('[GFG Auto] Advancing to target:', target);
      
      // Dispatch complete synthetic mouse event chain
      ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(evtType => {
        try {
          target.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window }));
        } catch (e) {}
      });
      try { target.click(); } catch (e) {}

      // If the element has an href (or child link), extract destination URL
      const destUrl = target.href || target.getAttribute('href') || target.querySelector('a')?.href;
      if (destUrl && !destUrl.startsWith('javascript:')) {
        const recordedUrl = location.href;
        // If React SPA navigation is deferred because tab is in background, force location change!
        setTimeout(() => {
          if (location.href === recordedUrl) {
            console.log('[GFG Auto] Background fallback navigation to:', destUrl);
            window.location.href = destUrl;
          }
        }, 1200);
      }

      completedCount++;
      if (badgeCount) badgeCount.innerText = `Done: ${completedCount}`;
      setStatus('Advancing... Loading new video.', '#22c55e');
      waitingForCredit = false;
    } else {
      setStatus('Could not locate Next button. Checking...', '#f59e0b');
    }
  }

  // ---------------------------------------------------------
  // 5. NATIVE VIDEO EVENT HOOKS
  // Direct listeners fire even when timers are throttled!
  // ---------------------------------------------------------
  function hookVideoEvents(video) {
    if (attachedVideo === video) return;
    attachedVideo = video;

    console.log('[GFG Auto] Hooked native events to new video element.');

    video.addEventListener('ended', () => {
      console.log('[GFG Auto] Native "ended" event received.');
      if (!waitingForCredit) {
        waitingForCredit = true;
        creditDeadline = Date.now() + 3500; // 3.5s wait for GFG completion heartbeat
        setStatus('Video ended! Recording credit (3s)...', '#f59e0b');
      }
    });

    video.addEventListener('pause', () => {
      if (!isPaused && !video.ended && video.currentTime < (video.duration - 1)) {
        video.muted = true;
        isMuted = true;
        video.play().catch(() => {});
      }
    });
  }

  // ---------------------------------------------------------
  // 6. MAIN CONTROLLER TICK
  // ---------------------------------------------------------
  function handleTick() {
    if (isPaused) return;

    // Detect URL changes (SPA navigation across videos)
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      waitingForCredit = false;
      attachedVideo = null;
      setStatus('New video loaded! Initializing...', '#38bdf8');
    }

    const video = document.querySelector('video');
    if (!video) {
      setStatus('Waiting for video player...', '#94a3b8');
      return;
    }

    hookVideoEvents(video);

    // If waiting for credit, check against absolute timestamp (immune to timer drift)
    if (waitingForCredit) {
      const remainingMs = creditDeadline - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setStatus(`Video finished! Credit countdown: ${remainingSec}s`, '#f59e0b');

      if (remainingMs <= 0) {
        waitingForCredit = false;
        advanceToNext();
      }
      return;
    }

    // Keep muted to guarantee Chrome allows background autoplay
    if (video.muted !== isMuted) {
      video.muted = isMuted;
    }

    // Maintain 2.0x playback rate
    if (video.playbackRate !== targetSpeed) {
      video.playbackRate = targetSpeed;
    }

    // Autoplay if paused
    if (video.paused && !video.ended) {
      video.play().catch(() => {
        video.muted = true;
        isMuted = true;
        if (btnVol) btnVol.innerText = '🔇 Muted';
        video.play().catch(() => {});
      });
      return;
    }

    // Video completion check (fallback if native ended event didn't trigger)
    const isAlmostEnded = video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.75);
    if (isAlmostEnded && !waitingForCredit) {
      waitingForCredit = true;
      creditDeadline = Date.now() + 3500;
      setStatus('Video ended! Recording credit (3s)...', '#f59e0b');
      return;
    }

    // Display real-time playback progress in HUD
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

  // ---------------------------------------------------------
  // 7. UNTHROTTLED WEB WORKER TIMER
  // Chrome throttles setInterval in background tabs to 1 min,
  // but Web Workers are NEVER throttled!
  // ---------------------------------------------------------
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
    console.log('[GFG Auto] Unthrottled Web Worker heartbeat active.');
  } catch (err) {
    // Fallback standard interval if workers are restricted
    console.warn('[GFG Auto] Worker creation fallback to window setInterval:', err);
    setInterval(handleTick, 1000);
  }

  // Standard interval backup
  setInterval(handleTick, 1000);

  console.log('%c[GFG Auto-Advancer v2] Background & Multi-Desktop Engine Ready!', 'color: #22c55e; font-size: 13px; font-weight: bold;');
})();
