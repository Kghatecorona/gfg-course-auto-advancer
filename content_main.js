// ======================================================================
// GFG Course Auto-Advancer - Main World Execution Script (v5.6.0)
// Runs directly in the webpage context (world: "MAIN")
// Strict Dark Green Tick Verification Engine:
// 1. NEVER assumes a video is complete just because playback finished
// 2. Waits for GFG's authoritative dark green tick (solid #2F8D46 circle + white checkmark)
// 3. Advances ONLY when solid dark green tick is confirmed
// 4. If green tick is not granted within 8s, rewinds and replays to fulfill watch-time
// 5. Forces lowest quality (240p / 360p / Lowest Available)
// 6. Web Audio continuous silent keep-alive (zero background throttling)
// 7. Client-side SPA navigation & unpause watchdog
// ======================================================================

(function () {
  'use strict';

  if (window.__GFG_AUTO_MAIN_V56__) return;
  window.__GFG_AUTO_MAIN_V56__ = true;

  console.log('%c[GFG Auto v5.6.0] Strict Green-Tick Verification Engine Active!', 'color: #22c55e; font-size: 14px; font-weight: bold;');

  const TARGET_SPEED = 2.0;

  // ====================================================================
  // 1. WEB AUDIO KEEP-ALIVE OSCILLATOR (ANTI-BACKGROUND THROTTLE)
  // ====================================================================
  let audioWakeCtx = null;
  function ensureAudioWakeLock() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioWakeCtx || audioWakeCtx.state === 'closed') {
        audioWakeCtx = new AudioCtx();
        const osc = audioWakeCtx.createOscillator();
        const gain = audioWakeCtx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(audioWakeCtx.destination);
        osc.start();
      }
      if (audioWakeCtx.state === 'suspended') {
        audioWakeCtx.resume().catch(() => {});
      }
    } catch (e) {}
  }
  ensureAudioWakeLock();
  setInterval(ensureAudioWakeLock, 2000);

  // ====================================================================
  // 2. VISIBILITY & FOCUS SPOOFING
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

  const SUPPRESSED_EVENTS = [
    'visibilitychange',
    'webkitvisibilitychange',
    'blur',
    'focusout',
    'mouseleave',
    'mouseout',
    'pointerleave',
    'pointerout',
    'lostpointercapture',
    'pagehide',
    'freeze',
    'resume'
  ];

  SUPPRESSED_EVENTS.forEach((evtName) => {
    window.addEventListener(evtName, (e) => e.stopImmediatePropagation(), true);
    document.addEventListener(evtName, (e) => e.stopImmediatePropagation(), true);
  });

  // ====================================================================
  // 3. INTERSECTION OBSERVER PATCH
  // ====================================================================
  try {
    const NativeIntersectionObserver = window.IntersectionObserver;
    if (NativeIntersectionObserver) {
      window.IntersectionObserver = function (callback, options) {
        const wrappedCallback = function (entries, observer) {
          entries.forEach((entry) => {
            try {
              Object.defineProperty(entry, 'intersectionRatio', { value: 1, configurable: true });
              Object.defineProperty(entry, 'isIntersecting', { value: true, configurable: true });
              Object.defineProperty(entry, 'isVisible', { value: true, configurable: true });
            } catch (err) {}
          });
          return callback(entries, observer);
        };
        return new NativeIntersectionObserver(wrappedCallback, options);
      };
      window.IntersectionObserver.prototype = NativeIntersectionObserver.prototype;
      Object.setPrototypeOf(window.IntersectionObserver, NativeIntersectionObserver);
    }
  } catch (e) {}

  // ====================================================================
  // 4. USER ACTIVATION SPOOFING
  // ====================================================================
  try {
    if (window.Navigator && Navigator.prototype) {
      Object.defineProperty(Navigator.prototype, 'userActivation', {
        get() {
          return { hasBeenActive: true, isActive: true };
        },
        configurable: true
      });
    }
  } catch (e) {}

  // ====================================================================
  // 5. REQUEST ANIMATION FRAME BACKGROUND FALLBACK
  // ====================================================================
  try {
    const nativeRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) {
      if (document.hidden) {
        return setTimeout(() => {
          try { cb(performance.now()); } catch (err) {}
        }, 16);
      }
      return nativeRAF.call(window, cb);
    };
  } catch (e) {}

  // ====================================================================
  // 6. HTMLMEDIAELEMENT HOOKS (GUARANTEED 2.0x, MUTED AUTOPLAY, ANTI-PAUSE)
  // ====================================================================
  const origPlay = HTMLMediaElement.prototype.play;
  const origPause = HTMLMediaElement.prototype.pause;

  HTMLMediaElement.prototype.play = function () {
    this.muted = true;
    this.defaultMuted = true;
    this.volume = 0;
    this.playbackRate = TARGET_SPEED;
    return origPlay.apply(this, arguments);
  };

  HTMLMediaElement.prototype.pause = function () {
    if (this.ended || (this.duration && this.currentTime >= this.duration - 0.5)) {
      return origPause.apply(this, arguments);
    }
    console.log('[GFG Auto v5.6] Background pause attempt intercepted.');
  };

  // ====================================================================
  // 7. LOWEST VIDEO QUALITY ENFORCEMENT (240p / Lowest Available)
  // ====================================================================
  let lastQualityCheckTime = 0;
  function enforceLowestQuality() {
    const now = Date.now();
    if (now - lastQualityCheckTime < 2000) return;
    lastQualityCheckTime = now;

    try {
      let settings = {};
      try { settings = JSON.parse(localStorage.getItem('videoPlayerSavedSettings') || '{}'); } catch (e) {}
      settings.gfgVolumebar = 0;
      settings.PlaybackRate = TARGET_SPEED;
      settings.VideoQuality = 240;
      settings.Quality = 240;
      settings.quality = 240;
      settings.videoQuality = 240;
      localStorage.setItem('videoPlayerSavedSettings', JSON.stringify(settings));
      localStorage.setItem('jquality', '240');
    } catch (e) {}

    try {
      const vjs = window.videojs;
      if (vjs) {
        const players = vjs.getAllPlayers ? vjs.getAllPlayers() : Object.values(vjs.getPlayers ? vjs.getPlayers() : {});
        for (const p of players) {
          if (!p) continue;
          if (typeof p.qualityLevels === 'function') {
            const ql = p.qualityLevels();
            if (ql && ql.length > 0) {
              let minH = Infinity, minIdx = 0;
              for (let i = 0; i < ql.length; i++) {
                const h = ql[i].height || ql[i].bandwidth || 999999;
                if (h < minH) { minH = h; minIdx = i; }
              }
              for (let i = 0; i < ql.length; i++) {
                ql[i].enabled = (i === minIdx);
              }
              ql.selectedIndex = minIdx;
            }
          }
          if (p.tech_?.hls?.levels) { p.tech_.hls.currentLevel = 0; }
          if (p.tech_?.hls_?.levels) { p.tech_.hls_.currentLevel = 0; }
        }
      }
    } catch (e) {}

    try {
      const qualityItems = Array.from(document.querySelectorAll('.vjs-menu-item, [role="menuitemradio"], [role="menuitem"], button, span, li')).filter(el => {
        const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
        return (txt === '144p' || txt === '144' || txt === '240p' || txt === '240' || txt === '360p' || txt === '360');
      });
      if (qualityItems.length > 0) {
        qualityItems.sort((a, b) => {
          const valA = parseInt((a.innerText || a.textContent || '').replace(/\D/g, '')) || 9999;
          const valB = parseInt((b.innerText || b.textContent || '').replace(/\D/g, '')) || 9999;
          return valA - valB;
        });
        const lowest = qualityItems[0];
        const isSelected = lowest.classList.contains('vjs-selected') || 
                           lowest.classList.contains('selected') || 
                           lowest.getAttribute('aria-checked') === 'true';
        if (!isSelected) {
          lowest.click();
        }
      }
    } catch (e) {}
  }

  // ====================================================================
  // 8. FLOATING HUD (TOP-RIGHT DOCKED)
  // ====================================================================
  let hudContainer = null;
  let isMinimized = localStorage.getItem('gfg_hud_minimized') === 'true';
  let hudStatusMessage = 'Active (2.0x Muted • 240p)';
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
      hudContainer.style.cssText = 'position: fixed; top: 75px; right: 24px; z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; user-select: none;';
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
      hudContainer.innerHTML = '<div id="gfg-hud-header" style="background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px); border: 1.5px solid #22c55e; border-radius: 9999px; padding: 7px 14px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 8px; cursor: move; color: #f8fafc; font-size: 12px; font-weight: 600;"><span style="width: 8px; height: 8px; border-radius: 50%; background: ' + hudStatusColor + '; display: inline-block;"></span><span>GFG Auto 2.0x</span><button id="gfg-hud-expand-btn" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; padding: 0 2px; line-height: 1;" title="Expand panel">⤢</button></div>';
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
            <span style="font-weight: 800; font-size: 13px; color: #22c55e; letter-spacing: 0.3px;">GFG Auto v5.6</span>
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
  // 9. AUTHORITATIVE SOLID DARK GREEN TICK DETECTION
  // Differentiates with 100% precision:
  // - SOLID DARK GREEN TICK: fill="#2F8D46" circle AND stroke="white" path
  // - HOLLOW CIRCLE (INCOMPLETE): stroke="#2F8D46" with NO fill and NO white path
  // ====================================================================
  function isRowCompleted(row) {
    if (!row) return false;

    // 1. Authoritative SVG Inspection
    const svgs = row.querySelectorAll('svg');
    for (const svg of svgs) {
      const raw = svg.outerHTML.toLowerCase();
      const hasSolidFill = raw.includes('fill="#2f8d46"') || raw.includes("fill='#2f8d46'") || raw.includes('fill="rgb(47, 141, 70)"');
      const hasWhitePath = raw.includes('stroke="white"') || raw.includes("stroke='white'") || 
                           raw.includes('stroke="#ffffff"') || raw.includes('stroke="#fff"') || 
                           raw.includes('stroke="rgb(255, 255, 255)"');

      // STRICT: Must have solid green circle AND white checkmark
      if (hasSolidFill && hasWhitePath) {
        return true;
      }

      // Explicitly reject hollow circles
      if (raw.includes('stroke-width="0.7"') || (raw.includes('stroke="#2f8d46"') && !hasWhitePath)) {
        return false;
      }
    }

    // 2. Image src inspection (Group11(1) = complete, Group11 = incomplete)
    const imgs = row.querySelectorAll('img');
    for (const img of imgs) {
      const src = (img.getAttribute('src') || img.src || '').toLowerCase();
      if (src.includes('group11(1)') || src.includes('group11%281%29')) return true;
      if (src.includes('group11') && !src.includes('(1)') && !src.includes('%281%29')) return false;
    }

    // 3. CSS background-image
    const allDescendants = [row, ...Array.from(row.querySelectorAll('*'))];
    for (const el of allDescendants) {
      try {
        const bg = window.getComputedStyle(el).backgroundImage.toLowerCase();
        if (bg.includes('group11(1)') || bg.includes('group11%281%29')) return true;
        if (bg.includes('group11') && !bg.includes('(1)') && !bg.includes('%281%29')) return false;
      } catch (e) {}
    }

    // 4. React Fiber authoritative props
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
              if (p.isCompleted === true || p.completed === true || p.is_completed === 1) return true;
              if (p.isCompleted === false || p.completed === false || p.is_completed === 0) return false;
              if (p.item) {
                if (p.item.is_completed === 1 || p.item.isCompleted === true || p.item.completed === true) return true;
                if (p.item.is_completed === 0 || p.item.isCompleted === false || p.item.completed === false) return false;
              }
              if (p.video) {
                if (p.video.is_completed === 1 || p.video.isCompleted === true || p.video.completed === true) return true;
                if (p.video.is_completed === 0 || p.video.isCompleted === false || p.video.completed === false) return false;
              }
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
  // 10. SIDEBAR ROW TARGETING
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

  function replayVideoFromBeginning(video) {
    if (!video) return;
    console.log('[GFG Auto v5.6] Resetting to 0:00 to satisfy watch-time...');
    try { video.currentTime = 0; } catch (e) {}
    try {
      video.dispatchEvent(new Event('seeking'));
      video.dispatchEvent(new Event('seeked'));
      video.dispatchEvent(new Event('timeupdate'));
    } catch (e) {}

    video.muted = true;
    video.playbackRate = TARGET_SPEED;
    origPlay.call(video).catch(() => {});
  }

  // ====================================================================
  // 11. ADVANCER (NAVIGATES ONLY TO UNCOMPLETED TARGETS)
  // ====================================================================
  let lastAdvanceTime = 0;

  function advanceToNext() {
    const now = Date.now();
    if (now - lastAdvanceTime < 2500) return;
    lastAdvanceTime = now;

    console.log('[GFG Auto v5.6] Searching for next uncompleted lesson...');

    // 1. Find first uncompleted video in the sidebar
    const uncompleted = findFirstUncompletedVideoRow();
    if (uncompleted) {
      if (!isCurrentVideoRow(uncompleted)) {
        console.log('[GFG Auto v5.6] Advancing to uncompleted lesson:', uncompleted);
        updateHUDStatus('Advancing to next uncompleted lesson...', '#22c55e');
        navigateToRow(uncompleted);
        return;
      } else {
        console.log('[GFG Auto v5.6] Current lesson is still uncompleted.');
        return;
      }
    }

    // 2. All videos in current track have solid green ticks! Advance to Next Track
    console.log('[GFG Auto v5.6] All videos in this track confirmed complete! Advancing to Next Track...');
    updateHUDStatus('Track Complete! Advancing to Next Track...', '#22c55e');

    const allInteractive = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
    const topNext = allInteractive.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return (txt === 'next »' || txt === 'next >>' || txt === 'next >' || txt === 'next ›') && r.top < 240 && r.left > 350;
    });

    if (topNext) {
      console.log('[GFG Auto v5.6] Advancing via Next » button:', topNext);
      clickOrNavigate(topNext);
      return;
    }

    const nextTrackBtn = allInteractive.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return txt.includes('next') && txt.includes('track') && !txt.includes('prev');
    });

    if (nextTrackBtn) {
      console.log('[GFG Auto v5.6] Advancing to Next Track:', nextTrackBtn);
      clickOrNavigate(nextTrackBtn);
      return;
    }

    bypassQuizzesAndProblems();
  }

  function bypassQuizzesAndProblems() {
    console.log('[GFG Auto v5.6] Bypassing non-video module...');
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
        console.log('[GFG Auto v5.6] Advancing to next track link:', a);
        clickOrNavigate(a);
        return;
      }
    }

    const nextBtns = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(el => {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return (txt.includes('next') && txt.includes('track')) || txt === 'go to next track';
    });
    if (nextBtns.length > 0) {
      clickOrNavigate(nextBtns[0]);
    }
  }

  function navigateToRow(row) {
    if (!row) return false;

    try {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}

    const a = row.tagName === 'A' ? row : row.querySelector('a');
    if (a && a.href && !a.href.startsWith('javascript:')) {
      clickOrNavigate(a, a.href);
      return true;
    }

    const target = row.closest('button, a, [role="button"]') || row;
    clickOrNavigate(target);
    return true;
  }

  function clickOrNavigate(el, explicitDestUrl) {
    if (!el) return;
    const target = el.closest('button, a, [role="button"]') || el;
    const anchor = target.tagName === 'A' ? target : target.querySelector('a');
    const dest = explicitDestUrl || anchor?.href;

    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
      try {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      } catch (e) {}
    });
    try { target.click(); } catch (e) {}

    if (dest && window.next?.router?.push) {
      try {
        window.next.router.push(dest);
        return;
      } catch (e) {}
    }

    if (dest && !dest.startsWith('javascript:')) {
      setTimeout(() => {
        if (location.href !== dest) {
          window.location.href = dest;
        }
      }, 3500);
    }
  }

  // ====================================================================
  // 12. CORE AUTOMATION CONTROLLER LOOP
  // ====================================================================
  let currentUrl = location.href;
  let pageLoadCooldownUntil = 0;
  let checkedVideoKey = '';
  let hasCheckedInitialEndFrame = false;
  let completionWaitStartTime = 0;
  let lastCurTime = -1;
  let lastCurTimeUpdate = Date.now();

  function tick() {
    renderHUD();
    enforceLowestQuality();

    // 1. Detect URL changes
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      pageLoadCooldownUntil = Date.now() + 1500;
      lastAdvanceTime = 0;
      checkedVideoKey = '';
      hasCheckedInitialEndFrame = false;
      completionWaitStartTime = 0;
      lastCurTime = -1;
      lastCurTimeUpdate = Date.now();
      console.log('[GFG Auto v5.6] URL changed:', currentUrl);
      updateHUDStatus('Loading new video...', '#22c55e');
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

    // 4. If current video ALREADY HAS SOLID DARK GREEN TICK, skip it immediately!
    if (Date.now() > pageLoadCooldownUntil) {
      if (isCurrentVideoCompleted()) {
        updateHUDStatus('✓ Dark Green Tick Detected! Skipping...', '#22c55e');
        advanceToNext();
        return;
      }
    }

    // 5. Video Player Management (2.0x, Muted Autoplay, Anti-Pause)
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

      video.addEventListener('ratechange', () => {
        if (video.playbackRate !== TARGET_SPEED) {
          video.playbackRate = TARGET_SPEED;
        }
      });

      video.addEventListener('pause', () => {
        if (!video.ended && video.currentTime < (video.duration - 0.5)) {
          video.muted = true;
          video.playbackRate = TARGET_SPEED;
          origPlay.call(video).catch(() => {});
        }
      });
    }

    // Auto-dismiss big play button if present
    const bigPlay = document.querySelector('.vjs-big-play-button, .play-button, button.vjs-play-control, [aria-label*="play" i], [title*="play" i]');
    if (bigPlay && video.paused && !video.ended) {
      try { bigPlay.click(); } catch (e) {}
    }

    // Ensure 2.0x and muted are locked
    if (video.playbackRate !== TARGET_SPEED) {
      video.playbackRate = TARGET_SPEED;
    }
    if (!video.muted) {
      video.muted = true;
    }

    // Autoplay watchdog: if paused, immediately restart
    if (video.paused && !video.ended) {
      origPlay.call(video).catch(() => {});
    }

    // Live Playing Status
    if (video.duration > 0 && !video.paused) {
      updateHUDStatus('▶ Playing at 2.0x (Muted • 240p)', '#22c55e');
    }

    // ==================================================================
    // 6. STRICT DARK GREEN TICK VERIFICATION & COMPLETION HANDLER
    // NEVER assumes completed just because playback finished!
    // Waits for GFG to award the solid dark green tick!
    // ==================================================================
    const isAtEnd = video.ended || (video.duration > 3 && video.currentTime >= video.duration - 0.5);
    if (isAtEnd && (video.currentTime > 2 || video.ended)) {
      if (!completionWaitStartTime) {
        completionWaitStartTime = Date.now();
        console.log('[GFG Auto v5.6] Video playback completed. Waiting for GFG solid dark green tick...');
      }

      // Check if GFG has officially marked the solid dark green tick on the sidebar
      if (isCurrentVideoCompleted()) {
        console.log('[GFG Auto v5.6] ✓ Solid dark green tick CONFIRMED by GFG! Advancing...');
        updateHUDStatus('✓ Dark Green Tick Confirmed! Advancing...', '#22c55e');
        completionWaitStartTime = 0;
        advanceToNext();
        return;
      }

      const waitElapsed = (Date.now() - completionWaitStartTime) / 1000;
      updateHUDStatus(`⏳ Waiting for GFG Green Tick (${waitElapsed.toFixed(0)}s)...`, '#eab308');

      // If after 8 seconds GFG still has NOT marked it complete with the green tick:
      // Watch-time was not satisfied or dropped! Do NOT skip! Replay from 0:00!
      if (waitElapsed > 8) {
        console.log('[GFG Auto v5.6] GFG green tick NOT detected after 8s! Replaying from 0:00 to satisfy watch-time...');
        updateHUDStatus('↺ No Green Tick: Replaying from 0:00...', '#eab308');
        completionWaitStartTime = 0;
        replayVideoFromBeginning(video);
        return;
      }
      return;
    } else {
      completionWaitStartTime = 0;
    }
  }

  // ====================================================================
  // 13. UNTHROTTLED PULSE ENGINE
  // ====================================================================
  window.addEventListener('message', (e) => {
    if (e.data?.source === 'gfg_isolated_pulse') {
      tick();
    }
  });

  try {
    const blob = new Blob(["setInterval(() => postMessage('tick'), 500);"], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => tick();
  } catch (e) {}

  setInterval(tick, 500);
})();
