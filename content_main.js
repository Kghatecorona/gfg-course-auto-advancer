// ======================================================================
// GFG Course Auto-Advancer - Main World Execution Script (v5.1.0)
// Runs directly in the webpage context (world: "MAIN")
// 1. Permanently spoofs visibilityState & hasFocus for all GFG scripts
// 2. Intercepts blur and visibilitychange events so GFG never detects inactive tab
// 3. Hooks HTMLMediaElement to suppress auto-pauses and enforce 2x muted playback
// 4. Infallible Green Tick Detection (SVG assets, stroke/fill, React Fiber)
// 5. Automatic navigation via Next.js router / DOM links
// 6. Receives 1-second unthrottled pulses from Background Service Worker
// ======================================================================

(function () {
  'use strict';

  if (window.__GFG_AUTO_MAIN_V51__) return;
  window.__GFG_AUTO_MAIN_V51__ = true;

  console.log('%c[GFG Auto v5.1.0] Main World Engine Active!', 'color: #22c55e; font-size: 14px; font-weight: bold;');

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

  // Intercept and swallow blur, focusout, and visibilitychange in capturing phase
  ['visibilitychange', 'blur', 'focusout'].forEach((evtName) => {
    window.addEventListener(evtName, (e) => e.stopImmediatePropagation(), true);
    document.addEventListener(evtName, (e) => e.stopImmediatePropagation(), true);
  });

  // ====================================================================
  // 2. HTMLMEDIAELEMENT HOOKS (ENFORCE 2.0x, MUTED, AND ANTI-PAUSE)
  // ====================================================================
  const origPlay = HTMLMediaElement.prototype.play;
  const origPause = HTMLMediaElement.prototype.pause;

  HTMLMediaElement.prototype.play = function () {
    this.muted = true;
    this.defaultMuted = true;
    this.volume = 0;
    this.playbackRate = 2.0;
    return origPlay.apply(this, arguments);
  };

  // Block automated background pause calls when video is playing mid-lecture
  HTMLMediaElement.prototype.pause = function () {
    if (this.ended || (this.duration && this.currentTime >= this.duration - 0.5)) {
      return origPause.apply(this, arguments);
    }
    // If GFG or browser tries to pause in the background, ignore it!
    console.log('[GFG Auto v5.1.0] Background pause suppressed. Keeping video playing.');
  };

  // ====================================================================
  // 3. GREEN TICK DETECTION ENGINE (100% CERTAINTY)
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

      // Check for white checkmark stroke (completed solid green tick has stroke="white")
      const paths = svg.querySelectorAll('path');
      for (const p of paths) {
        const stroke = (p.getAttribute('stroke') || p.style.stroke || '').toLowerCase();
        if (stroke === 'white' || stroke === '#fff' || stroke === '#ffffff' || stroke === 'rgb(255, 255, 255)') {
          return true;
        }
      }

      // Check for filled green circle (#2F8D46)
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

    // 4. Coordinate Element Sampling (right edge tick icon)
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
  // 4. SIDEBAR NAVIGATION & PLAYLIST DISCOVERY
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
  // 5. REPLAY GLITCHED END-FRAME VIDEOS FROM 0:00
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
    console.log('[GFG Auto v5.1.0] Glitched end-frame video detected! Resetting to 0:00...');
    try { video.currentTime = 0; } catch (e) {}
    try {
      video.dispatchEvent(new Event('seeking'));
      video.dispatchEvent(new Event('seeked'));
      video.dispatchEvent(new Event('timeupdate'));
    } catch (e) {}

    clickPlayerRestartButton();

    video.muted = true;
    video.volume = 0;
    video.playbackRate = 2.0;
    origPlay.call(video).catch(() => {});
  }

  // ====================================================================
  // 6. ADVANCER & NAVIGATION (SPA + DOM)
  // ====================================================================
  let lastAdvanceTime = 0;

  function advanceToNext() {
    const now = Date.now();
    if (now - lastAdvanceTime < 2500) return;
    lastAdvanceTime = now;

    console.log('[GFG Auto v5.1.0] Advancing to next target...');

    const uncompleted = findFirstUncompletedVideoRow();
    const allRows = getSidebarVideoRows();
    const currentIdx = allRows.findIndex(r => isCurrentVideoRow(r));

    // 1. Revisit missed uncompleted video earlier in track
    if (uncompleted && currentIdx !== -1) {
      const uncompletedIdx = allRows.indexOf(uncompleted);
      if (uncompletedIdx < currentIdx) {
        console.log('[GFG Auto v5.1.0] Revisiting missed uncompleted video:', uncompleted);
        navigateToRow(uncompleted);
        return;
      }
    }

    // 2. Direct jump to next uncompleted video
    if (uncompleted && !isCurrentVideoRow(uncompleted)) {
      console.log('[GFG Auto v5.1.0] Jumping directly to uncompleted video:', uncompleted);
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
      console.log('[GFG Auto v5.1.0] Advancing to Next Track button:', nextTrackBtn);
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
      console.log('[GFG Auto v5.1.0] Advancing via Top-Right Next button:', btn);
      clickTarget(btn);
      return;
    }

    // 5. Bypass Quizzes / Problems to Next Track
    bypassQuizzesAndProblems();
  }

  function bypassQuizzesAndProblems() {
    console.log('[GFG Auto v5.1.0] Bypassing non-video module...');

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
        console.log('[GFG Auto v5.1.0] Advancing to next track link:', a);
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
      // If client-side router didn't transition within 1.5s, trigger Next.js router or navigate
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
  // 7. CORE AUTOMATION CONTROLLER LOOP
  // ====================================================================
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
      console.log('[GFG Auto v5.1.0] URL changed:', currentUrl);
      return;
    }

    // 2. Standby if not on a course track
    if (!location.pathname.includes('/track/')) {
      return;
    }

    // 3. Skip non-video pages (Quiz, Problem, Contest, Assignment)
    const isNonVideoPage = location.pathname.includes('/quiz/') || 
                           location.pathname.includes('/problem/') || 
                           location.pathname.includes('/contest/') || 
                           location.pathname.includes('/assignment/');
    if (isNonVideoPage) {
      console.log('[GFG Auto v5.1.0] Non-video page detected. Skipping to Next Track...');
      bypassQuizzesAndProblems();
      return;
    }

    // 4. If current video is ALREADY COMPLETED (solid green tick), skip immediately!
    if (Date.now() > pageLoadCooldownUntil) {
      if (isCurrentVideoCompleted()) {
        console.log('[GFG Auto v5.1.0] Video is already completed (solid green tick). Skipping immediately!');
        advanceToNext();
        return;
      }
    }

    // 5. Video Player Management (2.0x, Muted, Continuous Autoplay)
    const video = document.querySelector('video');
    if (!video) {
      const bodyText = (document.body?.innerText || '').toLowerCase();
      if (bodyText.includes('go to problems') || bodyText.includes('solve problems') || bodyText.includes('start quiz')) {
        bypassQuizzesAndProblems();
      }
      return;
    }

    // Attach pause-prevention listener to video directly
    if (!video.__gfg_anti_pause_set__) {
      video.__gfg_anti_pause_set__ = true;
      video.addEventListener('pause', () => {
        if (!video.ended && video.currentTime < (video.duration - 0.5)) {
          setTimeout(() => {
            video.muted = true;
            video.volume = 0;
            video.playbackRate = 2.0;
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
          replayVideoFromBeginning(video);
          return;
        }
      }
      hasCheckedInitialEndFrame = true;
    }

    // Lock 2.0x playback rate and muted audio
    if (video.playbackRate !== 2.0) video.playbackRate = 2.0;
    if (!video.muted) video.muted = true;
    if (video.volume !== 0) video.volume = 0;

    // Autoplay if paused in the background
    if (video.paused && !video.ended) {
      origPlay.call(video).catch(() => {});
    }

    // 6. Video Completion Check
    const isFinished = video.ended || (video.duration > 5 && video.currentTime >= video.duration - 0.5);
    if (isFinished && hasCheckedInitialEndFrame) {
      console.log('[GFG Auto v5.1.0] Video completed! Advancing in 1.2s...');
      setTimeout(() => {
        advanceToNext();
      }, 1200);
      return;
    }
  }

  // ====================================================================
  // 8. UNTHROTTLED PULSE LISTENERS
  // ====================================================================
  // 1. Receive 1-second pulse from Isolated World Bridge (connected to Service Worker)
  window.addEventListener('message', (e) => {
    if (e.data?.source === 'gfg_isolated_pulse') {
      tick();
    }
  });

  // 2. Web Worker pulse loop (unthrottled timer in background)
  try {
    const blob = new Blob(["setInterval(() => postMessage('tick'), 1000);"], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => tick();
  } catch (e) {}

  // 3. Fallback interval
  setInterval(tick, 1000);
})();
