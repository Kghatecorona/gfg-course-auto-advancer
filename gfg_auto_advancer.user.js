// ==UserScript==
// @name         GFG Course Auto-Advancer (v4.2 - Multi-Vector Checkmark Detection Engine)
// @namespace    https://geeksforgeeks.org/
// @version      4.2
// @description  Automates GFG courses at 2x. Multi-vector green checkmark detection (DOM, SVG, ElementFromPoint, React Fiber), auto-replays glitched end-frame videos from 0:00, revisits uncompleted track videos, runs across virtual desktops.
// @author       Kavyansh
// @match        https://*.geeksforgeeks.org/batch/*
// @match        https://geeksforgeeks.org/batch/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  if (window.__gfg_auto_v42_active) return;
  window.__gfg_auto_v42_active = true;

  console.log('%c[GFG Auto v4.2] Multi-Vector Checkmark Detection Engine Active!', 'color: #22c55e; font-size: 13px; font-weight: bold;');

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
  // 2. MULTI-VECTOR CHECKMARK DETECTION ENGINE
  // ----------------------------------------------------------------------

  // Strict Dark Green Color Matcher
  function isDarkGreenColor(str) {
    if (!str || typeof str !== 'string') return false;
    const s = str.toLowerCase().trim();
    if (s === 'none' || s === 'transparent' || s.startsWith('rgba(0, 0, 0, 0)') || 
        s === '#fff' || s === '#ffffff' || s === 'rgb(255, 255, 255)') return false;

    // Exact known GFG green codes
    if (s === '#2f8d46' || s === '#318e48' || s === '#308e47' || s === '#308d47' || 
        s === '#28a745' || s === '#429757' || s === '#16a34a' || s === '#15803d') return true;

    // RGB parsing
    const rgb = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb) {
      const r = parseInt(rgb[1], 10);
      const g = parseInt(rgb[2], 10);
      const b = parseInt(rgb[3], 10);
      // Dark green: G must be dominant, R and B must be moderate
      // Solid tick is (47, 141, 70). Hollow tick outline is (129, 186, 143) which has high R & B
      return r < 95 && g >= 115 && b < 105 && (g - r) >= 30 && (g - b) >= 30;
    }

    // Hex parsing
    const hex = s.match(/#([0-9a-f]{6})/i);
    if (hex) {
      const r = parseInt(hex[1].substring(0, 2), 16);
      const g = parseInt(hex[1].substring(2, 4), 16);
      const b = parseInt(hex[1].substring(4, 6), 16);
      return r < 95 && g >= 115 && b < 105 && (g - r) >= 30 && (g - b) >= 30;
    }
    return false;
  }

  // Vector 1: DOM & SVG Visual Structure
  function isSolidTickInNode(container) {
    if (!container) return false;
    const all = [container, ...Array.from(container.querySelectorAll('*'))];

    for (const el of all) {
      // 1.1 Direct Computed Style Check (backgroundColor, fill)
      try {
        const style = window.getComputedStyle(el);
        if (isDarkGreenColor(style.backgroundColor) || isDarkGreenColor(style.fill)) {
          return true;
        }
        if (el.tagName.toLowerCase() === 'circle' && isDarkGreenColor(style.color)) {
          return true;
        }
      } catch (e) {}

      // 1.2 SVG Fill Attribute Check
      const fill = el.getAttribute?.('fill');
      if (fill && isDarkGreenColor(fill)) return true;

      // 1.3 SVG InnerHTML / OuterHTML Pattern Check
      if (el.tagName && el.tagName.toLowerCase() === 'svg') {
        const html = el.outerHTML.toLowerCase();
        const hasGreen = html.includes('#2f8d46') || html.includes('#308e47') || 
                         html.includes('rgb(47, 141, 70)') || html.includes('rgb(47,141,70)');
        const hasWhiteCheck = html.includes('#fff') || html.includes('#ffffff') || html.includes('white');
        if (hasGreen && hasWhiteCheck) {
          return true;
        }
      }

      // 1.4 Class / Attribute Check
      const cls = (typeof el.className === 'string' ? el.className : (el.className?.baseVal || '')).toLowerCase();
      if (cls.includes('is-completed') || cls.includes('video-completed') || cls.includes('track-completed')) {
        return true;
      }
      const aria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '').toLowerCase();
      if (aria.includes('completed') || aria.includes('complete')) {
        return true;
      }
    }
    return false;
  }

  // Vector 2: Coordinate-based Element Sampling (document.elementFromPoint)
  function isSolidTickAtCoordinates(rowElement) {
    if (!rowElement) return false;
    try {
      const rect = rowElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      // In GFG sidebar, the checkmark is located at the vertical center, ~22px from the right border
      const sampleX = rect.right - 22;
      const sampleY = rect.top + rect.height / 2;
      const target = document.elementFromPoint(sampleX, sampleY);
      if (target) {
        const box = target.closest('svg, [class*="icon"], [class*="tick"], [class*="check"], span, div') || target;
        if (isSolidTickInNode(box)) return true;

        const style = window.getComputedStyle(target);
        if (isDarkGreenColor(style.backgroundColor) || isDarkGreenColor(style.fill) || isDarkGreenColor(style.color)) {
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  // Vector 3: React Fiber & Props Inspection
  function isCompletedViaReact(domElement) {
    if (!domElement) return false;
    try {
      let curr = domElement;
      let depth = 0;
      while (curr && depth < 6) {
        const key = Object.keys(curr).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$') || k.startsWith('__reactProps$'));
        if (key) {
          let fiber = curr[key];
          let fDepth = 0;
          while (fiber && fDepth < 8) {
            const p = fiber.memoizedProps || fiber;
            if (p) {
              if (p.isCompleted === true || p.completed === true || p.is_completed === 1 || p.is_completed === true) return true;
              if (p.status === 'completed' || p.status === 'COMPLETED' || p.status === 1) return true;
              if (p.item && (p.item.is_completed === 1 || p.item.isCompleted === true || p.item.completed === true)) return true;
              if (p.video && (p.video.is_completed === 1 || p.video.isCompleted === true || p.video.completed === true)) return true;
            }
            fiber = fiber.return;
            fDepth++;
          }
        }
        curr = curr.parentElement;
        depth++;
      }
    } catch (e) {}
    return false;
  }

  // Master Row Completed Evaluator
  function isRowCompletedMaster(row) {
    if (!row) return false;

    // Vector 1: Visual DOM & SVG check
    if (isSolidTickInNode(row)) return true;

    // Vector 2: Direct coordinate element sampling
    if (isSolidTickAtCoordinates(row)) return true;

    // Vector 3: React Fiber state inspection
    if (isCompletedViaReact(row)) return true;

    return false;
  }

  // ----------------------------------------------------------------------
  // 3. SIDEBAR ROW DETECTOR (LEAF CLIMBING & LINK SCANNING)
  // ----------------------------------------------------------------------
  function getSidebarVideoRows() {
    const all = Array.from(document.querySelectorAll('*'));
    const maxSidebarX = Math.max(400, window.innerWidth * 0.48);

    // 1. Find leaf nodes containing "Duration:" in sidebar
    const leafDurationNodes = all.filter(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.left > maxSidebarX) return false;
      const txt = (el.innerText || el.textContent || '').trim();
      if (!txt.includes('Duration:')) return false;
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
        const children = parent.querySelectorAll('*');
        let leafCount = 0;
        for (const c of children) {
          if (leafSet.has(c)) leafCount++;
        }
        if (leafCount > 1) break; // Parent is playlist container
        row = parent;
      }
      if (row && !rows.includes(row)) {
        rows.push(row);
      }
    }

    // Fallback: If leaf detection found 0, find anchors with /video/
    if (rows.length === 0) {
      const fallbackRows = Array.from(document.querySelectorAll('a[href*="/video/"]')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left < maxSidebarX;
      });
      return fallbackRows;
    }

    return rows;
  }

  function isCurrentVideoRow(row) {
    if (!row) return false;

    // 1. Match URL / video ID
    const curPath = decodeURIComponent(location.pathname).toLowerCase();
    const vidMatch = curPath.match(/\/video\/([^\/?#]+)/i);
    const curVidId = vidMatch ? vidMatch[1] : '';

    const a = row.tagName === 'A' ? row : row.querySelector('a');
    if (a) {
      const rawHref = decodeURIComponent(a.getAttribute('href') || a.href || '').toLowerCase();
      if (rawHref.includes(curPath) || (curVidId && rawHref.includes(curVidId))) {
        return true;
      }
    }

    // 2. Match active class
    const cls = (typeof row.className === 'string' ? row.className : (row.className?.baseVal || '')).toLowerCase();
    if (cls.includes('active') || cls.includes('selected') || cls.includes('highlight')) return true;
    if (row.querySelector('.active, [aria-current="page"], [aria-selected="true"]')) return true;

    // 3. Match title against heading above video player
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

  function getCurrentVideoRow() {
    const rows = getSidebarVideoRows();
    for (const row of rows) {
      if (isCurrentVideoRow(row)) return row;
    }
    return null;
  }

  function isCurrentVideoAlreadyCompleted() {
    const curRow = getCurrentVideoRow();
    if (curRow) {
      if (isRowCompletedMaster(curRow)) return true;
    }

    // Fallback: search all rows
    const rows = getSidebarVideoRows();
    for (const row of rows) {
      if (isCurrentVideoRow(row)) {
        if (isRowCompletedMaster(row)) return true;
      }
    }
    return false;
  }

  function findFirstUncompletedVideoRow() {
    const rows = getSidebarVideoRows();
    for (const row of rows) {
      if (!isRowCompletedMaster(row)) {
        return row;
      }
    }
    return null;
  }

  // ----------------------------------------------------------------------
  // 4. REPLAY FROM BEGINNING (0:00) FOR GLITCHED END-FRAME VIDEOS
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
  // 5. NAVIGATION ENGINE (NEXT BUTTON, SIDEBAR JUMP, NEXT TRACK)
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

    // 2. Direct Jump: If an uncompleted video is ahead, jump straight to it!
    if (uncompleted && !isCurrentVideoRow(uncompleted)) {
      console.log('[GFG Auto] Jumping directly to uncompleted video:', uncompleted);
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
  // 6. FLOATING STATUS BADGE & MANUAL SKIP BUTTON
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
        background: rgba(15, 23, 42, 0.95);
        color: #f8fafc;
        padding: 9px 14px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        border: 1px solid #38bdf8;
        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        gap: 10px;
        pointer-events: auto;
      `;
      document.body.appendChild(hud);
    }
    if (hud) {
      hud.innerHTML = `
        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; display: inline-block; flex-shrink: 0;"></span>
        <span style="font-weight: 700; color: #38bdf8;">GFG Auto v4.2:</span>
        <span>${message}</span>
        <button id="gfg-hud-skip-btn" style="
          background: #0284c7;
          color: #ffffff;
          border: none;
          padding: 3px 8px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 11px;
          font-weight: bold;
          margin-left: 4px;
          transition: background 0.15s;
        " title="Skip current video immediately">⏩ Skip</button>
      `;

      const skipBtn = document.getElementById('gfg-hud-skip-btn');
      if (skipBtn) {
        skipBtn.onclick = (e) => {
          e.stopPropagation();
          updateHUD('Manual Skip triggered! Advancing...', '#eab308');
          lastAdvanceTime = 0;
          advanceToNext();
        };
      }
    }
  }

  // ----------------------------------------------------------------------
  // 7. MAIN CONTROLLER LOOP
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

    // 3. Feature: If current video is ALREADY completed, skip it immediately!
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

    // 5. Feature: Replay from 0:00 if an UNCOMPLETED video opened at the end frame!
    const videoKey = location.href + '#' + (video.currentSrc || video.src || '');
    if (checkedVideoKey !== videoKey) {
      checkedVideoKey = videoKey;
      hasCheckedInitialEndFrame = false;
    }

    if (!hasCheckedInitialEndFrame && video.duration > 5) {
      // ONLY REPLAY IF VIDEO IS NOT COMPLETED!
      if (!isCurrentVideoAlreadyCompleted()) {
        if (video.currentTime >= video.duration - 3 || video.ended) {
          hasCheckedInitialEndFrame = true;
          updateHUD('↺ Glitched end-frame: Resetting to 0:00...', '#eab308');
          replayVideoFromBeginning(video);
          return;
        }
      }
      hasCheckedInitialEndFrame = true; // Started normally or completed
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
  // 8. BACKGROUND UNTHROTTLED PULSE
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
})();
