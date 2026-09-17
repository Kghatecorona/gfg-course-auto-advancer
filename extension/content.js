// ==UserScript==
// @name         GFG Course Auto-Advancer (v4.0 - Clean Redesign)
// @namespace    https://geeksforgeeks.org/
// @version      4.0
// @description  Clean, lightweight GFG video automation: 2x speed, muted, auto-skips completed videos, plays uncompleted videos, runs in background/virtual desktops.
// @author       Kavyansh
// @match        https://*.geeksforgeeks.org/batch/*
// @match        https://geeksforgeeks.org/batch/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  if (window.__gfg_auto_v4_active) return;
  window.__gfg_auto_v4_active = true;

  // ----------------------------------------------------------------------
  // 1. BACKGROUND VISIBILITY & FOCUS SPOOFS
  // Prevents GFG from pausing playback or watch time tracking in background tabs
  // ----------------------------------------------------------------------
  try {
    Document.prototype.hasFocus = () => true;
    document.hasFocus = () => true;
  } catch (e) {}

  try {
    Object.defineProperty(Document.prototype, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
  } catch (e) {}

  try {
    Object.defineProperty(window, 'onblur', { get: () => null, set: () => {}, configurable: true });
    Object.defineProperty(document, 'onblur', { get: () => null, set: () => {}, configurable: true });
  } catch (e) {}

  try {
    const origAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === 'blur' || type === 'focusout') return;
      if (type === 'visibilitychange') {
        const wrapped = function (e) {
          if (document.hidden) return;
          return listener.apply(this, arguments);
        };
        return origAdd.call(this, type, wrapped, options);
      }
      return origAdd.call(this, type, listener, options);
    };
  } catch (e) {}

  // Request Wake Lock so computer screen doesn't turn off or sleep
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) await navigator.wakeLock.request('screen');
    } catch (e) {}
  }
  requestWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });

  // ----------------------------------------------------------------------
  // 2. CHECKMARK DETECTION (SOLID GREEN CIRCLE = COMPLETED)
  // ----------------------------------------------------------------------
  function isSolidDarkGreen(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return false;
    const s = colorStr.toLowerCase().trim();
    if (s === 'none' || s === 'transparent' || s.startsWith('rgba(0, 0, 0, 0)')) return false;

    if (s === '#2f8d46' || s === '#318e48' || s === '#308e47' || s === '#308d47' || s === '#28a745') return true;

    const rgb = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb) {
      const r = parseInt(rgb[1], 10);
      const g = parseInt(rgb[2], 10);
      const b = parseInt(rgb[3], 10);
      return r < 85 && g >= 115 && b < 105 && (g - r) >= 40 && (g - b) >= 40;
    }
    return false;
  }

  function isRowCompleted(rowElement) {
    if (!rowElement) return false;
    const nodes = [rowElement, ...Array.from(rowElement.querySelectorAll('svg, path, circle, i, span, div'))];
    for (const node of nodes) {
      try {
        const rect = node.getBoundingClientRect();
        if (rect.width >= 10 && rect.width <= 34 && rect.height >= 10 && rect.height <= 34) {
          const style = window.getComputedStyle(node);
          if (isSolidDarkGreen(style.backgroundColor) || isSolidDarkGreen(style.fill)) {
            return true;
          }
        }
      } catch (e) {}
      const fill = node.getAttribute?.('fill') || '';
      if (isSolidDarkGreen(fill)) return true;
    }
    return false;
  }

  function getSidebarVideoRows() {
    const all = Array.from(document.querySelectorAll('*'));
    const maxSidebarX = Math.max(380, window.innerWidth * 0.45);
    const durationNodes = all.filter(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.left > maxSidebarX) return false;
      const txt = (el.innerText || el.textContent || '').trim();
      return txt.startsWith('Duration:');
    });

    const rows = [];
    for (const dNode of durationNodes) {
      let row = dNode;
      while (row && row.parentElement && row.parentElement !== document.body) {
        const parent = row.parentElement;
        const count = Array.from(parent.querySelectorAll('*')).filter(e => (e.innerText || e.textContent || '').trim().startsWith('Duration:')).length;
        if (count > 1) break;
        row = parent;
      }
      if (row && !rows.includes(row)) {
        rows.push(row);
      }
    }
    return rows;
  }

  function isCurrentVideoAlreadyCompleted() {
    const mainTitle = (document.querySelector('h1, h2, div[class*="video-title"]') || {}).textContent?.trim().toLowerCase() || '';
    const rows = getSidebarVideoRows();
    for (const row of rows) {
      const rowText = (row.innerText || row.textContent || '').toLowerCase();
      const isCurrent = (mainTitle.length > 3 && rowText.includes(mainTitle)) ||
                        row.className?.includes?.('active') ||
                        row.className?.includes?.('selected');
      if (isCurrent) {
        return isRowCompleted(row);
      }
    }
    return false;
  }

  // ----------------------------------------------------------------------
  // 3. ADVANCEMENT ENGINE (NATIVE NEXT BUTTON + NEXT TRACK)
  // ----------------------------------------------------------------------
  let lastAdvanceTime = 0;

  function advanceToNext() {
    const now = Date.now();
    if (now - lastAdvanceTime < 2500) return; // 2.5s cooldown to prevent double-clicks
    lastAdvanceTime = now;

    updateHUD('Advancing to next video...', '#38bdf8');

    // Priority 1: Top-Right Next » button
    const allInteractive = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"], div, span'));
    const topNext = allInteractive.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      const isNext = txt === 'next' || txt === 'next »' || txt === 'next >>' || txt === 'next >' || txt === 'next ›';
      return isNext && r.top < 220 && r.left > 350;
    });

    if (topNext) {
      const btn = topNext.closest('button, a, [role="button"]') || topNext;
      console.log('[GFG Auto] Advancing via Next button:', btn);
      clickTarget(btn);
      return;
    }

    // Priority 2: Next Track button (if all videos in track are complete)
    const nextTrack = allInteractive.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return txt.includes('next') && txt.includes('track') && !txt.includes('prev');
    });

    if (nextTrack) {
      const btn = nextTrack.closest('button, a, [role="button"]') || nextTrack;
      console.log('[GFG Auto] Advancing to Next Track:', btn);
      clickTarget(btn);
      return;
    }

    // Priority 3: Fallback to next video link in sidebar
    const videoLinks = Array.from(document.querySelectorAll('a[href*="/video/"]'));
    if (videoLinks.length > 0) {
      const currIdx = videoLinks.findIndex(a => a.href === location.href || location.href.includes(a.getAttribute('href') || ''));
      if (currIdx !== -1 && currIdx + 1 < videoLinks.length) {
        console.log('[GFG Auto] Advancing via sidebar link:', videoLinks[currIdx + 1]);
        clickTarget(videoLinks[currIdx + 1]);
        return;
      }
    }

    updateHUD('Next item not found or playlist end.', '#f59e0b');
  }

  function clickTarget(el) {
    if (!el) return;
    const target = el.closest('button, a, [role="button"]') || el;
    const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    events.forEach(type => {
      try {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      } catch (e) {}
    });
    try { target.click(); } catch (e) {}

    // Safe direct URL navigation fallback if anchor present
    const anchor = target.tagName === 'A' ? target : (target.querySelector('a') || target.closest('a'));
    const destUrl = anchor?.href;
    if (destUrl && destUrl !== location.href && !destUrl.startsWith('javascript:')) {
      const initialUrl = location.href;
      setTimeout(() => {
        if (location.href === initialUrl && destUrl !== location.href) {
          window.location.href = destUrl;
        }
      }, 1500);
    }
  }

  // ----------------------------------------------------------------------
  // 4. FLOATING STATUS BADGE
  // ----------------------------------------------------------------------
  function updateHUD(message, color = '#22c55e') {
    let hud = document.getElementById('gfg-auto-hud-v4');
    if (!hud && document.body) {
      hud = document.createElement('div');
      hud.id = 'gfg-auto-hud-v4';
      hud.style.cssText = `
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 99999999;
        background: rgba(15, 23, 42, 0.94);
        color: #f8fafc;
        padding: 9px 15px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        border: 1px solid #38bdf8;
        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        gap: 8px;
        pointer-events: none;
      `;
      document.body.appendChild(hud);
    }
    if (hud) {
      hud.innerHTML = `
        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; display: inline-block;"></span>
        <span style="font-weight: 700; color: #38bdf8;">GFG Auto v4.0:</span>
        <span>${message}</span>
      `;
    }
  }

  // ----------------------------------------------------------------------
  // 5. CORE AUTOMATION ENGINE (RUNS EVERY SECOND)
  // ----------------------------------------------------------------------
  let currentUrl = location.href;
  let pageLoadCooldownUntil = 0;

  function tick() {
    // 1. Detect page URL change
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      pageLoadCooldownUntil = Date.now() + 1500; // Allow 1.5s for DOM & video to load
      updateHUD('Loading new page...', '#38bdf8');
      return;
    }

    // 2. Overview / Home Page Check
    if (!location.pathname.includes('/track/')) {
      updateHUD('🏠 Standby on course overview', '#0284c7');
      return;
    }

    // 3. Skip already completed video (Feature 3)
    if (Date.now() > pageLoadCooldownUntil) {
      if (isCurrentVideoAlreadyCompleted()) {
        updateHUD('✅ Already completed! Skipping to next...', '#22c55e');
        advanceToNext();
        return;
      }
    }

    // 4. Video Player Controller (Feature 2: Muted & 2.0x)
    const video = document.querySelector('video');
    if (!video) {
      const isQuizOrProblem = location.pathname.includes('/quiz/') || location.pathname.includes('/problem/');
      if (isQuizOrProblem) {
        updateHUD('Skipping Quiz / Problem...', '#eab308');
        advanceToNext();
      } else {
        updateHUD('Waiting for video...', '#94a3b8');
      }
      return;
    }

    // Enforce 2.0x playback rate
    if (video.playbackRate !== 2.0) {
      video.playbackRate = 2.0;
    }

    // Enforce mute
    if (!video.muted) {
      video.muted = true;
    }

    // Autoplay if paused
    if (video.paused && !video.ended) {
      video.play().catch(() => {});
    }

    // 5. Video End Detection
    if (video.ended || (video.duration > 5 && video.currentTime >= video.duration - 0.5)) {
      updateHUD('Video finished! Advancing...', '#22c55e');
      advanceToNext();
      return;
    }

    // Live progress display
    if (video.duration > 0 && !video.paused) {
      const curM = Math.floor(video.currentTime / 60);
      const curS = Math.floor(video.currentTime % 60).toString().padStart(2, '0');
      const durM = Math.floor(video.duration / 60);
      const durS = Math.floor(video.duration % 60).toString().padStart(2, '0');
      const rem = Math.max(0, Math.round((video.duration - video.currentTime) / 2.0));
      const remM = Math.floor(rem / 60);
      const remS = (rem % 60).toString().padStart(2, '0');
      updateHUD(`Playing (2.0x) [${curM}:${curS}/${durM}:${durS}] • ETA: ~${remM}m ${remS}s`, '#22c55e');
    }
  }

  // ----------------------------------------------------------------------
  // 6. MULTI-LAYER UNTHROTTLED HEARTBEATS (Feature 1: Background & Desktops)
  // ----------------------------------------------------------------------
  // 6.1 Listen to Background Service Worker message
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.action === 'HEARTBEAT') {
          tick();
        }
      });
    }
  } catch (e) {}

  // 6.2 Web Worker timer (unthrottled in background tabs)
  try {
    const blob = new Blob(["setInterval(() => postMessage('tick'), 1000);"], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => tick();
  } catch (e) {}

  // 6.3 Standard setInterval fallback
  setInterval(tick, 1000);

  console.log('%c[GFG Auto v4.0] Clean Automation Engine Active (2.0x, Muted, Auto-Next, Virtual Desktop)', 'color: #22c55e; font-size: 13px; font-weight: bold;');
})();
