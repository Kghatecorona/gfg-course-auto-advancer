// ==UserScript==
// @name         GFG Course Auto-Advancer (v4.1.1 - Precision Replay & Revisit Engine)
// @namespace    https://geeksforgeeks.org/
// @version      4.1.1
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

  console.log('%c[GFG Auto v4.1.1] Initializing Precision Replay & Revisit Engine...', 'color: #38bdf8; font-weight: bold;');

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
      // Solid tick is (47, 141, 70). Hollow outline is (129, 186, 143) which fails r < 95 and b < 105.
      return r < 95 && g >= 115 && b < 105 && (g - r) >= 35 && (g - b) >= 35;
    }

    const hex = s.match(/#([0-9a-f]{6})/i);
    if (hex) {
      const r = parseInt(hex[1].substring(0, 2), 16);
      const g = parseInt(hex[1].substring(2, 4), 16);
      const b = parseInt(hex[1].substring(4, 6), 16);
      return r < 95 && g >= 115 && b < 105 && (g - r) >= 35 && (g - b) >= 35;
    }

    return false;
  }

  function isRowSolidCompleted(rowElement) {
    if (!rowElement) return false;
    const rowRect = rowElement.getBoundingClientRect();
    const nodes = [rowElement, ...Array.from(rowElement.querySelectorAll('svg, path, circle, rect, g, i, span, div'))];

    for (const node of nodes) {
      try {
        const rect = node.getBoundingClientRect();
        // Check elements around 8px to 38px
        if (rect.width >= 8 && rect.width <= 38 && rect.height >= 8 && rect.height <= 38) {
          // Checkmark circle is always on the right half of the row
          if (rowRect.width > 0 && rect.right < rowRect.left + rowRect.width * 0.5) {
            continue; // Skip left-aligned play icons or numbers
          }
          const style = window.getComputedStyle(node);
          if (isSolidDarkGreen(style.backgroundColor) || isSolidDarkGreen(style.fill)) {
            return true;
          }
          // If SVG circle/path uses fill=currentColor
          if (style.fill === 'currentColor' || node.tagName.toLowerCase() === 'circle') {
            if (isSolidDarkGreen(style.color)) return true;
          }
        }
      } catch (e) {}

      // Check fill attribute on SVGs/paths/circles
      const fillAttr = node.getAttribute?.('fill') || '';
      if (isSolidDarkGreen(fillAttr)) {
        try {
          const rect = node.getBoundingClientRect();
          if (rowRect.width > 0 && rect.right > 0 && rect.right < rowRect.left + rowRect.width * 0.5) {
            continue;
          }
        } catch (e) {}
        return true;
      }
    }
    return false;
  }

  function getSidebarVideoRows() {
    const all = Array.from(document.querySelectorAll('*'));
    const maxSidebarX = Math.max(400, window.innerWidth * 0.48);

    // 1. Find leaf nodes containing "Duration:" in sidebar
    const leafDurationNodes = all.filter(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.left > maxSidebarX) return false;
      const txt = (el.innerText || el.textContent || '').trim();
      if (!txt.includes('Duration:')) return false;
      // Must be a leaf node for "Duration:" (none of its children contain "Duration:")
      return !Array.from(el.children).some(child => 
        (child.innerText || child.textContent || '').includes('Duration:')
      );
    });

    const leafSet = new Set(leafDurationNodes);
    const rows = [];

    for (const leaf of leafDurationNodes) {
      let row = leaf;
      while (row && row.parentElement && row.parentElement !== document.body) {
        const parent = row.parentElement;
        // Count how many leaf duration nodes are descendants of parent
        const children = parent.querySelectorAll('*');
        let leafCount = 0;
        for (const c of children) {
          if (leafSet.has(c)) leafCount++;
        }
        // When parent contains more than 1 video leaf, row is the full video item card!
        if (leafCount > 1) break;
        row = parent;
      }
      if (row && !rows.includes(row)) {
        rows.push(row);
      }
    }

    // Fallback if leaf detection didn't find rows
    if (rows.length === 0) {
      const fallbackRows = Array.from(document.querySelectorAll('a[href*="/video/"], div[class*="video-item"], div[class*="track-item"]')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left < maxSidebarX;
      });
      return fallbackRows;
    }

    return rows;
  }

  function isCurrentVideoRow(row) {
    if (!row) return false;

    // 1. URL / href match (decoded & raw)
    const curPath = location.pathname.toLowerCase();
    const decCurPath = decodeURIComponent(curPath);
    const a = row.tagName === 'A' ? row : row.querySelector('a');
    if (a && a.getAttribute('href')) {
      const rawHref = (a.getAttribute('href') || '').toLowerCase();
      const decHref = decodeURIComponent(rawHref);
      if (rawHref.includes(curPath) || curPath.includes(rawHref) || 
          decHref.includes(decCurPath) || decCurPath.includes(decHref)) {
        return true;
      }
      const vidMatch = curPath.match(/\/video\/([^\/?#]+)/i);
      if (vidMatch && vidMatch[1]) {
        const vidId = vidMatch[1].toLowerCase();
        const decVidId = decodeURIComponent(vidId);
        if (rawHref.includes(vidId) || rawHref.includes(decVidId) || 
            decHref.includes(vidId) || decHref.includes(decVidId)) {
          return true;
        }
      }
    }

    // 2. Class / attribute match
    const cls = (typeof row.className === 'string' ? row.className : (row.className?.baseVal || '')).toLowerCase();
    if (cls.includes('active') || cls.includes('selected') || cls.includes('highlight')) return true;
    if (row.querySelector('.active, [aria-current="page"], [aria-selected="true"]')) return true;

    // 3. Title match (against heading above video player)
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, div[class*="title"], div[class*="header"]'));
    const video = document.querySelector('video');
    const vTop = video ? video.getBoundingClientRect().top : 500;
    for (const h of headings) {
      const hr = h.getBoundingClientRect();
      if (hr.width > 50 && hr.height > 15 && hr.bottom <= vTop + 30 && hr.left > 280) {
        const hText = (h.innerText || h.textContent || '').trim().toLowerCase();
        if (hText.length > 5 && !hText.includes('next') && !hText.includes('prev')) {
          const rowText = (row.innerText || row.textContent || '').toLowerCase();
          if (rowText.includes(hText)) return true;
        }
      }
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

    const range = playerContainer.querySelector('input[type="range"]');
    if (range) {
      try {
        range.value = 0;
        range.dispatchEvent(new Event('input', { bubbles: true }));
        range.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    }

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
    if (now - lastAdvanceTime < 2500) return; // 2.5s cooldown
    lastAdvanceTime = now;

    updateHUD('Advancing to next video...', '#38bdf8');

    const uncompleted = findFirstUncompletedVideoRow();
    const allRows = getSidebarVideoRows();
    const currentIdx = allRows.findIndex(r => isCurrentVideoRow(r));

    // 1. Revisit check: If an earlier video in the track has a hollow tick, revisit it!
    if (uncompleted && currentIdx !== -1) {
      const uncompletedIdx = allRows.indexOf(uncompleted);
      if (uncompletedIdx < currentIdx) {
        console.log('[GFG Auto] Revisiting earlier uncompleted video in track:', uncompleted);
        updateHUD('↺ Revisiting uncompleted video...', '#38bdf8');
        navigateToRow(uncompleted);
        return;
      }
    }

    // 2. Direct Jump: If an uncompleted video is ahead, navigate directly to it!
    if (uncompleted && !isCurrentVideoRow(uncompleted)) {
      console.log('[GFG Auto] Navigating directly to next uncompleted row:', uncompleted);
      updateHUD('⏭️ Jumping to uncompleted video...', '#38bdf8');
      navigateToRow(uncompleted);
      return;
    }

    // 3. Normal progression: Click Top-Right Next » button
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

    // 4. Skip Problems & Quizzes -> Advance to Next Track
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

    updateHUD('End of track or next target not found.', '#f59e0b');
  }

  function navigateToRow(row) {
    if (!row) return false;

    // Scroll into view first
    try {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}

    const a = row.tagName === 'A' ? row : row.querySelector('a');
    if (a && a.href && !a.href.startsWith('javascript:')) {
      const destUrl = a.href;
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(t => {
        try { a.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
      });
      try { a.click(); } catch (e) {}
      if (location.href !== destUrl) {
        setTimeout(() => {
          if (location.href !== destUrl) {
            window.location.href = destUrl;
          }
        }, 800);
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
      }, 1200);
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
      lastAdvanceTime = 0;
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

  console.log('%c[GFG Auto v4.1.1] Precision Replay & Revisit Engine Active!', 'color: #22c55e; font-size: 13px; font-weight: bold;');
})();
