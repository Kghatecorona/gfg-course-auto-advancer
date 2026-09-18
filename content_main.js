// ======================================================================
// GFG Course Auto-Advancer - Main World Execution Script (v5.3.0)
// Runs directly in the webpage context (world: "MAIN")
// Features:
// 1. Strict 2.0x Playback Lock (Accepted by GFG backend watch-time validation)
// 2. Unpausable Background Video Engine (Chromium background-video-pause bypass)
// 3. Dual-Layer Muting (Tab muted at browser level + zero-gain Web Audio node)
// 4. Infallible Green Tick Detection (Official SVG assets, white stroke, React Fiber)
// 5. Automatic Non-Blocking Navigation (SPA + direct background href fallback)
// 6. Sleek Floating HUD with live progress & ETA (NO speed buttons)
// ======================================================================

(function () {
  'use strict';

  if (window.__GFG_AUTO_MAIN_V53__) return;
  window.__GFG_AUTO_MAIN_V53__ = true;

  console.log('%c[GFG Auto v5.3.0] Main World Engine Active - Background Persistence Enabled', 'color: #22c55e; font-size: 14px; font-weight: bold;');

  const TARGET_SPEED = 2.0;

  // Request browser-level tab muting from isolated extension bridge
  function requestTabMute() {
    window.postMessage({ source: 'gfg_main_request', action: 'MUTE_TAB' }, '*');
  }
  requestTabMute();

  // ====================================================================
  // 1. PAGE-WIDE VISIBILITY & FOCUS SPOOFER (MAIN WORLD)
  // ====================================================================
  try {
    Object.defineProperty(Document.prototype, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    Document.prototype.hasFocus = () => true;
    document.hasFocus = () => true;
    window.hasFocus = () => true;
  } catch (e) {}

  // Intercept and swallow blur, focusout, and visibilitychange events
  ['visibilitychange', 'blur', 'focusout'].forEach((evtName) => {
    window.addEventListener(evtName, (e) => e.stopImmediatePropagation(), true);
    document.addEventListener(evtName, (e) => e.stopImmediatePropagation(), true);
  });

  // ====================================================================
  // 2. UNPAUSABLE BACKGROUND VIDEO ENGINE
  // Chromium pauses muted videos in background tabs to save resources.
  // We keep video.muted = false so Chromium treats it as an active audible video,
  // while muting the tab at the browser level and Web Audio level for 100% silence.
  // ====================================================================
  const origPlay = HTMLMediaElement.prototype.play;
  const origPause = HTMLMediaElement.prototype.pause;
  const connectedAudioVideos = new WeakSet();

  function silenceVideoWithWebAudio(video) {
    if (!video || connectedAudioVideos.has(video)) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const src = ctx.createMediaElementSource(video);
        const gain = ctx.createGain();
        gain.gain.value = 0.0; // Silenced completely
        src.connect(gain);
        gain.connect(ctx.destination);
        connectedAudioVideos.add(video);
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      }
    } catch (e) {}
  }

  HTMLMediaElement.prototype.play = function () {
    // Keep unmuted at DOM level so Chromium doesn't freeze the video decoder
    this.muted = false;
    this.defaultMuted = false;
    this.playbackRate = TARGET_SPEED;
    silenceVideoWithWebAudio(this);
    requestTabMute();
    return origPlay.apply(this, arguments);
  };

  // Block automated background pause calls when video is playing
  HTMLMediaElement.prototype.pause = function () {
    if (this.ended || (this.duration && this.currentTime >= this.duration - 0.5)) {
      return origPause.apply(this, arguments);
    }
    console.log('[GFG Auto v5.3.0] Background pause suppressed.');
  };

  // ====================================================================
  // 3. FLOATING HUD (VISIBLE, DRAGGABLE, NO SPEED BUTTONS)
  // ====================================================================
  let hudContainer = null;
  let isMinimized = localStorage.getItem('gfg_hud_minimized') === 'true';
  let hudStatusMessage = 'Active (2.0x)';
  let hudStatusColor = '#22c55e';

  function updateHUDStatus(msg, color = '#22c55e') {
    hudStatusMessage = msg;
    hudStatusColor = color;
    renderHUD();
  }

  function renderHUD() {
    if (!document.body) return;

    if (!hudContainer) {
      hudContainer = document.createElement('div');
      hudContainer.id = 'gfg-auto-hud-v5';
      hudContainer.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; user-select: none;';
      document.body.appendChild(hudContainer);

      let isDragging = false;
      let startX = 0, startY = 0, origLeft = 0, origTop = 0;

      hudContainer.addEventListener('mousedown', (e) => {
        const header = e.target.closest('#gfg-hud-header');
        if (!header) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = hudContainer.getBoundingClientRect();
        origLeft = rect.left;
        origTop = rect.top;
        hudContainer.style.bottom = 'auto';
        hudContainer.style.right = 'auto';
        hudContainer.style.left = origLeft + 'px';
        hudContainer.style.top = origTop + 'px';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        hudContainer.style.left = Math.max(10, Math.min(window.innerWidth - 280, origLeft + dx)) + 'px';
        hudContainer.style.top = Math.max(10, Math.min(window.innerHeight - 80, origTop + dy)) + 'px';
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }

    if (isMinimized) {
      hudContainer.innerHTML = '<div id="gfg-hud-header" style="background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px); border: 1.5px solid #22c55e; border-radius: 9999px; padding: 7px 14px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 8px; cursor: move; color: #f8fafc; font-size: 12px; font-weight: 600;"><span style="width: 8px; height: 8px; border-radius: 50%; background: ' + hudStatusColor + '; display: inline-block;"></span><span>GFG Auto 2x</span><button id="gfg-hud-expand-btn" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; padding: 0 2px; line-height: 1;" title="Expand panel">⤢</button></div>';
      const expandBtn = document.getElementById('gfg-hud-expand-btn');
      if (expandBtn) {
        expandBtn.onclick = (e) => {
          e.stopPropagation();
          isMinimized = false;
          localStorage.setItem('gfg_hud_minimized', 'false');
          renderHUD();
        };
      }
      return;
    }

    const video = document.querySelector('video');
    let timeInfo = '';
    if (video && video.duration > 0) {
      const curM = Math.floor(video.currentTime / 60);
      const curS = Math.floor(video.currentTime % 60).toString().padStart(2, '0');
      const durM = Math.floor(video.duration / 60);
      const durS = Math.floor(video.duration % 60).toString().padStart(2, '0');
      const remSec = Math.max(0, Math.round((video.duration - video.currentTime) / TARGET_SPEED));
      const remM = Math.floor(remSec / 60);
      const remS = (remSec % 60).toString().padStart(2, '0');
      timeInfo = '[' + curM + ':' + curS + ' / ' + durM + ':' + durS + '] • ETA: ~' + remM + 'm ' + remS + 's';
    }

    hudContainer.innerHTML = `
      <div style="background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(14px); border: 1.5px solid #22c55e; border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6); padding: 12px 14px; min-width: 250px; max-width: 300px; color: #f8fafc; display: flex; flex-direction: column; gap: 8px;">
        <div id="gfg-hud-header" style="display: flex; align-items: center; justify-content: space-between; cursor: move; border-bottom: 1px solid rgba(148, 163, 184, 0.15); padding-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 7px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${hudStatusColor}; display: inline-block;"></span>
            <span style="font-weight: 800; font-size: 13px; color: #22c55e; letter-spacing: 0.3px;">GFG Auto v5.3</span>
          </div>
          <button id="gfg-hud-min-btn" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; padding: 0 4px; line-height: 1;" title="Minimize panel">_</button>
        </div>

        <div style="font-size: 12px; line-height: 1.4;">
          <div style="color: #f1f5f9; font-weight: 600;">${hudStatusMessage}</div>
          ${timeInfo ? `<div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">${timeInfo}</div>` : ''}
        </div>

        <div style="display: flex; gap: 6px; margin-top: 2px;">
          <button id="gfg-hud-skip-btn" style="flex: 1; background: #16a34a; color: #ffffff; border: none; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 4px; transition: background 0.15s;" title="Skip to next uncompleted lesson">⏭ Skip</button>
          <button id="gfg-hud-replay-btn" style="flex: 1; background: rgba(51, 65, 85, 0.8); color: #f8fafc; border: 1px solid rgba(148, 163, 184, 0.3); padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px; transition: background 0.15s;" title="Rewind to 0:00 and play">↺ Replay 0:00</button>
        </div>
      </div>
    `;

    const minBtn = document.getElementById('gfg-hud-min-btn');
    if (minBtn) {
      minBtn.onclick = (e) => {
        e.stopPropagation();
        isMinimized = true;
        localStorage.setItem('gfg_hud_minimized', 'true');
        renderHUD();
      };
    }

    const skipBtn = document.getElementById('gfg-hud-skip-btn');
    if (skipBtn) {
      skipBtn.onclick = (e) => {
        e.stopPropagation();
        updateHUDStatus('Manual skip triggered! Advancing...', '#eab308');
        lastAdvanceTime = 0;
        advanceToNext();
      };
    }

    const replayBtn = document.getElementById('gfg-hud-replay-btn');
    if (replayBtn) {
      replayBtn.onclick = (e) => {
        e.stopPropagation();
        const v = document.querySelector('video');
        if (v) {
          updateHUDStatus('Rewinding to 0:00...', '#eab308');
          replayVideoFromBeginning(v);
        }
      };
    }
  }

  // ====================================================================
  // 4. GREEN TICK DETECTION ENGINE (100% CERTAINTY)
  // ====================================================================
  function isRowCompleted(row) {
    if (!row) return false;

    // 1. Image src check (Group11(1) is completed, Group11 is incomplete)
    const imgs = row.querySelectorAll('img');
    for (const img of imgs) {
      const src = (img.getAttribute('src') || img.src || '').toLowerCase();
      if (src.includes('group11(1)') || src.includes('group11%281%29')) return true;
      if (src.includes('group11') && !src.includes('(1)') && !src.includes('%281%29')) return false;
    }

    // 2. CSS background-image
    const allDescendants = [row, ...Array.from(row.querySelectorAll('*'))];
    for (const el of allDescendants) {
      try {
        const bg = window.getComputedStyle(el).backgroundImage.toLowerCase();
        if (bg.includes('group11(1)') || bg.includes('group11%281%29')) return true;
        if (bg.includes('group11') && !bg.includes('(1)') && !bg.includes('%281%29')) return false;
      } catch (e) {}
    }

    // 3. Inline SVG markup
    const svgs = row.querySelectorAll('svg');
    for (const svg of svgs) {
      const rawHtml = svg.outerHTML.toLowerCase();

      const paths = svg.querySelectorAll('path');
      for (const p of paths) {
        const stroke = (p.getAttribute('stroke') || p.style.stroke || '').toLowerCase();
        if (stroke === 'white' || stroke === '#fff' || stroke === '#ffffff' || stroke === 'rgb(255, 255, 255)') {
          return true;
        }
      }

      const circles = svg.querySelectorAll('circle');
      for (const c of circles) {
        const fill = (c.getAttribute('fill') || c.style.fill || '').toLowerCase();
        if (fill === '#2f8d46' || fill === 'rgb(47, 141, 70)') {
          return true;
        }
      }

      if (rawHtml.includes('stroke="white"') || rawHtml.includes("stroke='white'") ||
          rawHtml.includes('stroke="#ffffff"') || rawHtml.includes('stroke="#fff"') ||
          rawHtml.includes('fill="#2f8d46"') || rawHtml.includes('rgb(47, 141, 70)')) {
        return true;
      }
    }

    // 4. Coordinate Element Sampling
    try {
      const rect = row.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const target = document.elementFromPoint(rect.right - 20, rect.top + rect.height / 2);
        if (target) {
          const container = target.closest('svg, [class*="icon"], [class*="tick"], span, div') || target;
          const html = container.outerHTML.toLowerCase();
          if (html.includes('group11(1)') || html.includes('stroke="white"') || html.includes('fill="#2f8d46"')) {
            return true;
          }
        }
      }
    } catch (e) {}

    // 5. Direct React Fiber Props (100% accessible in Main World)
    try {
      let curr = row;
      let depth = 0;
      while (curr && depth < 6) {
        const key = Object.keys(curr).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
        if (key) {
          let fiber = curr[key];
          let fDepth = 0;
          while (fiber && fDepth < 8) {
            const p = fiber.memoizedProps;
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

  // ====================================================================
  // 5. SIDEBAR NAVIGATION & PLAYLIST DISCOVERY
  // ====================================================================
  function getSidebarVideoRows() {
    const all = Array.from(document.querySelectorAll('*'));
    const maxSidebarX = Math.max(400, window.innerWidth * 0.48);

    const leafDurationNodes = all.filter(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.left > maxSidebarX) return false;
      const txt = (el.innerText || el.textContent || '').trim();
      if (!txt.includes('Duration:')) return false;
      return !Array.from(el.children).some(child => (child.innerText || child.textContent || '').includes('Duration:'));
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
        if (leafCount > 1) break;
        row = parent;
      }
      if (row && !rows.includes(row)) {
        rows.push(row);
      }
    }

    if (rows.length === 0) {
      return Array.from(document.querySelectorAll('a[href*="/video/"]')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left < maxSidebarX;
      });
    }

    return rows;
  }

  function isCurrentVideoRow(row) {
    if (!row) return false;

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

    const cls = (typeof row.className === 'string' ? row.className : (row.className?.baseVal || '')).toLowerCase();
    if (cls.includes('active') || cls.includes('selected') || cls.includes('highlight')) return true;
    if (row.querySelector('.active, [aria-current="page"], [aria-selected="true"]')) return true;

    return false;
  }

  function getCurrentVideoRow() {
    const rows = getSidebarVideoRows();
    for (const row of rows) {
      if (isCurrentVideoRow(row)) return row;
    }
    return null;
  }

  function isCurrentVideoCompleted() {
    const curRow = getCurrentVideoRow();
    if (curRow && isRowCompleted(curRow)) return true;

    const rows = getSidebarVideoRows();
    for (const row of rows) {
      if (isCurrentVideoRow(row) && isRowCompleted(row)) {
        return true;
      }
    }
    return false;
  }

  function findFirstUncompletedVideoRow() {
    const rows = getSidebarVideoRows();
    for (const row of rows) {
      if (!isRowCompleted(row)) {
        return row;
      }
    }
    return null;
  }

  // ====================================================================
  // 6. REPLAY GLITCHED END-FRAME VIDEOS FROM 0:00
  // ====================================================================
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
    return false;
  }

  function replayVideoFromBeginning(video) {
    if (!video) return;
    console.log('[GFG Auto v5.3.0] Glitched end-frame video detected! Resetting to 0:00...');
    try { video.currentTime = 0; } catch (e) {}
    try {
      video.dispatchEvent(new Event('seeking'));
      video.dispatchEvent(new Event('seeked'));
      video.dispatchEvent(new Event('timeupdate'));
    } catch (e) {}

    clickPlayerRestartButton();

    video.playbackRate = TARGET_SPEED;
    origPlay.call(video).catch(() => {});
  }

  // ====================================================================
  // 7. ADVANCER & NAVIGATION (SPA + DIRECT HREF FALLBACK)
  // ====================================================================
  let lastAdvanceTime = 0;

  function advanceToNext() {
    const now = Date.now();
    if (now - lastAdvanceTime < 2500) return;
    lastAdvanceTime = now;

    updateHUDStatus('Advancing to next target...', '#22c55e');
    console.log('[GFG Auto v5.3.0] Advancing to next target...');

    const uncompleted = findFirstUncompletedVideoRow();
    const allRows = getSidebarVideoRows();
    const currentIdx = allRows.findIndex(r => isCurrentVideoRow(r));

    // 1. Revisit missed uncompleted video earlier in track
    if (uncompleted && currentIdx !== -1) {
      const uncompletedIdx = allRows.indexOf(uncompleted);
      if (uncompletedIdx < currentIdx) {
        console.log('[GFG Auto v5.3.0] Revisiting missed uncompleted video:', uncompleted);
        updateHUDStatus('Revisiting missed video...', '#22c55e');
        navigateToRow(uncompleted);
        return;
      }
    }

    // 2. Direct jump to next uncompleted video
    if (uncompleted && !isCurrentVideoRow(uncompleted)) {
      console.log('[GFG Auto v5.3.0] Jumping directly to uncompleted video:', uncompleted);
      updateHUDStatus('Jumping to next video...', '#22c55e');
      navigateToRow(uncompleted);
      return;
    }

    // 3. Click Next Track button if present
    const allInteractive = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
    const nextTrackBtn = allInteractive.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return txt.includes('next') && txt.includes('track') && !txt.includes('prev');
    });

    if (nextTrackBtn) {
      console.log('[GFG Auto v5.3.0] Advancing to Next Track button:', nextTrackBtn);
      updateHUDStatus('Advancing to Next Track...', '#22c55e');
      clickTarget(nextTrackBtn);
      return;
    }

    // 4. Click Top-Right Next » button
    const topNext = allInteractive.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      const isNext = txt === 'next' || txt === 'next »' || txt === 'next >>' || txt === 'next >' || txt === 'next ›';
      return isNext && r.top < 220 && r.left > 350;
    });

    if (topNext) {
      const btn = topNext.closest('button, a, [role="button"]') || topNext;
      console.log('[GFG Auto v5.3.0] Advancing via Top-Right Next button:', btn);
      updateHUDStatus('Advancing via Next button...', '#22c55e');
      clickTarget(btn);
      return;
    }

    // 5. Bypass Quizzes / Problems to Next Track
    bypassQuizzesAndProblems();
  }

  function bypassQuizzesAndProblems() {
    console.log('[GFG Auto v5.3.0] Bypassing non-video module...');
    updateHUDStatus('Bypassing Quiz / Problem...', '#eab308');

    const allTrackLinks = Array.from(document.querySelectorAll('a[href*="/track/"]'));
    const curPath = decodeURIComponent(location.pathname).toLowerCase();
    const trackMatch = curPath.match(/\/track\/([^\/?#]+)/i);
    const curTrackSlug = trackMatch ? trackMatch[1] : '';

    let foundCurrentTrack = false;
    for (const a of allTrackLinks) {
      const href = decodeURIComponent(a.getAttribute('href') || a.href || '').toLowerCase();
      if (curTrackSlug && href.includes(curTrackSlug)) {
        foundCurrentTrack = true;
        continue;
      }
      if (foundCurrentTrack && !href.includes(curTrackSlug)) {
        console.log('[GFG Auto v5.3.0] Advancing to next track link:', a);
        clickTarget(a);
        return;
      }
    }

    const nextBtns = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(el => {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return (txt.includes('next') && txt.includes('track')) || txt === 'go to next track';
    });
    if (nextBtns.length > 0) {
      clickTarget(nextBtns[0]);
    }
  }

  function navigateToRow(row) {
    if (!row) return false;

    const a = row.tagName === 'A' ? row : row.querySelector('a');
    if (a && a.href && !a.href.startsWith('javascript:')) {
      const destUrl = a.href;
      clickTarget(a);
      // Hard navigation fallback for background tabs where React events may defer
      setTimeout(() => {
        if (location.href !== destUrl) {
          window.location.href = destUrl;
        }
      }, 1000);
      return true;
    }

    const titleEl = Array.from(row.querySelectorAll('*')).find(el => {
      const txt = (el.innerText || el.textContent || '').trim();
      return txt.length > 3 && !txt.startsWith('Duration:') && !txt.includes('min');
    }) || row;

    const target = titleEl.closest('button, [role="button"]') || titleEl;
    clickTarget(target);
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
    const anchor = target.tagName === 'A' ? target : target.querySelector('a');
    if (anchor && anchor.href && !anchor.href.startsWith('javascript:')) {
      const dest = anchor.href;
      setTimeout(() => {
        if (location.href !== dest) {
          window.location.href = dest;
        }
      }, 1000);
    }
  }

  // ====================================================================
  // 8. CORE AUTOMATION CONTROLLER LOOP
  // ====================================================================
  let currentUrl = location.href;
  let pageLoadCooldownUntil = 0;
  let checkedVideoKey = '';
  let hasCheckedInitialEndFrame = false;

  function tick() {
    renderHUD();

    // 1. Detect URL changes
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      pageLoadCooldownUntil = Date.now() + 1500;
      lastAdvanceTime = 0;
      checkedVideoKey = '';
      hasCheckedInitialEndFrame = false;
      console.log('[GFG Auto v5.3.0] URL changed:', currentUrl);
      updateHUDStatus('Loading new video...', '#22c55e');
      requestTabMute();
      return;
    }

    // 2. Standby if not on a course track
    if (!location.pathname.includes('/track/')) {
      updateHUDStatus('Standby on course page', '#94a3b8');
      return;
    }

    // 3. Skip non-video pages (Quiz, Problem, Contest, Assignment)
    const isNonVideoPage = location.pathname.includes('/quiz/') || 
                           location.pathname.includes('/problem/') || 
                           location.pathname.includes('/contest/') || 
                           location.pathname.includes('/assignment/');
    if (isNonVideoPage) {
      updateHUDStatus('Skipping Quiz / Problem...', '#eab308');
      bypassQuizzesAndProblems();
      return;
    }

    // 4. If current video is ALREADY COMPLETED (solid green tick), skip immediately!
    if (Date.now() > pageLoadCooldownUntil) {
      if (isCurrentVideoCompleted()) {
        updateHUDStatus('✓ Already completed! Skipping...', '#22c55e');
        advanceToNext();
        return;
      }
    }

    // 5. Video Player Management (2.0x, Unpausable, Continuous Autoplay)
    const video = document.querySelector('video');
    if (!video) {
      const bodyText = (document.body?.innerText || '').toLowerCase();
      if (bodyText.includes('go to problems') || bodyText.includes('solve problems') || bodyText.includes('start quiz')) {
        bypassQuizzesAndProblems();
      } else {
        updateHUDStatus('Waiting for video player...', '#94a3b8');
      }
      return;
    }

    silenceVideoWithWebAudio(video);
    requestTabMute();

    // Attach pause-prevention and rate-lock listener to video directly
    if (!video.__gfg_listeners_set__) {
      video.__gfg_listeners_set__ = true;

      video.addEventListener('ratechange', () => {
        if (video.playbackRate !== TARGET_SPEED) {
          video.playbackRate = TARGET_SPEED;
        }
      });

      // If browser or script pauses, immediately restart playback
      video.addEventListener('pause', () => {
        if (!video.ended && video.currentTime < (video.duration - 0.5)) {
          setTimeout(() => {
            video.playbackRate = TARGET_SPEED;
            origPlay.call(video).catch(() => {});
          }, 100);
        }
      });
    }

    // Feature: Rewind glitched end-frames for uncompleted videos
    const videoKey = location.href + '#' + (video.currentSrc || video.src || '');
    if (checkedVideoKey !== videoKey) {
      checkedVideoKey = videoKey;
      hasCheckedInitialEndFrame = false;
    }

    if (!hasCheckedInitialEndFrame && video.duration > 3) {
      if (!isCurrentVideoCompleted()) {
        if (video.currentTime >= video.duration - 2 || video.ended) {
          hasCheckedInitialEndFrame = true;
          updateHUDStatus('↺ Glitched end-frame: Resetting to 0:00...', '#eab308');
          replayVideoFromBeginning(video);
          return;
        }
      }
      hasCheckedInitialEndFrame = true;
    }

    // Strictly enforce 2.0x playback rate
    if (video.playbackRate !== TARGET_SPEED) {
      video.playbackRate = TARGET_SPEED;
    }

    // Autoplay if paused in background
    if (video.paused && !video.ended) {
      origPlay.call(video).catch(() => {});
    }

    // Live Playing Status
    if (video.duration > 0 && !video.paused) {
      updateHUDStatus('▶ Playing at 2.0x (Muted)', '#22c55e');
    }

    // 6. Video Completion Check
    const isFinished = video.ended || (video.duration > 3 && video.currentTime >= video.duration - 0.5);
    if (isFinished) {
      // Must have played at least 2s or ended
      if (video.currentTime > 2 || video.ended) {
        updateHUDStatus('✓ Video complete! Advancing...', '#22c55e');
        setTimeout(() => {
          advanceToNext();
        }, 800);
        return;
      }
    }
  }

  // ====================================================================
  // 9. UNTHROTTLED PULSE LISTENERS
  // ====================================================================
  window.addEventListener('message', (e) => {
    if (e.data?.source === 'gfg_isolated_pulse') {
      tick();
    }
  });

  try {
    const blob = new Blob(["setInterval(() => postMessage('tick'), 1000);"], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => tick();
  } catch (e) {}

  setInterval(tick, 1000);
})();
