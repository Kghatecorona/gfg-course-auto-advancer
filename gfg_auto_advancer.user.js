// ==UserScript==
// @name         GFG Course Auto-Advancer (v3.2 - Precision Checkmark Detection, Track Scope & Anti-Hang)
// @namespace    https://geeksforgeeks.org/
// @version      3.2
// @description  Automates GFG course tracks at 2x speed. Reliably detects GFG dark-green checkmarks, skips completed videos & quizzes, stays idle on home page, and syncs background progress.
// @author       Kavyansh
// @match        https://*.geeksforgeeks.org/batch/*
// @match        https://geeksforgeeks.org/batch/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  if (window.__gfg_auto_advancer_v32_active) {
    console.log('[GFG Auto v3.2] Script already active!');
    return;
  }
  window.__gfg_auto_advancer_v32_active = true;

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
      if (OrigIO && !window.__gfg_io_v32_patched) {
        window.__gfg_io_v32_patched = true;
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
  // 2. MATHEMATICAL COLOR PARSER & PRECISION CHECKMARK DETECTOR
  // Reliably catches GFG's brand dark green (#2f8d46 / rgb(47, 141, 70))
  // ----------------------------------------------------------------------
  function isGreenColor(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return false;
    const s = colorStr.toLowerCase().trim();
    if (s === 'green' || s.includes('#2f8d46') || s.includes('rgb(0, 128, 0)')) return true;

    // Hex format: #2f8d46 or #7bb68a
    const hexMatch = s.match(/#([0-9a-f]{6})/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return g > r + 15 && g > b + 15 && g >= 55;
    }

    // Short hex format: #080
    const shortHexMatch = s.match(/#([0-9a-f]{3})\b/i);
    if (shortHexMatch) {
      const hex = shortHexMatch[1];
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return g > r + 15 && g > b + 15 && g >= 55;
    }

    // rgb(r, g, b) or rgba(r, g, b, a) format
    const rgbMatch = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      return g > r + 15 && g > b + 15 && g >= 55;
    }

    return false;
  }

  // Find the distinct row container for a given link to avoid playlist leakage
  function findItemRow(link) {
    let curr = link;
    while (curr && curr.parentElement && curr.parentElement !== document.body) {
      const parent = curr.parentElement;
      // If the parent contains multiple course item links, curr is this item's specific row!
      const linksInParent = parent.querySelectorAll('a[href*="/track/"], a[href*="/video/"]');
      if (linksInParent.length > 1) {
        return curr;
      }
      curr = parent;
    }
    return link.parentElement || link;
  }

  // Check if a specific row has been marked complete (dark green checkmark or completed class)
  function isRowCompleted(rowElement) {
    if (!rowElement) return false;

    // 1. Direct class or attribute check
    const cls = (rowElement.className || '').toString().toLowerCase();
    if (cls.includes('completed') || cls.includes('done') || cls.includes('watched') || cls.includes('finish')) {
      return true;
    }
    if (rowElement.getAttribute('data-completed') === 'true') return true;

    // 2. Direct checkmark text
    if (rowElement.textContent && (rowElement.textContent.includes('✓') || rowElement.textContent.includes('✔'))) {
      return true;
    }

    // 3. Inspect all icons, SVGs, circles, and badges in this specific row
    const candidates = rowElement.querySelectorAll('svg, path, circle, rect, i, span, div');
    for (const el of candidates) {
      const elCls = (el.className?.baseVal || el.className || '').toString().toLowerCase();
      const dataIcon = (el.getAttribute('data-icon') || '').toLowerCase();
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      const title = (el.getAttribute('title') || '').toLowerCase();

      if (elCls.includes('check') || elCls.includes('tick') || elCls.includes('success') ||
          dataIcon.includes('check') || ariaLabel.includes('complete') || ariaLabel.includes('watched') ||
          title.includes('complete') || title.includes('watched')) {
        return true;
      }

      // Check SVG stroke & fill attributes directly
      const strokeAttr = el.getAttribute('stroke') || '';
      const fillAttr = el.getAttribute('fill') || '';
      if (isGreenColor(strokeAttr) || isGreenColor(fillAttr)) {
        return true;
      }

      // Computed style check for GFG brand dark green (#2f8d46)
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width >= 8 && rect.width <= 36 && rect.height >= 8 && rect.height <= 36) {
          const style = window.getComputedStyle(el);
          if (isGreenColor(style.color) || 
              isGreenColor(style.stroke) || 
              isGreenColor(style.fill) || 
              isGreenColor(style.borderColor) ||
              isGreenColor(style.backgroundColor)) {
            return true;
          }
        }
      } catch (e) {}
    }

    return false;
  }

  function isSidebarItemWatched(itemLink) {
    if (!itemLink) return false;
    if (isRowCompleted(itemLink)) return true;
    const row = findItemRow(itemLink);
    if (row && isRowCompleted(row)) return true;
    return false;
  }

  function getCurrentSidebarItem() {
    const currentPath = location.pathname;
    const allSidebarLinks = Array.from(document.querySelectorAll('a[href*="/track/"]'));
    let active = allSidebarLinks.find(a => a.pathname === currentPath || a.href === location.href);
    if (active) return active;

    active = allSidebarLinks.find(a => {
      const cls = (a.className || '').toLowerCase();
      const pCls = (a.parentElement?.className || '').toLowerCase();
      return cls.includes('active') || cls.includes('selected') || pCls.includes('active') || pCls.includes('selected');
    });
    return active || null;
  }

  // ----------------------------------------------------------------------
  // 3. STATE CONTROLLER (ANTI-SKIP & AUTO-NEXT)
  // ----------------------------------------------------------------------
  let targetSpeed = 2.0;
  let isMuted = true;
  let isPaused = false;
  let completedCount = 0;

  let isNavigating = false;
  let navigationCooldownUntil = 0;
  let activeVideoKey = '';
  let activeVideoPlayedSeconds = 0;
  let waitingForCredit = false;
  let creditDeadline = 0;
  let lastUrl = location.href;

  let nonVideoPageTicks = 0;
  let isQuizSkipping = false;
  let quizSkipDeadline = 0;

  let isSkippingAlreadyWatched = false;
  let alreadyWatchedSkipDeadline = 0;

  // ----------------------------------------------------------------------
  // 4. FLOATING HUD USER INTERFACE
  // ----------------------------------------------------------------------
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
          GFG Auto-Advancer v3.2
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
  // 5. NAVIGATION ENGINE (FINDS NEXT UNWATCHED VIDEO OR ADVANCES TRACK)
  // ----------------------------------------------------------------------
  function findNextTarget() {
    // Only search for targets inside an active course track
    if (!location.pathname.includes('/track/')) return null;

    const allSidebarLinks = Array.from(document.querySelectorAll('a[href*="/track/"]'));
    const currentPath = location.pathname;
    const currentLinkIndex = allSidebarLinks.findIndex(a => a.pathname === currentPath || a.href === location.href);

    // Strategy 1: Look FORWARD from current item in the playlist for the FIRST UNWATCHED VIDEO link
    if (currentLinkIndex !== -1) {
      for (let i = currentLinkIndex + 1; i < allSidebarLinks.length; i++) {
        const link = allSidebarLinks[i];
        if (link.href.includes('/video/') && !isSidebarItemWatched(link)) {
          console.log('[GFG Auto v3.2] Found next UNWATCHED video forward in playlist:', link);
          return link;
        }
      }
    }

    // Strategy 2: Check entire sidebar for ANY unwatched video in this track that isn't the current page
    const allVideoLinks = Array.from(document.querySelectorAll('a[href*="/video/"]'));
    const unwatchedVideo = allVideoLinks.find(a => a.href !== location.href && !isSidebarItemWatched(a));
    if (unwatchedVideo) {
      console.log('[GFG Auto v3.2] Found unwatched video link in sidebar:', unwatchedVideo);
      return unwatchedVideo;
    }

    // Strategy 3: Top-right "Next »" button
    const all = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
    const exactNext = all.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return (text === 'next' || text === 'next >>' || text === 'next »' || text === 'next >' || text === 'next ›');
    });
    if (exactNext) return exactNext;

    // Strategy 4: "Next Track" button (advances to next course module when all videos in this track are complete!)
    const nextTrack = all.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return text.includes('next') && text.includes('track') && !text.includes('prev');
    });
    if (nextTrack) return nextTrack;

    // Strategy 5: Any generic button starting with "next"
    const genericNext = all.find(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return text.startsWith('next') && !text.includes('prev');
    });
    if (genericNext) return genericNext;

    return null;
  }

  function advanceToNext() {
    const now = Date.now();
    if (now < navigationCooldownUntil) return;
    navigationCooldownUntil = now + 8000; // 8-second navigation cooldown

    isNavigating = true;
    activeVideoPlayedSeconds = 0;
    activeVideoKey = '';
    waitingForCredit = false;
    isQuizSkipping = false;
    isSkippingAlreadyWatched = false;

    setStatus('Advancing to next video/track...', '#38bdf8');
    const target = findNextTarget();

    if (target) {
      console.log('[GFG Auto v3.2] Advancing target:', target);
      
      // Dispatch synthetic mouse event sequence
      ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(evtType => {
        try {
          target.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window }));
        } catch (e) {}
      });
      try { target.click(); } catch (e) {}

      // Background fallback navigation if React delays click
      const destUrl = target.href || target.getAttribute('href') || target.querySelector('a')?.href;
      if (destUrl && !destUrl.startsWith('javascript:')) {
        const startUrl = location.href;
        setTimeout(() => {
          if (location.href === startUrl) {
            console.log('[GFG Auto v3.2] Background fallback navigation to:', destUrl);
            window.location.href = destUrl;
          }
        }, 1500);
      }

      completedCount++;
      const badgeCount = document.getElementById('gfg-badge-count');
      if (badgeCount) badgeCount.innerText = `Done: ${completedCount}`;
      setStatus('Advancing... Loading upcoming item.', '#22c55e');
    } else {
      setStatus('No Next item found. Checking playlist...', '#f59e0b');
    }
  }

  // ----------------------------------------------------------------------
  // 6. MAIN TICK CONTROLLER (RUNS EVERY 1 SECOND VIA WEB WORKER)
  // ----------------------------------------------------------------------
  function handleTick() {
    if (isPaused) return;

    // Detect SPA URL navigation
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      isNavigating = false;
      waitingForCredit = false;
      isQuizSkipping = false;
      isSkippingAlreadyWatched = false;
      nonVideoPageTicks = 0;
      activeVideoPlayedSeconds = 0;
      activeVideoKey = '';
      setStatus('New page loaded. Initializing...', '#38bdf8');
      createHUD();
    }

    // -----------------------------------------------------------
    // SCOPE CHECK: ARE WE ON THE BATCH HOME PAGE / OVERVIEW?
    // If NOT in a track, stay peaceful in STANDBY mode. Do NOT skip or click!
    // -----------------------------------------------------------
    if (!location.pathname.includes('/track/')) {
      nonVideoPageTicks = 0;
      isQuizSkipping = false;
      isSkippingAlreadyWatched = false;
      waitingForCredit = false;
      isNavigating = false;
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
      return; // Exit! Never run auto-actions on the batch home page
    }

    // We are inside an active track
    const btnState = document.getElementById('gfg-btn-state');
    const statusDot = document.getElementById('gfg-status-dot');
    if (btnState && !isPaused && btnState.innerText === 'Standby') {
      btnState.innerText = 'Running';
      btnState.style.background = '#22c55e';
      statusDot.style.background = '#22c55e';
    }

    const currentSidebarItem = getCurrentSidebarItem();
    const isCurrentItemCompleted = isSidebarItemWatched(currentSidebarItem);

    // -----------------------------------------------------------
    // CASE A: ALREADY WATCHED VIDEO DETECTED (HAS DARK GREEN CHECKMARK)
    // Prevents hanging on previously completed videos!
    // -----------------------------------------------------------
    if (isCurrentItemCompleted) {
      if (!isSkippingAlreadyWatched) {
        isSkippingAlreadyWatched = true;
        alreadyWatchedSkipDeadline = Date.now() + 2000; // 2s notice
        setStatus('✅ Video already watched & credited! Skipping in 2s...', '#22c55e');
      } else {
        const remSec = Math.max(0, Math.ceil((alreadyWatchedSkipDeadline - Date.now()) / 1000));
        setStatus(`✅ Video already watched! Skipping to next unwatched in ${remSec}s...`, '#22c55e');
        if (Date.now() >= alreadyWatchedSkipDeadline) {
          isSkippingAlreadyWatched = false;
          advanceToNext();
        }
      }
      return;
    }

    // Reset skip state if current item is not completed
    isSkippingAlreadyWatched = false;

    const video = document.querySelector('video');

    // -----------------------------------------------------------
    // CASE B: NO VIDEO PLAYER ON PAGE (QUIZ / ARTICLE / PROBLEM)
    // ONLY triggered inside a track!
    // -----------------------------------------------------------
    if (!video) {
      nonVideoPageTicks++;

      const isQuizOrProblem = location.pathname.includes('/quiz/') || 
                              location.pathname.includes('/practice/') || 
                              location.pathname.includes('/problem/') || 
                              location.pathname.includes('/article/');

      if (isQuizOrProblem || nonVideoPageTicks >= 4) {
        if (!isQuizSkipping) {
          isQuizSkipping = true;
          quizSkipDeadline = Date.now() + 2500;
          setStatus('📝 Quiz / Article detected! Skipping to next video in 2s...', '#eab308');
        } else {
          const remSec = Math.max(0, Math.ceil((quizSkipDeadline - Date.now()) / 1000));
          setStatus(`📝 Quiz detected! Skipping to next video in ${remSec}s...`, '#eab308');
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

    // If new video stream is recognized
    if (activeVideoKey !== currentVideoKey) {
      if (video.duration > 5 && video.currentTime < 5) {
        activeVideoKey = currentVideoKey;
        activeVideoPlayedSeconds = 0;
        isNavigating = false;
        waitingForCredit = false;
        console.log('[GFG Auto v3.2] New video recognized. Duration:', video.duration);
      }
    }

    // If currently waiting for server credit heartbeat
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

    // While in navigation cooldown, prevent premature completion
    if (isNavigating || Date.now() < navigationCooldownUntil) {
      setStatus('Preparing video playback...', '#38bdf8');
      return;
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

    // Track active watch time
    if (!video.paused && video.duration > 5 && !video.ended) {
      activeVideoPlayedSeconds++;
    }

    // -----------------------------------------------------------
    // COMPLETION CHECK
    // 1. Video ended or at end frame with at least 5s played
    // 2. OR video has reached >= 98% of duration
    // -----------------------------------------------------------
    const hasPlayedSufficiently = activeVideoPlayedSeconds >= 5;
    const isAtEnd = video.currentTime > 5 && hasPlayedSufficiently && 
      (video.ended || (video.duration > 5 && video.currentTime >= (video.duration - 1.0)));

    if (isAtEnd && !waitingForCredit) {
      waitingForCredit = true;
      creditDeadline = Date.now() + 3500; // 3.5-second credit heartbeat wait
      setStatus('Video ended! Recording credit (3s)...', '#f59e0b');
      return;
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
    console.log('[GFG Auto v3.2] Web Worker background heartbeat active.');
  } catch (err) {
    console.warn('[GFG Auto v3.2] Worker fallback to setInterval:', err);
    setInterval(handleTick, 1000);
  }

  setInterval(handleTick, 1000);

  console.log('%c[GFG Auto-Advancer v3.2] Precision Checkmark Detection + Track Scope Active!', 'color: #22c55e; font-size: 13px; font-weight: bold;');
})();
