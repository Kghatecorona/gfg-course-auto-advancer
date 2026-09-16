// ==UserScript==
// @name         GFG Course Auto-Advancer (v3.5 - Auto Next Track & Problems/Quiz Skip)
// @namespace    https://geeksforgeeks.org/
// @version      3.5
// @description  Automates GFG courses at 2x. Automatically skips 'Go to Problems' and Quizzes to jump straight to Next Track, fixes cooldown stalls, and auto-plays videos continuously.
// @author       Kavyansh
// @match        https://*.geeksforgeeks.org/batch/*
// @match        https://geeksforgeeks.org/batch/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  if (window.__gfg_auto_advancer_v35_active) {
    console.log('[GFG Auto v3.5] Script already active!');
    return;
  }
  window.__gfg_auto_advancer_v35_active = true;

  // ----------------------------------------------------------------------
  // 1. BACKGROUND TRACKING SPOOFS (hasFocus, Visibility, rAF, IntersectionObserver)
  // Ensures GFG keeps counting watch time when on another desktop or background tab
  // ----------------------------------------------------------------------
  function applyBackgroundSpoofs() {
    // 1.1 document.hasFocus() always returns true (prevents GFG from pausing tracking)
    try {
      Document.prototype.hasFocus = function () { return true; };
      document.hasFocus = function () { return true; };
    } catch (e) {}

    // 1.2 Page Visibility API: always visible
    try {
      Object.defineProperty(Document.prototype, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible', configurable: true });
      Object.defineProperty(Document.prototype, 'webkitHidden', { get: () => false, configurable: true });
      Object.defineProperty(Document.prototype, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    } catch (e) {}

    // 1.3 Neutralize blur & focusout property handlers
    try {
      Object.defineProperty(window, 'onblur', { get: () => null, set: () => {}, configurable: true });
      Object.defineProperty(document, 'onblur', { get: () => null, set: () => {}, configurable: true });
    } catch (e) {}

    // 1.4 Intercept addEventListener to drop blur/focusout and filter visibilitychange
    try {
      const origAdd = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (type === 'blur' || type === 'focusout') {
          return; // Ignore blur listeners that pause GFG tracking
        }
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

    // 1.5 Spoof IntersectionObserver so GFG player always thinks video is visible in viewport
    try {
      const OrigIO = window.IntersectionObserver;
      if (OrigIO && !window.__gfg_io_v35_patched) {
        window.__gfg_io_v35_patched = true;
        window.IntersectionObserver = function (callback, options) {
          const wrappedCallback = (entries, observer) => {
            const spoofed = entries.map(entry => {
              if (!entry.isIntersecting) {
                return new Proxy(entry, {
                  get(target, prop) {
                    if (prop === 'isIntersecting') return true;
                    if (prop === 'intersectionRatio') return 1;
                    return Reflect.get(target, prop);
                  }
                });
              }
              return entry;
            });
            return callback(spoofed, observer);
          };
          return new OrigIO(wrappedCallback, options);
        };
        window.IntersectionObserver.prototype = OrigIO.prototype;
      }
    } catch (e) {}

    // 1.6 Unfreeze requestAnimationFrame in background tabs
    try {
      const origRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = function (callback) {
        let executed = false;
        const id = origRAF((timestamp) => {
          executed = true;
          callback(timestamp);
        });
        setTimeout(() => {
          if (!executed) {
            callback(performance.now());
          }
        }, 40);
        return id;
      };
    } catch (e) {}
  }
  applyBackgroundSpoofs();

  // Screen Wake Lock so computer doesn't sleep
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) await navigator.wakeLock.request('screen');
    } catch (e) {}
  }
  requestWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });

  // Periodically pulse synthetic timeupdate & focus to ensure React updates sidebar
  setInterval(() => {
    try {
      const v = document.querySelector('video');
      if (v && !v.paused) {
        v.dispatchEvent(new Event('timeupdate', { bubbles: true }));
        v.dispatchEvent(new Event('progress', { bubbles: true }));
      }
      window.dispatchEvent(new Event('focus'));
    } catch (e) {}
  }, 2000);

  // ----------------------------------------------------------------------
  // 2. SOLID DARK-GREEN CHECKMARK DETECTOR
  // ----------------------------------------------------------------------
  function isSolidDarkGreen(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return false;
    const s = colorStr.toLowerCase().trim();

    if (s === '#2f8d46' || s === '#318e48' || s === '#308e47' || s === '#308d47') return true;

    const rgbMatch = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      return r < 85 && g >= 115 && b < 105 && (g - r) >= 40 && (g - b) >= 40;
    }

    const hexMatch = s.match(/#([0-9a-f]{6})/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return r < 85 && g >= 115 && b < 105 && (g - r) >= 40 && (g - b) >= 40;
    }

    return false;
  }

  function isElementTicked(el) {
    if (!el) return false;

    const cls = (el.className?.baseVal || el.className || '').toString().toLowerCase();
    if (cls.includes('completed') || cls.includes('watched') || cls.includes('done')) return true;

    const candidates = [el, ...Array.from(el.querySelectorAll('svg, path, circle, i, span, div'))];
    for (const c of candidates) {
      try {
        const rect = c.getBoundingClientRect();
        if (rect.width >= 8 && rect.width <= 36 && rect.height >= 8 && rect.height <= 36) {
          const style = window.getComputedStyle(c);
          if (isSolidDarkGreen(style.backgroundColor) || 
              isSolidDarkGreen(style.fill) || 
              isSolidDarkGreen(style.color) || 
              isSolidDarkGreen(style.stroke)) {
            return true;
          }
        }
      } catch (e) {}

      const fill = c.getAttribute?.('fill') || '';
      const stroke = c.getAttribute?.('stroke') || '';
      if (isSolidDarkGreen(fill) || isSolidDarkGreen(stroke)) return true;

      const aria = (c.getAttribute?.('aria-label') || '').toLowerCase();
      const title = (c.getAttribute?.('title') || '').toLowerCase();
      if (aria.includes('complete') || aria.includes('watched') || title.includes('complete') || title.includes('watched')) {
        return true;
      }
    }

    return false;
  }

  function getAllSidebarVideoRows() {
    const allElements = Array.from(document.querySelectorAll('*'));
    const sidebarDurationNodes = allElements.filter(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.left > 360) return false;
      const txt = (el.innerText || el.textContent || '').trim();
      return txt.startsWith('Duration:');
    });

    const rows = [];
    for (const dNode of sidebarDurationNodes) {
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

  function isCurrentVideoCompletedInSidebar() {
    const mainTitle = (document.querySelector('h1, h2, div[class*="video-title"]') || {}).textContent || '';
    const cleanTitle = mainTitle.trim().toLowerCase();
    const rows = getAllSidebarVideoRows();

    for (const row of rows) {
      const rowText = (row.innerText || row.textContent || '').toLowerCase();
      const isCurrent = (cleanTitle.length > 3 && rowText.includes(cleanTitle)) ||
                        row.className?.includes?.('active') ||
                        row.className?.includes?.('selected');
      if (isCurrent && isElementTicked(row)) {
        return true;
      }
    }

    return false;
  }

  function findFirstUntickedVideoInSidebar() {
    const rows = getAllSidebarVideoRows();
    for (const row of rows) {
      if (!isElementTicked(row)) {
        return row;
      }
    }
    return null;
  }

  // ----------------------------------------------------------------------
  // 3. NAVIGATION TARGET LOCATOR
  // ----------------------------------------------------------------------
  function findNextTrackButton() {
    const all = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"], div, span'));
    const found = all.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return txt.includes('next') && txt.includes('track') && !txt.includes('prev');
    });
    if (!found) return null;
    return found.closest('button, a, [role="button"]') || found;
  }

  function findGFGNextButton() {
    const all = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));

    // Top-right button above video player
    const topBtn = all.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      const isNextOrProblems = (text === 'next' || text === 'next »' || text === 'next >>' || text === 'next >' || text.includes('problem'));
      return isNextOrProblems && r.top < 200 && r.left > 400;
    });
    if (topBtn) return topBtn;

    // Any exact Next » button
    const exactNext = all.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return (text === 'next' || text === 'next »' || text === 'next >>' || text === 'next >');
    });
    if (exactNext) return exactNext;

    return null;
  }

  function clickElement(target) {
    if (!target) return;
    
    // Dispatch synthetic mouse sequence
    ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(evtType => {
      try {
        target.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window }));
      } catch (e) {}
    });
    try { target.click(); } catch (e) {}

    // Safe fallback navigation: NEVER navigate to current page URL (prevents reload loop)
    const anchor = target.tagName === 'A' ? target : (target.querySelector('a') || target.closest('a'));
    const destUrl = anchor?.href;
    if (destUrl && destUrl !== location.href && !destUrl.startsWith('javascript:')) {
      const startUrl = location.href;
      setTimeout(() => {
        if (location.href === startUrl && destUrl !== location.href) {
          console.log('[GFG Auto v3.5] Direct navigation fallback to:', destUrl);
          window.location.href = destUrl;
        }
      }, 1500);
    }
  }

  // ----------------------------------------------------------------------
  // 4. FLOATING HUD USER INTERFACE
  // ----------------------------------------------------------------------
  let targetSpeed = 2.0;
  let isMuted = true;
  let isPaused = false;
  let completedCount = 0;

  let navigationCooldownUntil = 0;
  let activeVideoKey = '';
  let waitingForCredit = false;
  let creditDeadline = 0;
  let lastUrl = location.href;

  let nonVideoPageTicks = 0;
  let isQuizSkipping = false;
  let quizSkipDeadline = 0;

  let isSkippingAlreadyWatched = false;
  let alreadyWatchedSkipDeadline = 0;

  let endFrameTicks = 0;

  function createHUD() {
    if (document.getElementById('gfg-auto-hud')) return;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', createHUD, { once: true });
      return;
    }

    const hud = document.createElement('div');
    hud.id = 'gfg-auto-hud';
    hud.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999999;
      background: rgba(15, 23, 42, 0.95);
      color: #f8fafc;
      padding: 13px 17px;
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      min-width: 295px;
      border: 1px solid #38bdf8;
      backdrop-filter: blur(8px);
    `;

    hud.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 6px;">
        <span style="font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
          <span id="gfg-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
          GFG Auto-Advancer v3.5
        </span>
        <span id="gfg-badge-count" style="background: #1e293b; color: #38bdf8; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 600;">
          Done: 0
        </span>
      </div>
      
      <div id="gfg-status-msg" style="color: #cbd5e1; margin-bottom: 10px; font-size: 12px; min-height: 28px;">
        Initializing auto-player...
      </div>
      
      <div style="display: flex; gap: 5px; align-items: center; justify-content: space-between;">
        <div style="display: flex; gap: 4px;">
          <button id="gfg-btn-spd" style="background: #0284c7; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">2.0x</button>
          <button id="gfg-btn-vol" style="background: #334155; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 11px;">🔇 Muted</button>
          <button id="gfg-btn-skip" style="background: #eab308; color: #0f172a; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;" title="Skip current video/quiz immediately">⏩ Skip</button>
        </div>
        <button id="gfg-btn-state" style="background: #22c55e; color: white; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">Running</button>
      </div>
    `;
    document.body.appendChild(hud);

    document.getElementById('gfg-btn-spd').addEventListener('click', () => {
      targetSpeed = targetSpeed === 2.0 ? 1.0 : 2.0;
      document.getElementById('gfg-btn-spd').innerText = `${targetSpeed}x`;
      const v = document.querySelector('video');
      if (v) v.playbackRate = targetSpeed;
    });

    document.getElementById('gfg-btn-vol').addEventListener('click', () => {
      isMuted = !isMuted;
      document.getElementById('gfg-btn-vol').innerText = isMuted ? '🔇 Muted' : '🔊 Sound';
      const v = document.querySelector('video');
      if (v) v.muted = isMuted;
    });

    document.getElementById('gfg-btn-skip').addEventListener('click', () => {
      setStatus('Manual Skip triggered! Advancing...', '#eab308');
      waitingForCredit = false;
      isQuizSkipping = false;
      isSkippingAlreadyWatched = false;
      endFrameTicks = 0;
      navigationCooldownUntil = 0;
      advanceToNext();
    });

    document.getElementById('gfg-btn-state').addEventListener('click', () => {
      isPaused = !isPaused;
      const btnState = document.getElementById('gfg-btn-state');
      const statusDot = document.getElementById('gfg-status-dot');
      if (isPaused) {
        btnState.innerText = 'Paused';
        btnState.style.background = '#ef4444';
        statusDot.style.background = '#ef4444';
        setStatus('Paused by user.', '#f87171');
      } else {
        btnState.innerText = 'Running';
        btnState.style.background = '#22c55e';
        statusDot.style.background = '#22c55e';
        setStatus('Resuming...', '#22c55e');
      }
    });
  }
  createHUD();

  function setStatus(text, color = '#cbd5e1') {
    const el = document.getElementById('gfg-status-msg');
    if (el) {
      el.innerText = text;
      el.style.color = color;
    }
  }

  // ----------------------------------------------------------------------
  // 5. ADVANCEMENT ENGINE (SKIPS PROBLEMS & QUIZZES TO JUMP TO NEXT TRACK)
  // ----------------------------------------------------------------------
  function advanceToNext() {
    const now = Date.now();
    if (now < navigationCooldownUntil) return;
    navigationCooldownUntil = now + 4000; // 4-second cooldown

    waitingForCredit = false;
    isQuizSkipping = false;
    isSkippingAlreadyWatched = false;
    endFrameTicks = 0;

    setStatus('Advancing to next video/track...', '#38bdf8');

    const sidebarRows = getAllSidebarVideoRows();
    const allSidebarVideosCompleted = sidebarRows.length > 0 && sidebarRows.every(r => isElementTicked(r));

    // 1. Detect if all track videos are done OR if top-right says "Go to Problems"
    const allButtons = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
    const goToProblemsBtn = allButtons.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
      return txt.includes('problem') && (txt.includes('go to') || txt.includes('next'));
    });

    const is100PercentDone = (document.body.innerText || '').includes('100%') || 
                             (document.body.innerText || '').includes('Complete. (100%)');

    // If videos in this track are complete, SKIP PROBLEMS AND GO DIRECTLY TO NEXT TRACK!
    if (goToProblemsBtn || is100PercentDone || allSidebarVideosCompleted) {
      const nextTrack = findNextTrackButton();
      if (nextTrack) {
        console.log('[GFG Auto v3.5] Track videos finished! Advancing to Next Track:', nextTrack);
        setStatus('🎉 All videos complete! Advancing to Next Track...', '#22c55e');
        clickElement(nextTrack);
        completedCount++;
        const badgeCount = document.getElementById('gfg-badge-count');
        if (badgeCount) badgeCount.innerText = `Done: ${completedCount}`;
        return;
      }
    }

    // 2. If there are unticked videos in sidebar, try to click the first unticked video!
    const untickedRow = findFirstUntickedVideoInSidebar();
    if (untickedRow) {
      console.log('[GFG Auto v3.5] Found unwatched video in sidebar, clicking:', untickedRow);
      setStatus('Playing next unwatched video...', '#22c55e');
      clickElement(untickedRow);
      completedCount++;
      const badgeCount = document.getElementById('gfg-badge-count');
      if (badgeCount) badgeCount.innerText = `Done: ${completedCount}`;
      return;
    }

    // 3. Normal Next » button
    const nextBtn = findGFGNextButton();
    if (nextBtn) {
      const btnText = (nextBtn.innerText || nextBtn.textContent || '').trim().toLowerCase();
      // If the button says "Go to Problems" or mentions quiz, skip problems and advance to Next Track
      if (btnText.includes('problem') || btnText.includes('quiz') || btnText.includes('article')) {
        const nextTrack = findNextTrackButton();
        if (nextTrack) {
          console.log('[GFG Auto v3.5] Skipping problems -> Advancing to Next Track:', nextTrack);
          setStatus('Skipping problems -> Advancing to Next Track...', '#22c55e');
          clickElement(nextTrack);
          completedCount++;
          const badgeCount = document.getElementById('gfg-badge-count');
          if (badgeCount) badgeCount.innerText = `Done: ${completedCount}`;
          return;
        }
      }

      console.log('[GFG Auto v3.5] Clicking Next button:', nextBtn);
      clickElement(nextBtn);
      completedCount++;
      const badgeCount = document.getElementById('gfg-badge-count');
      if (badgeCount) badgeCount.innerText = `Done: ${completedCount}`;
      setStatus('Clicked Next! Advancing...', '#22c55e');
      return;
    }

    // 4. Fallback: Next Track button
    const nextTrack = findNextTrackButton();
    if (nextTrack) {
      console.log('[GFG Auto v3.5] Clicking Next Track fallback:', nextTrack);
      clickElement(nextTrack);
      setStatus('Advancing to Next Track...', '#22c55e');
      return;
    }

    setStatus('No Next item or track found.', '#f59e0b');
  }

  // ----------------------------------------------------------------------
  // 6. MAIN TICK CONTROLLER (RUNS EVERY 1 SECOND VIA WEB WORKER)
  // ----------------------------------------------------------------------
  function handleTick() {
    if (isPaused) return;

    // Detect URL changes
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      waitingForCredit = false;
      isQuizSkipping = false;
      isSkippingAlreadyWatched = false;
      nonVideoPageTicks = 0;
      activeVideoKey = '';
      endFrameTicks = 0;
      navigationCooldownUntil = 0; // Clear cooldown immediately on URL change!
      setStatus('New page loaded. Initializing...', '#38bdf8');
      createHUD();
    }

    // -----------------------------------------------------------
    // SCOPE CHECK: STANDBY ON HOME PAGE
    // -----------------------------------------------------------
    if (!location.pathname.includes('/track/')) {
      nonVideoPageTicks = 0;
      isQuizSkipping = false;
      isSkippingAlreadyWatched = false;
      waitingForCredit = false;
      endFrameTicks = 0;
      setStatus('🏠 Batch Home. Click any track to start auto-playing!', '#38bdf8');
      const btnState = document.getElementById('gfg-btn-state');
      const statusDot = document.getElementById('gfg-status-dot');
      if (btnState && !isPaused) {
        btnState.innerText = 'Standby';
        btnState.style.background = '#0284c7';
      }
      if (statusDot && !isPaused) {
        statusDot.style.background = '#0284c7';
      }
      return;
    }

    // In track mode
    const btnState = document.getElementById('gfg-btn-state');
    const statusDot = document.getElementById('gfg-status-dot');
    if (btnState && !isPaused && btnState.innerText === 'Standby') {
      btnState.innerText = 'Running';
      btnState.style.background = '#22c55e';
      statusDot.style.background = '#22c55e';
    }

    // -----------------------------------------------------------
    // NAVIGATION COOLDOWN AUTO-EXPIRY (PREVENTS PERMANENT COOLDOWN STALL)
    // -----------------------------------------------------------
    if (Date.now() < navigationCooldownUntil) {
      setStatus('Preparing video playback...', '#38bdf8');
      return;
    }

    // -----------------------------------------------------------
    // CASE A: CHECK IF CURRENT VIDEO IS ALREADY CREDITED (SOLID GREEN TICK)
    // -----------------------------------------------------------
    const currentVideoTicked = isCurrentVideoCompletedInSidebar();
    if (currentVideoTicked) {
      if (!isSkippingAlreadyWatched) {
        isSkippingAlreadyWatched = true;
        alreadyWatchedSkipDeadline = Date.now() + 2000;
        setStatus('✅ Video already credited! Clicking Next in 2s...', '#22c55e');
      } else {
        const remSec = Math.max(0, Math.ceil((alreadyWatchedSkipDeadline - Date.now()) / 1000));
        setStatus(`✅ Video already credited! Clicking Next in ${remSec}s...`, '#22c55e');
        if (Date.now() >= alreadyWatchedSkipDeadline) {
          isSkippingAlreadyWatched = false;
          advanceToNext();
        }
      }
      return;
    }
    isSkippingAlreadyWatched = false;

    const video = document.querySelector('video');

    // -----------------------------------------------------------
    // CASE B: NO VIDEO PLAYER (QUIZ / PROBLEM / ARTICLE)
    // Skips non-video content and moves to next track!
    // -----------------------------------------------------------
    if (!video) {
      nonVideoPageTicks++;
      const isQuizOrProblem = location.pathname.includes('/quiz/') || 
                              location.pathname.includes('/practice/') || 
                              location.pathname.includes('/problem/') || 
                              location.pathname.includes('/article/');

      // If on a track page without an active video player, see if an unwatched video is in sidebar
      const untickedInSidebar = findFirstUntickedVideoInSidebar();
      if (untickedInSidebar && !isQuizOrProblem && nonVideoPageTicks >= 2) {
        setStatus('Found unwatched video! Starting playback...', '#22c55e');
        nonVideoPageTicks = 0;
        clickElement(untickedInSidebar);
        return;
      }

      if (isQuizOrProblem || nonVideoPageTicks >= 4) {
        if (!isQuizSkipping) {
          isQuizSkipping = true;
          quizSkipDeadline = Date.now() + 2000;
          setStatus('📝 Quiz / Problem detected! Skipping to next track in 2s...', '#eab308');
        } else {
          const remSec = Math.max(0, Math.ceil((quizSkipDeadline - Date.now()) / 1000));
          setStatus(`📝 Quiz / Problem detected! Skipping in ${remSec}s...`, '#eab308');
          if (Date.now() >= quizSkipDeadline) {
            isQuizSkipping = false;
            advanceToNext();
          }
        }
      } else {
        setStatus('Waiting for video player...', '#94a3b8');
      }
      return;
    }

    // Video player exists
    nonVideoPageTicks = 0;
    isQuizSkipping = false;

    // Identify current video stream
    const currentVideoSrc = video.currentSrc || video.src || location.href;
    const currentVideoKey = location.href + '#' + currentVideoSrc;

    if (activeVideoKey !== currentVideoKey) {
      if (video.duration > 5) {
        activeVideoKey = currentVideoKey;
        waitingForCredit = false;
        endFrameTicks = 0;
        console.log('[GFG Auto v3.5] Video active. Duration:', video.duration);
      }
    }

    // Waiting for credit countdown
    if (waitingForCredit) {
      const remainingMs = creditDeadline - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setStatus(`Video finished! Waiting ${remainingSec}s for server credit...`, '#f59e0b');

      if (remainingMs <= 0) {
        waitingForCredit = false;
        advanceToNext();
      }
      return;
    }

    // -----------------------------------------------------------
    // CASE C: END-FRAME DETECTION (MUST BE > 5 SECONDS TO PREVENT 0:00 FALSE TRIGGERS)
    // -----------------------------------------------------------
    const isAtEndFrame = video.duration > 5 && video.currentTime > 5 && (
      video.ended || 
      (video.duration - video.currentTime) <= 1.0 || 
      video.currentTime >= (video.duration - 0.5)
    );

    if (isAtEndFrame) {
      endFrameTicks++;
      // If at end frame for 2 consecutive seconds, video is finished!
      if (endFrameTicks >= 2 && !waitingForCredit) {
        waitingForCredit = true;
        creditDeadline = Date.now() + 2500; // 2.5-second credit wait
        setStatus('Video ended! Recording credit (2s)...', '#f59e0b');
        return;
      }
      setStatus('Video ended! Recording credit...', '#f59e0b');
      return;
    } else {
      endFrameTicks = 0;
    }

    // Enforce 2.0x playback rate
    if (video.playbackRate !== targetSpeed) {
      video.playbackRate = targetSpeed;
    }

    // Enforce mute for seamless background autoplay
    if (video.muted !== isMuted) {
      video.muted = isMuted;
    }

    // Autoplay if paused
    if (video.paused && !video.ended) {
      video.play().catch(() => {
        video.muted = true;
        isMuted = true;
        const btnVol = document.getElementById('gfg-btn-vol');
        if (btnVol) btnVol.innerText = '🔇 Muted';
        video.play().catch(() => {});
      });
    }

    // Display Real-Time Playback Progress in HUD
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

  // ----------------------------------------------------------------------
  // 7. UNTHROTTLED WEB WORKER HEARTBEAT (RUNS ACROSS VIRTUAL DESKTOPS)
  // ----------------------------------------------------------------------
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
    console.log('[GFG Auto v3.5] Web Worker background heartbeat active.');
  } catch (err) {
    console.warn('[GFG Auto v3.5] Worker fallback to setInterval:', err);
    setInterval(handleTick, 1000);
  }

  setInterval(handleTick, 1000);

  console.log('%c[GFG Auto-Advancer v3.5] Auto Next Track & Problems/Quiz Skip Active!', 'color: #22c55e; font-size: 13px; font-weight: bold;');
})();
