// ======================================================================
// GFG Course Auto-Advancer - Content Script (v5.0.0)
// Features:
// 1. Bulletproof Green Tick Detection (SVG assets, stroke/fill, React Fiber)
// 2. Auto-advances to next uncompleted video (skips already watched videos)
// 3. Revisits and replays glitched uncompleted videos from 0:00
// 4. Bypasses Quizzes, Problems, and non-video lessons to Next Track
// 5. Enforces 2.0x speed and muted audio silently without HUD buttons
// 6. Seamless background execution across virtual desktops and minimized tabs
// ======================================================================

(function () {
  'use strict';

  if (window.__GFG_AUTO_ADVANCER_V5__) return;
  window.__GFG_AUTO_ADVANCER_V5__ = true;

  console.log('%c[GFG Auto v5.0] Core Advancer Initialized', 'color: #22c55e; font-size: 14px; font-weight: bold;');

  // ====================================================================
  // 1. BACKGROUND KEEP-ALIVE & VIRTUAL DESKTOP PROTECTION
  // ====================================================================
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
    const origAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === 'blur' || type === 'focusout') return;
      if (type === 'visibilitychange') {
        const wrapped = function (e) {
          if (document.hidden) return;
          return listener.apply(this, arguments);
        };
        return origAddEventListener.call(this, type, wrapped, options);
      }
      return origAddEventListener.call(this, type, listener, options);
    };
  } catch (e) {}

  // Web Audio silent oscillator to maintain high tab execution priority in Chrome
  let audioCtx = null;
  function ensureAudioKeepAlive() {
    if (audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.00001; // virtually inaudible
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
      }
    } catch (e) {}
  }

  // Wake lock
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

  // ====================================================================
  // 2. GREEN TICK DETECTION ENGINE (100% CERTAINTY)
  // ====================================================================
  // Official GFG assets:
  // Incomplete: https://media.geeksforgeeks.org/img-practice/Group11-1667280519.svg (hollow circle, green path)
  // Completed:  https://media.geeksforgeeks.org/img-practice/Group11(1)-1667280599.svg (solid green circle, white path)

  function isRowCompleted(row) {
    if (!row) return false;

    // Check 1: Image src & attributes
    const imgs = row.querySelectorAll('img');
    for (const img of imgs) {
      const src = (img.getAttribute('src') || img.src || '').toLowerCase();
      if (src.includes('group11(1)') || src.includes('group11%281%29')) {
        return true;
      }
      if (src.includes('group11') && !src.includes('(1)') && !src.includes('%281%29')) {
        return false;
      }
    }

    // Check 2: CSS background-image
    const bgElements = [row, ...Array.from(row.querySelectorAll('*'))];
    for (const el of bgElements) {
      try {
        const bg = window.getComputedStyle(el).backgroundImage.toLowerCase();
        if (bg.includes('group11(1)') || bg.includes('group11%281%29')) {
          return true;
        }
        if (bg.includes('group11') && !bg.includes('(1)') && !bg.includes('%281%29')) {
          return false;
        }
      } catch (e) {}
    }

    // Check 3: Inline SVG markup analysis
    const svgs = row.querySelectorAll('svg');
    for (const svg of svgs) {
      const rawHtml = svg.outerHTML.toLowerCase();

      // Check for white stroke checkmark path (solid completed tick has stroke="white" or #fff)
      const paths = svg.querySelectorAll('path');
      for (const p of paths) {
        const stroke = (p.getAttribute('stroke') || p.style.stroke || '').toLowerCase();
        if (stroke === 'white' || stroke === '#fff' || stroke === '#ffffff' || stroke === 'rgb(255, 255, 255)') {
          return true;
        }
      }

      // Check for solid green circle fill (#2F8D46)
      const circles = svg.querySelectorAll('circle');
      for (const c of circles) {
        const fill = (c.getAttribute('fill') || c.style.fill || '').toLowerCase();
        if (fill === '#2f8d46' || fill === 'rgb(47, 141, 70)') {
          return true;
        }
      }

      // String pattern matching inside SVG
      if (rawHtml.includes('stroke="white"') || rawHtml.includes("stroke='white'") ||
          rawHtml.includes('stroke="#ffffff"') || rawHtml.includes('stroke="#fff"') ||
          rawHtml.includes('fill="#2f8d46"') || rawHtml.includes('rgb(47, 141, 70)')) {
        return true;
      }
    }

    // Check 4: Coordinate Element Sampling (right edge checkmark)
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

    // Check 5: React Fiber Props (isCompleted / status)
    try {
      let curr = row;
      let depth = 0;
      while (curr && depth < 5) {
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
  // 3. SIDEBAR NAVIGATION & ROW SELECTORS
  // ====================================================================
  function getSidebarVideoRows() {
    const all = Array.from(document.querySelectorAll('*'));
    const maxSidebarX = Math.max(400, window.innerWidth * 0.48);

    // Find leaf nodes containing "Duration:" in sidebar
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

    // Fallback: links with /video/ in sidebar
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

    // 1. Check URL matching
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

    // 2. Check active/highlight classes
    const cls = (typeof row.className === 'string' ? row.className : (row.className?.baseVal || '')).toLowerCase();
    if (cls.includes('active') || cls.includes('selected') || cls.includes('highlight')) return true;
    if (row.querySelector('.active, [aria-current="page"], [aria-selected="true"]')) return true;

    // 3. Match title text against player heading
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
  // 4. REPLAY & SCRUBBER RESET FOR GLITCHED END-FRAMES
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
    console.log('[GFG Auto v5.0] Glitched end-frame on uncompleted video! Rewinding to 0:00...');
    try { video.currentTime = 0; } catch (e) {}
    try {
      video.dispatchEvent(new Event('seeking'));
      video.dispatchEvent(new Event('seeked'));
      video.dispatchEvent(new Event('timeupdate'));
    } catch (e) {}

    resetScrubberToStart();
    clickPlayerRestartButton();

    video.muted = true;
    video.volume = 0;
    video.playbackRate = 2.0;
    video.play().catch(() => {});
  }

  // ====================================================================
  // 5. ADVANCER ENGINE & QUIZ/PROBLEM BYPASS
  // ====================================================================
  let lastAdvanceTime = 0;

  function advanceToNext() {
    const now = Date.now();
    if (now - lastAdvanceTime < 2500) return;
    lastAdvanceTime = now;

    console.log('[GFG Auto v5.0] Advancing to next lesson...');

    const uncompleted = findFirstUncompletedVideoRow();
    const allRows = getSidebarVideoRows();
    const currentIdx = allRows.findIndex(r => isCurrentVideoRow(r));

    // 1. Revisit earlier uncompleted video in current track (if missed)
    if (uncompleted && currentIdx !== -1) {
      const uncompletedIdx = allRows.indexOf(uncompleted);
      if (uncompletedIdx < currentIdx) {
        console.log('[GFG Auto v5.0] Revisiting missed uncompleted video:', uncompleted);
        navigateToRow(uncompleted);
        return;
      }
    }

    // 2. Direct jump to next uncompleted video
    if (uncompleted && !isCurrentVideoRow(uncompleted)) {
      console.log('[GFG Auto v5.0] Jumping to next uncompleted video:', uncompleted);
      navigateToRow(uncompleted);
      return;
    }

    // 3. Bypass: Check for non-video prompts like "Go to Problems", "Solve Problems", "Quiz"
    // If found, immediately bypass to "Next Track"
    const allInteractive = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));

    // Check for "Next Track"
    const nextTrackBtn = allInteractive.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return txt.includes('next') && txt.includes('track') && !txt.includes('prev');
    });

    if (nextTrackBtn) {
      console.log('[GFG Auto v5.0] Clicking Next Track button:', nextTrackBtn);
      clickTarget(nextTrackBtn);
      return;
    }

    // 4. Click Top-Right "Next »" button (only if it doesn't lead to a problem or quiz)
    const topNext = allInteractive.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      const isNext = txt === 'next' || txt === 'next »' || txt === 'next >>' || txt === 'next >' || txt === 'next ›';
      return isNext && r.top < 220 && r.left > 350;
    });

    if (topNext) {
      const btn = topNext.closest('button, a, [role="button"]') || topNext;
      console.log('[GFG Auto v5.0] Advancing via top-right Next button:', btn);
      clickTarget(btn);
      return;
    }

    // 5. If on Quiz/Problem page or stuck at end of track, find next track accordion in sidebar
    bypassQuizzesAndProblems();
  }

  function bypassQuizzesAndProblems() {
    console.log('[GFG Auto v5.0] Bypassing non-video module / advancing track...');

    // Look for any link or accordion to the next track in the sidebar
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
        // Found the next track link!
        console.log('[GFG Auto v5.0] Bypassing to next track link:', a);
        clickTarget(a);
        return;
      }
    }

    // Check for general Next Track buttons anywhere
    const nextBtns = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(el => {
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return (txt.includes('next') && txt.includes('track')) || txt === 'go to next track';
    });
    if (nextBtns.length > 0) {
      console.log('[GFG Auto v5.0] Clicking Next Track fallback button:', nextBtns[0]);
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
      }, 1000);
    }
  }

  // ====================================================================
  // 6. MAIN CONTROLLER LOOP & AUTOMATION
  // ====================================================================
  let currentUrl = location.href;
  let pageLoadCooldownUntil = 0;
  let checkedVideoKey = '';
  let hasCheckedInitialEndFrame = false;

  function tick() {
    ensureAudioKeepAlive();

    // 1. Detect URL changes
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      pageLoadCooldownUntil = Date.now() + 1500;
      lastAdvanceTime = 0;
      checkedVideoKey = '';
      hasCheckedInitialEndFrame = false;
      console.log('[GFG Auto v5.0] URL changed to:', currentUrl);
      return;
    }

    // 2. Standby if not on course track
    if (!location.pathname.includes('/track/')) {
      return;
    }

    // 3. Skip Quiz, Problem, Contest, or Assignment pages immediately
    const isNonVideoPage = location.pathname.includes('/quiz/') || 
                           location.pathname.includes('/problem/') || 
                           location.pathname.includes('/contest/') || 
                           location.pathname.includes('/assignment/');
    if (isNonVideoPage) {
      console.log('[GFG Auto v5.0] Non-video module detected (Quiz/Problem). Bypassing to Next Track...');
      bypassQuizzesAndProblems();
      return;
    }

    // 4. Feature: If current video is ALREADY completed (solid green tick), skip immediately!
    if (Date.now() > pageLoadCooldownUntil) {
      if (isCurrentVideoCompleted()) {
        console.log('[GFG Auto v5.0] Current video is ALREADY COMPLETED (solid green tick). Skipping immediately!');
        advanceToNext();
        return;
      }
    }

    // 5. Video Player Management (Silent 2.0x & Muted)
    const video = document.querySelector('video');
    if (!video) {
      // If no video exists on a track page, check if page contains "Go to Problems", "Solve Problems", "Take Quiz"
      const bodyText = (document.body?.innerText || '').toLowerCase();
      if (bodyText.includes('go to problems') || bodyText.includes('solve problems') || bodyText.includes('start quiz')) {
        bypassQuizzesAndProblems();
      }
      return;
    }

    // Hook video events to lock 2.0x and muted
    if (!video.__gfg_events_hooked__) {
      video.__gfg_events_hooked__ = true;
      video.addEventListener('ratechange', () => {
        if (video.playbackRate !== 2.0) video.playbackRate = 2.0;
      });
      video.addEventListener('volumechange', () => {
        if (!video.muted) video.muted = true;
        if (video.volume !== 0) video.volume = 0;
      });
    }

    // Feature: Replay from 0:00 if an UNCOMPLETED video starts at glitched end frame
    const videoKey = location.href + '#' + (video.currentSrc || video.src || '');
    if (checkedVideoKey !== videoKey) {
      checkedVideoKey = videoKey;
      hasCheckedInitialEndFrame = false;
    }

    if (!hasCheckedInitialEndFrame && video.duration > 5) {
      // ONLY replay if the video is NOT already completed
      if (!isCurrentVideoCompleted()) {
        if (video.currentTime >= video.duration - 3 || video.ended) {
          hasCheckedInitialEndFrame = true;
          replayVideoFromBeginning(video);
          return;
        }
      }
      hasCheckedInitialEndFrame = true;
    }

    // Enforce 2.0x and Muted continuously
    if (video.playbackRate !== 2.0) {
      video.playbackRate = 2.0;
    }
    if (!video.muted) {
      video.muted = true;
    }
    if (video.volume !== 0) {
      video.volume = 0;
    }

    // Autoplay if paused
    if (video.paused && !video.ended) {
      video.play().catch(() => {});
    }

    // 6. Video Completion Detection
    const isFinished = video.ended || (video.duration > 5 && video.currentTime >= video.duration - 0.5);
    if (isFinished && hasCheckedInitialEndFrame) {
      console.log('[GFG Auto v5.0] Video reached natural finish. Advancing in 1.2s...');
      setTimeout(() => {
        advanceToNext();
      }, 1200);
      return;
    }
  }

  // ====================================================================
  // 7. BACKGROUND UNTHROTTLED PULSE ENGINE
  // ====================================================================
  // 1. Chrome background worker pulse listener
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.action === 'PULSE') {
          tick();
        }
      });
    }
  } catch (e) {}

  // 2. Unthrottled Web Worker timer (runs at full speed in background & other virtual desktops)
  try {
    const blob = new Blob(["setInterval(() => postMessage('tick'), 1000);"], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => tick();
  } catch (e) {}

  // 3. Fallback standard interval
  setInterval(tick, 1000);
})();
