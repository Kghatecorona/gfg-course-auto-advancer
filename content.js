// ==UserScript==
// @name         GFG Course Auto-Advancer (v4.1 - Precision Replay & Revisit Engine)
// @namespace    https://geeksforgeeks.org/
// @version      4.1
// @description  Automates GFG courses at 2x. Skips solid-green completed videos, replays glitched end-frame videos from 0:00, revisits uncompleted track videos, and runs across virtual desktops.
// @author       Kavyansh
// @match        https://*.geeksforgeeks.org/batch/*
// @match        https://geeksforgeeks.org/batch/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  if (window.__gfg_auto_v41_active) return;
  window.__gfg_auto_v41_active = true;

  console.log('%c[GFG Auto v4.1] Initializing Precision Replay & Revisit Engine...', 'color: #38bdf8; font-weight: bold;');

  // ----------------------------------------------------------------------
  // 1. BACKGROUND TRACKING & VIRTUAL DESKTOP SPOOFS
  // Prevents Chrome and GFG from pausing tracking when in background tab or other desktop
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
  // 2. CHECKMARK DETECTION: SOLID DARK GREEN (COMPLETED) VS HOLLOW (UNCOMPLETED)
  // Solid green checkmark: #2f8d46 / rgb(47, 141, 70) filled circle with white tick
  // Hollow checkmark: transparent/white circle, thin light-green outline rgb(129, 186, 143)
  // ----------------------------------------------------------------------
  function isSolidDarkGreen(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return false;
    const s = colorStr.toLowerCase().trim();
    if (s === 'none' || s === 'transparent' || s.startsWith('rgba(0, 0, 0, 0)') || s === 'rgb(255, 255, 255)' || s === '#ffffff' || s === '#fff') {
      return false;
    }

    if (s === '#2f8d46' || s === '#318e48' || s === '#308e47' || s === '#308d47' || s === '#28a745' || s === '#429757') {
      return true;
    }

    const rgb = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb) {
      const r = parseInt(rgb[1], 10);
      const g = parseInt(rgb[2], 10);
      const b = parseInt(rgb[3], 10);
      // Strict dark-green profile: r < 95, g >= 115, b < 105, g distinctly higher than r and b
      // Solid tick is (47, 141, 70). Hollow tick border is (129, 186, 143) which fails r < 95 and b < 105.
      return r < 95 && g >= 115 && b < 105 && (g - r) >= 35 && (g - b) >= 35;
    }
    return false;
  }

  function isRowSolidCompleted(rowElement) {
    if (!rowElement) return false;
    const rowRect = rowElement.getBoundingClientRect();
    const nodes = [rowElement, ...Array.from(rowElement.querySelectorAll('svg, path, circle, i, span, div'))];

    for (const node of nodes) {
      try {
        const rect = node.getBoundingClientRect();
        // The checkmark circle is on the right side of the row, approx 10-34px in size
        if (rect.width >= 10 && rect.width <= 34 && rect.height >= 10 && rect.height <= 34) {
          if (rowRect.width > 0 && rect.right < rowRect.left + rowRect.width * 0.5) {
            continue; // Ignore left-aligned elements like play icons or index badges
          }
          const style = window.getComputedStyle(node);
          // Only solid green background or SVG fill indicates genuine completed state
          if (isSolidDarkGreen(style.backgroundColor) || isSolidDarkGreen(style.fill)) {
            return true;
          }
          const fillAttr = node.getAttribute?.('fill') || '';
          if (isSolidDarkGreen(fillAttr)) {
            return true;
          }
        }
      } catch (e) {}
    }
    return false;
  }

  function getSidebarVideoRows() {
    const all = Array.from(document.querySelectorAll('*'));
    const maxSidebarX = Math.max(400, window.innerWidth * 0.48);
    const durationNodes = all.filter(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.left > maxSidebarX) return false;
      const txt = (el.innerText || el.textContent || '').trim();
      return txt.startsWith('Duration:') || /Duration:\s*\d+/i.test(txt);
    });

    const rows = [];
    for (const dNode of durationNodes) {
      let row = dNode;
      while (row && row.parentElement && row.parentElement !== document.body) {
        const parent = row.parentElement;
        const count = Array.from(parent.querySelectorAll('*')).filter(e => {
          const t = (e.innerText || e.textContent || '').trim();
          return t.startsWith('Duration:') || /Duration:\s*\d+/i.test(t);
        }).length;
        if (count > 1) break;
        row = parent;
      }
      if (row && !rows.includes(row)) {
        rows.push(row);
      }
    }
    return rows;
  }

  function isCurrentVideoRow(row) {
    if (!row) return false;

    // 1. URL / href match (most accurate)
    const currentPath = location.pathname.toLowerCase();
    const a = row.tagName === 'A' ? row : row.querySelector('a');
    if (a && a.getAttribute('href')) {
      const href = a.getAttribute('href').toLowerCase();
      if (href === currentPath || href === location.href.toLowerCase() || (currentPath.length > 5 && href.includes(currentPath))) {
        return true;
      }
      const vidMatch = location.pathname.match(/\/video\/([^\/]+)/i);
      if (vidMatch && href.includes(vidMatch[1].toLowerCase())) {
        return true;
      }
    }

    // 2. Class / attribute match
    const cls = (typeof row.className === 'string' ? row.className : (row.className?.baseVal || '')).toLowerCase();
    if (cls.includes('active') || cls.includes('selected')) return true;
    if (row.querySelector('.active, [aria-current="page"], [aria-selected="true"]')) return true;

    // 3. Title match
    const mainHeading = document.querySelector('h1, h2, div[class*="video-title"], div[class*="title"]');
    const mainTitle = (mainHeading ? mainHeading.textContent : '').trim().toLowerCase();
    if (mainTitle.length > 3) {
      const rowText = (row.innerText || row.textContent || '').toLowerCase();
      if (rowText.includes(mainTitle)) return true;
    }

    return false;
  }

  function isCurrentVideoAlreadyCompleted() {
    const rows = getSidebarVideoRows();
    for (const row of rows) {
      if (isCurrentVideoRow(row)) {
        return isRowSolidCompleted(row);
      }
    }
    return false;
  }

  function findFirstUncompletedVideoRow() {
    const rows = getSidebarVideoRows();
    for (const row of rows) {
      if (!isRowSolidCompleted(row)) {
        return row;
      }
    }
    return null;
  }

  // ----------------------------------------------------------------------
  // 3. REPLAY FROM BEGINNING (0:00) FOR GLITCHED END-FRAME VIDEOS
  // ----------------------------------------------------------------------
  function clickPlayerRestartButton() {
    // Check buttons with restart / replay labels or icons
    const buttons = Array.from(document.querySelectorAll('button, div[role="button"], span[role="button"], i, svg'));
    for (const el of buttons) {
      const btn = el.closest('button, div[role="button"], a') || el;
      const aria = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase();
      const cls = (btn.className?.baseVal || btn.className || '').toString().toLowerCase();
      if (aria.includes('replay') || aria.includes('restart') || aria.includes('rewind') || aria.includes('reset') ||
          cls.includes('replay') || cls.includes('restart') || cls.includes('reset') || cls.includes('vjs-play-control')) {
        try { btn.click(); return true; } catch (e) {}
      }
    }

    // Video Player control bar leftmost button (Reload icon ↺)
    const video = document.querySelector('video');
    if (video) {
      const playerContainer = video.closest('.video-js, [class*="player"], [class*="video"]') || video.parentElement;
      if (playerContainer) {
        const ctrlButtons = Array.from(playerContainer.querySelectorAll('button, [role="button"]')).filter(b => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.top > (video.getBoundingClientRect().top + 50);
        });
        if (ctrlButtons.length > 0) {
          try { ctrlButtons[0].click(); return true; } catch (e) {}
        }
      }
    }
    return false;
  }

  function resetScrubberToStart() {
    const video = document.querySelector('video');
    if (!video) return;
    const playerContainer = video.closest('.video-js, [class*="player"], [class*="video"]') || document.body;

    // Check input[type="range"]
    const range = playerContainer.querySelector('input[type="range"]');
    if (range) {
      try {
        range.value = 0;
        range.dispatchEvent(new Event('input', { bubbles: true }));
        range.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    }

    // Check custom progress bars / sliders
    const progressBars = Array.from(playerContainer.querySelectorAll('[class*="progress"], [class*="slider"], [role="slider"]'));
    for (const pb of progressBars) {
      const r = pb.getBoundingClientRect();
      if (r.width > 80 && r.height > 0) {
        const clickX = r.left + 5;
        const clickY = r.top + r.height / 2;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evt => {
          try {
            pb.dispatchEvent(new MouseEvent(evt, {
              bubbles: true,
              cancelable: true,
              clientX: clickX,
              clientY: clickY,
              view: window
            }));
          } catch (e) {}
        });
        break;
      }
    }
  }

  function replayVideoFromBeginning(video) {
    if (!video) return;
    console.log('[GFG Auto] Glitched end-frame video detected! Resetting to 0:00 to earn checkmark...');
    try { video.currentTime = 0; } catch (e) {}
    try {
      video.dispatchEvent(new Event('seeking'));
      video.dispatchEvent(new Event('seeked'));
      video.dispatchEvent(new Event('timeupdate'));
    } catch (e) {}

    resetScrubberToStart();
    clickPlayerRestartButton();

    video.muted = true;
    video.playbackRate = 2.0;
    video.play().catch(() => {});
  }

  // ----------------------------------------------------------------------
  // 4. NAVIGATION ENGINE (NEXT BUTTON, SIDEBAR REVISIT, NEXT TRACK)
  // ----------------------------------------------------------------------
  let lastAdvanceTime = 0;

  function advanceToNext() {
    const now = Date.now();
    if (now - lastAdvanceTime < 2500) return; // 2.5s cooldown to prevent double advancement
    lastAdvanceTime = now;

    updateHUD('Advancing to next video...', '#38bdf8');

    // 1. Revisit check: If an earlier video in the track has a hollow tick, revisit it!
    const uncompleted = findFirstUncompletedVideoRow();
    const allRows = getSidebarVideoRows();
    const currentIdx = allRows.findIndex(r => isCurrentVideoRow(r));

    if (uncompleted && currentIdx !== -1) {
      const uncompletedIdx = allRows.indexOf(uncompleted);
      if (uncompletedIdx < currentIdx) {
        console.log('[GFG Auto] Revisiting earlier uncompleted video in track:', uncompleted);
        updateHUD('↺ Revisiting uncompleted video...', '#38bdf8');
        navigateToRow(uncompleted);
        return;
      }
    }

    // 2. Normal progression: Click Top-Right Next » button
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

    // 3. Skip Problems & Quizzes -> Advance to Next Track
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

    // 4. Fallback: If an uncompleted row exists ahead, navigate directly to it
    if (uncompleted && !isCurrentVideoRow(uncompleted)) {
      console.log('[GFG Auto] Navigating to next uncompleted row:', uncompleted);
      navigateToRow(uncompleted);
      return;
    }

    updateHUD('End of track or next target not found.', '#f59e0b');
  }

  function navigateToRow(row) {
    if (!row) return false;
    const a = row.tagName === 'A' ? row : row.querySelector('a');
    if (a && a.href && !a.href.startsWith('javascript:')) {
      a.click();
      if (location.href !== a.href) {
        window.location.href = a.href;
      }
      return true;
    }

    const titleEl = Array.from(row.querySelectorAll('*')).find(el => {
      const txt = (el.innerText || el.textContent || '').trim();
      return txt.length > 3 && !txt.startsWith('Duration:') && !txt.includes('min');
    }) || row;

    const target = titleEl.closest('button, [role="button"]') || titleEl;
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(t => {
      try { target.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    });
    try { target.click(); } catch (e) {}
    try { row.click(); } catch (e) {}
    return true;
  }

  function clickTarget(el) {
    if (!el) return;
    const target = el.closest('button, a, [role="button"]') || el;
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      try {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      } catch (e) {}
    });
    try { target.click(); } catch (e) {}

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
  // 5. MINIMAL FLOATING STATUS BADGE
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
        <span style="font-weight: 700; color: #38bdf8;">GFG Auto v4.1:</span>
        <span>${message}</span>
      `;
    }
  }

  // ----------------------------------------------------------------------
  // 6. MAIN CONTROLLER LOOP
  // ----------------------------------------------------------------------
  let currentUrl = location.href;
  let pageLoadCooldownUntil = 0;
  let checkedVideoKey = '';
  let hasCheckedInitialEndFrame = false;

  function tick() {
    // 1. Detect URL changes
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      pageLoadCooldownUntil = Date.now() + 1500;
      checkedVideoKey = '';
      hasCheckedInitialEndFrame = false;
      updateHUD('Loading new video...', '#38bdf8');
      return;
    }

    // 2. Standby on batch overview
    if (!location.pathname.includes('/track/')) {
      updateHUD('🏠 Standby on course overview', '#0284c7');
      return;
    }

    // 3. Feature: If current video is ALREADY solid green completed, skip it!
    if (Date.now() > pageLoadCooldownUntil) {
      if (isCurrentVideoAlreadyCompleted()) {
        updateHUD('✅ Already completed! Skipping...', '#22c55e');
        advanceToNext();
        return;
      }
    }

    // 4. Video Player Management (Muted + 2.0x)
    const video = document.querySelector('video');
    if (!video) {
      const isQuizOrProblem = location.pathname.includes('/quiz/') || location.pathname.includes('/problem/');
      if (isQuizOrProblem) {
        updateHUD('Skipping Quiz / Problem -> Next Track...', '#eab308');
        advanceToNext();
      } else {
        updateHUD('Waiting for video...', '#94a3b8');
      }
      return;
    }

    // 5. Feature: Replay from 0:00 if an uncompleted video opened at the end frame!
    const videoKey = location.href + '#' + (video.currentSrc || video.src || '');
    if (checkedVideoKey !== videoKey) {
      checkedVideoKey = videoKey;
      hasCheckedInitialEndFrame = false;
    }

    if (!hasCheckedInitialEndFrame && video.duration > 5) {
      // If video opened at the end frame (currentTime near duration or ended), reset it to 0:00!
      if (video.currentTime >= video.duration - 3 || video.ended) {
        hasCheckedInitialEndFrame = true;
        updateHUD('↺ Glitched end-frame: Resetting to 0:00...', '#eab308');
        replayVideoFromBeginning(video);
        return;
      } else {
        hasCheckedInitialEndFrame = true; // Video started from beginning/normal
      }
    }

    // Enforce 2.0x playback rate
    if (video.playbackRate !== 2.0) {
      video.playbackRate = 2.0;
    }

    // Enforce muted
    if (!video.muted) {
      video.muted = true;
    }

    // Autoplay if paused
    if (video.paused && !video.ended) {
      video.play().catch(() => {});
    }

    // 6. Video End Detection (only after it has been properly played)
    const isFinished = video.ended || (video.duration > 5 && video.currentTime >= video.duration - 0.5);
    if (isFinished && hasCheckedInitialEndFrame) {
      updateHUD('Video complete! Finalizing checkmark & advancing...', '#22c55e');
      setTimeout(() => {
        advanceToNext();
      }, 1000);
      return;
    }

    // Live playback progress
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
  // 7. BACKGROUND UNTHROTTLED PULSE
  // ----------------------------------------------------------------------
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.action === 'HEARTBEAT') {
          tick();
        }
      });
    }
  } catch (e) {}

  try {
    const blob = new Blob(["setInterval(() => postMessage('tick'), 1000);"], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => tick();
  } catch (e) {}

  setInterval(tick, 1000);

  console.log('%c[GFG Auto v4.1] Precision Replay & Revisit Engine Active!', 'color: #22c55e; font-size: 13px; font-weight: bold;');
})();
