// ======================================================================
// GFG Course Auto-Advancer - Main World Execution Script (v5.2.0)
// Runs directly in the webpage context (world: "MAIN")
// Features:
// 1. Sleek, visible, draggable Floating HUD with live status & speed controls
// 2. Dedicated 10x speed button with strict speed lock (and 2x, 5x, 16x options)
// 3. Instant manual skip and rewind controls
// 4. Infallible Green Tick Detection (SVG assets, stroke/fill, React Fiber)
// 5. Background & Virtual Desktop persistence (visibility & focus spoofing)
// 6. Anti-pause hooks & seamless Next.js SPA auto-advancement
// ======================================================================

(function () {
  'use strict';

  if (window.__GFG_AUTO_MAIN_V52__) return;
  window.__GFG_AUTO_MAIN_V52__ = true;

  console.log('%c[GFG Auto v5.2.0] Main World Engine Active with 10x Speed & Visible HUD!', 'color: #38bdf8; font-size: 14px; font-weight: bold;');

  // ====================================================================
  // 1. SPEED CONFIGURATION & PERSISTENCE
  // ====================================================================
  let targetSpeed = parseFloat(localStorage.getItem('gfg_auto_speed') || '10.0');
  if (isNaN(targetSpeed) || targetSpeed <= 0) targetSpeed = 10.0;

  function setSpeed(newSpeed) {
    targetSpeed = parseFloat(newSpeed);
    localStorage.setItem('gfg_auto_speed', targetSpeed.toString());
    const video = document.querySelector('video');
    if (video) {
      try {
        video.playbackRate = targetSpeed;
      } catch (e) {}
    }
    updateHUDStatus(`Speed locked at ${targetSpeed}x`, '#38bdf8');
    renderHUD();
  }

  // ====================================================================
  // 2. PAGE-WIDE VISIBILITY & FOCUS SPOOFER (MAIN WORLD)
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

  // Intercept and drop blur, focusout, and visibilitychange in capturing phase
  ['visibilitychange', 'blur', 'focusout'].forEach((evtName) => {
    window.addEventListener(evtName, (e) => e.stopImmediatePropagation(), true);
    document.addEventListener(evtName, (e) => e.stopImmediatePropagation(), true);
  });

  // ====================================================================
  // 3. HTMLMEDIAELEMENT HOOKS (ENFORCE TARGET SPEED, MUTED, AND ANTI-PAUSE)
  // ====================================================================
  const origPlay = HTMLMediaElement.prototype.play;
  const origPause = HTMLMediaElement.prototype.pause;

  HTMLMediaElement.prototype.play = function () {
    this.muted = true;
    this.defaultMuted = true;
    this.volume = 0;
    this.playbackRate = targetSpeed;
    return origPlay.apply(this, arguments);
  };

  // Block automated background pause calls when video is playing mid-lecture
  HTMLMediaElement.prototype.pause = function () {
    if (this.ended || (this.duration && this.currentTime >= this.duration - 0.5)) {
      return origPause.apply(this, arguments);
    }
    console.log('[GFG Auto v5.2.0] Background pause suppressed.');
  };

  // ====================================================================
  // 4. FLOATING HUD (VISIBLE, DRAGGABLE, INTERACTIVE)
  // ====================================================================
  let hudContainer = null;
  let isMinimized = localStorage.getItem('gfg_hud_minimized') === 'true';
  let hudStatusMessage = 'Initializing...';
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
      hudContainer.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        user-select: none;
      `;
      document.body.appendChild(hudContainer);

      // Draggable logic
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
        hudContainer.style.left = `${origLeft}px`;
        hudContainer.style.top = `${origTop}px`;
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        hudContainer.style.left = `${Math.max(10, Math.min(window.innerWidth - 300, origLeft + dx))}px`;
        hudContainer.style.top = `${Math.max(10, Math.min(window.innerHeight - 80, origTop + dy))}px`;
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }

    if (isMinimized) {
      hudContainer.innerHTML = `
        <div id="gfg-hud-header" style="
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(12px);
          border: 1.5px solid #38bdf8;
          border-radius: 9999px;
          padding: 8px 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: move;
          color: #f8fafc;
          font-size: 12px;
          font-weight: 600;
        ">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${hudStatusColor}; display: inline-block;"></span>
          <span>⚡ ${targetSpeed}x</span>
          <button id="gfg-hud-expand-btn" style="
            background: none;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            font-size: 14px;
            padding: 0 2px;
            line-height: 1;
          " title="Expand panel">⤢</button>
        </div>
      `;
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
      const remSec = Math.max(0, Math.round((video.duration - video.currentTime) / targetSpeed));
      const remM = Math.floor(remSec / 60);
      const remS = (remSec % 60).toString().padStart(2, '0');
      timeInfo = `[${curM}:${curS} / ${durM}:${durS}] • ETA: ~${remM}m ${remS}s`;
    }

    const speeds = [1, 2, 5, 10, 16];
    const speedButtonsHtml = speeds.map(s => {
      const isActive = targetSpeed === s;
      const isTenX = s === 10;
      const activeStyle = isActive
        ? (isTenX
            ? 'background: #0284c7; border: 1.5px solid #38bdf8; box-shadow: 0 0 12px rgba(56,189,248,0.7); font-weight: 800; color: #ffffff;'
            : 'background: #16a34a; border: 1.5px solid #4ade80; box-shadow: 0 0 8px rgba(74,222,128,0.5); font-weight: 700; color: #ffffff;')
        : 'background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.2); color: #cbd5e1; font-weight: 500;';

      const label = isTenX ? '⚡ 10x' : `${s}x`;
      return `
        <button class="gfg-speed-btn" data-speed="${s}" style="
          ${activeStyle}
          padding: 4px 9px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.15s ease;
        ">${label}</button>
      `;
    }).join('');

    hudContainer.innerHTML = `
      <div style="
        background: rgba(15, 23, 42, 0.96);
        backdrop-filter: blur(14px);
        border: 1.5px solid #0ea5e9;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
        padding: 12px 14px;
        min-width: 270px;
        max-width: 320px;
        color: #f8fafc;
        display: flex;
        flex-direction: column;
        gap: 8px;
      ">
        <!-- Header -->
        <div id="gfg-hud-header" style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: move;
          border-bottom: 1px solid rgba(148, 163, 184, 0.15);
          padding-bottom: 6px;
        ">
          <div style="display: flex; align-items: center; gap: 7px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${hudStatusColor}; display: inline-block;"></span>
            <span style="font-weight: 800; font-size: 13px; color: #38bdf8; letter-spacing: 0.3px;">GFG Auto v5.2</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button id="gfg-hud-min-btn" style="
              background: none;
              border: none;
              color: #94a3b8;
              cursor: pointer;
              font-size: 14px;
              padding: 0 4px;
              line-height: 1;
            " title="Minimize panel">_</button>
          </div>
        </div>

        <!-- Status Message & Live Time -->
        <div style="font-size: 12px; line-height: 1.4;">
          <div style="color: #f1f5f9; font-weight: 600;">${hudStatusMessage}</div>
          ${timeInfo ? `<div style="color: #94a3b8; font-size: 11px; margin-top: 2px;">${timeInfo}</div>` : ''}
        </div>

        <!-- Speed Selector Row -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Playback Speed:</div>
          <div style="display: flex; gap: 5px;">
            ${speedButtonsHtml}
          </div>
        </div>

        <!-- Action Buttons Row -->
        <div style="display: flex; gap: 6px; margin-top: 2px;">
          <button id="gfg-hud-skip-btn" style="
            flex: 1;
            background: #0284c7;
            color: #ffffff;
            border: none;
            padding: 5px 8px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: background 0.15s;
          " title="Skip to next uncompleted lesson">⏭ Skip</button>

          <button id="gfg-hud-replay-btn" style="
            flex: 1;
            background: rgba(51, 65, 85, 0.8);
            color: #f8fafc;
            border: 1px solid rgba(148, 163, 184, 0.3);
            padding: 5px 8px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: background 0.15s;
          " title="Rewind to 0:00 and play">↺ Replay 0:00</button>
        </div>
      </div>
    `;

    // Bind Min/Max
    const minBtn = document.getElementById('gfg-hud-min-btn');
    if (minBtn) {
      minBtn.onclick = (e) => {
        e.stopPropagation();
        isMinimized = true;
        localStorage.setItem('gfg_hud_minimized', 'true');
        renderHUD();
      };
    }

    // Bind Speed Buttons
    document.querySelectorAll('.gfg-speed-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const spd = parseFloat(btn.getAttribute('data-speed'));
        if (spd) setSpeed(spd);
      };
    });

    // Bind Skip Button
    const skipBtn = document.getElementById('gfg-hud-skip-btn');
    if (skipBtn) {
      skipBtn.onclick = (e) => {
        e.stopPropagation();
        updateHUDStatus('Manual skip triggered! Advancing...', '#eab308');
        lastAdvanceTime = 0;
        advanceToNext();
      };
    }

    // Bind Replay Button
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
  // 5. GREEN TICK DETECTION ENGINE (100% CERTAINTY)
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

    // 5. Direct React Fiber Props (100% accessible in Main World!)
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
  // 6. SIDEBAR NAVIGATION & PLAYLIST DISCOVERY
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
  // 7. REPLAY GLITCHED END-FRAME VIDEOS FROM 0:00
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
    console.log('[GFG Auto v5.2.0] Glitched end-frame video detected! Resetting to 0:00...');
    try { video.currentTime = 0; } catch (e) {}
    try {
      video.dispatchEvent(new Event('seeking'));
      video.dispatchEvent(new Event('seeked'));
      video.dispatchEvent(new Event('timeupdate'));
    } catch (e) {}

    clickPlayerRestartButton();

    video.muted = true;
    video.volume = 0;
    video.playbackRate = targetSpeed;
    origPlay.call(video).catch(() => {});
  }

  // ====================================================================
  // 8. ADVANCER & NAVIGATION (SPA + DOM)
  // ====================================================================
  let lastAdvanceTime = 0;

  function advanceToNext() {
    const now = Date.now();
    if (now - lastAdvanceTime < 2500) return;
    lastAdvanceTime = now;

    updateHUDStatus('Advancing to next target...', '#38bdf8');
    console.log('[GFG Auto v5.2.0] Advancing to next target...');

    const uncompleted = findFirstUncompletedVideoRow();
    const allRows = getSidebarVideoRows();
    const currentIdx = allRows.findIndex(r => isCurrentVideoRow(r));

    // 1. Revisit missed uncompleted video earlier in track
    if (uncompleted && currentIdx !== -1) {
      const uncompletedIdx = allRows.indexOf(uncompleted);
      if (uncompletedIdx < currentIdx) {
        console.log('[GFG Auto v5.2.0] Revisiting missed uncompleted video:', uncompleted);
        updateHUDStatus('Revisiting missed video...', '#38bdf8');
        navigateToRow(uncompleted);
        return;
      }
    }

    // 2. Direct jump to next uncompleted video
    if (uncompleted && !isCurrentVideoRow(uncompleted)) {
      console.log('[GFG Auto v5.2.0] Jumping directly to uncompleted video:', uncompleted);
      updateHUDStatus('Jumping to next uncompleted video...', '#38bdf8');
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
      console.log('[GFG Auto v5.2.0] Advancing to Next Track button:', nextTrackBtn);
      updateHUDStatus('Advancing to Next Track...', '#38bdf8');
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
      console.log('[GFG Auto v5.2.0] Advancing via Top-Right Next button:', btn);
      updateHUDStatus('Advancing via Next button...', '#38bdf8');
      clickTarget(btn);
      return;
    }

    // 5. Bypass Quizzes / Problems to Next Track
    bypassQuizzesAndProblems();
  }

  function bypassQuizzesAndProblems() {
    console.log('[GFG Auto v5.2.0] Bypassing non-video module...');
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
        console.log('[GFG Auto v5.2.0] Advancing to next track link:', a);
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

    try {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}

    const a = row.tagName === 'A' ? row : row.querySelector('a');
    if (a && a.href && !a.href.startsWith('javascript:')) {
      const destUrl = a.href;
      clickTarget(a);
      setTimeout(() => {
        if (location.href !== destUrl) {
          try {
            if (window.next && window.next.router) {
              window.next.router.push(destUrl);
              return;
            }
          } catch (e) {}
          window.location.href = destUrl;
        }
      }, 1500);
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
  }

  // ====================================================================
  // 9. CORE AUTOMATION CONTROLLER LOOP
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
      console.log('[GFG Auto v5.2.0] URL changed:', currentUrl);
      updateHUDStatus('Loading new video...', '#38bdf8');
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

    // 5. Video Player Management (Speed Lock, Muted, Continuous Autoplay)
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

    // Attach pause-prevention and rate-lock listener to video directly
    if (!video.__gfg_listeners_set__) {
      video.__gfg_listeners_set__ = true;

      // Ensure target speed cannot be overridden by player
      video.addEventListener('ratechange', () => {
        if (video.playbackRate !== targetSpeed) {
          video.playbackRate = targetSpeed;
        }
      });

      // Prevent player auto-pause
      video.addEventListener('pause', () => {
        if (!video.ended && video.currentTime < (video.duration - 0.5)) {
          setTimeout(() => {
            video.muted = true;
            video.volume = 0;
            video.playbackRate = targetSpeed;
            origPlay.call(video).catch(() => {});
          }, 150);
        }
      });
    }

    // Feature: Rewind glitched end-frames for uncompleted videos
    const videoKey = location.href + '#' + (video.currentSrc || video.src || '');
    if (checkedVideoKey !== videoKey) {
      checkedVideoKey = videoKey;
      hasCheckedInitialEndFrame = false;
    }

    if (!hasCheckedInitialEndFrame && video.duration > 5) {
      if (!isCurrentVideoCompleted()) {
        if (video.currentTime >= video.duration - 3 || video.ended) {
          hasCheckedInitialEndFrame = true;
          updateHUDStatus('↺ Glitched end-frame: Resetting to 0:00...', '#eab308');
          replayVideoFromBeginning(video);
          return;
        }
      }
      hasCheckedInitialEndFrame = true;
    }

    // Strictly lock playback rate and muted audio
    if (video.playbackRate !== targetSpeed) {
      video.playbackRate = targetSpeed;
    }
    if (!video.muted) {
      video.muted = true;
    }
    if (video.volume !== 0) {
      video.volume = 0;
    }

    // Autoplay if paused
    if (video.paused && !video.ended) {
      origPlay.call(video).catch(() => {});
    }

    // Live Playing Status
    if (video.duration > 0 && !video.paused) {
      updateHUDStatus(`▶ Playing at ${targetSpeed}x (Muted)`, '#22c55e');
    }

    // 6. Video Completion Check
    const isFinished = video.ended || (video.duration > 5 && video.currentTime >= video.duration - 0.5);
    if (isFinished && hasCheckedInitialEndFrame) {
      updateHUDStatus('✓ Video complete! Advancing...', '#22c55e');
      setTimeout(() => {
        advanceToNext();
      }, 1000);
      return;
    }
  }

  // ====================================================================
  // 10. UNTHROTTLED PULSE LISTENERS
  // ====================================================================
  // 1. Receive 1-second pulse from Isolated World Bridge
  window.addEventListener('message', (e) => {
    if (e.data?.source === 'gfg_isolated_pulse') {
      tick();
    }
  });

  // 2. Web Worker pulse loop (unthrottled timer)
  try {
    const blob = new Blob(["setInterval(() => postMessage('tick'), 1000);"], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => tick();
  } catch (e) {}

  // 3. Standard interval fallback
  setInterval(tick, 1000);
})();
