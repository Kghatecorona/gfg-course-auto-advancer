// ==UserScript==
// @name         GFG Course Auto-Advancer (2x Speed + Auto Next)
// @namespace    https://geeksforgeeks.org/
// @version      1.0
// @description  Automates GeeksforGeeks batch courses: plays at 2x, autoplays, mutes for background playback, waits for progress credit, and automatically clicks Next.
// @author       Kavyansh
// @match        https://*.geeksforgeeks.org/batch/*
// @match        https://geeksforgeeks.org/batch/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Prevent duplicate execution if pasted multiple times
  if (window.__gfg_auto_advancer_active) {
    console.log('[GFG Auto] Script already active!');
    return;
  }
  window.__gfg_auto_advancer_active = true;

  let targetSpeed = 2.0;
  let isMuted = true;
  let isPaused = false;
  let completedCount = 0;
  let waitingForCredit = false;
  let countdownSec = 0;
  let lastAdvanceTime = 0;
  let currentUrl = location.href;

  // Request Screen Wake Lock so computer doesn't sleep
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        await navigator.wakeLock.request('screen');
        console.log('[GFG Auto] Screen Wake Lock active (prevents PC sleep).');
      }
    } catch (e) {
      console.log('[GFG Auto] WakeLock notice:', e.message);
    }
  }
  requestWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });

  // Inject Floating HUD UI
  const hud = document.createElement('div');
  hud.id = 'gfg-auto-hud';
  hud.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 99999999;
    background: rgba(15, 23, 42, 0.94);
    color: #f8fafc;
    padding: 14px 18px;
    border-radius: 12px;
    box-shadow: 0 12px 30px rgba(0,0,0,0.45);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    min-width: 270px;
    border: 1px solid #38bdf8;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
  `;

  hud.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 6px;">
      <span style="font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
        <span id="gfg-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
        GFG Auto-Advancer
      </span>
      <span id="gfg-badge-count" style="background: #1e293b; color: #38bdf8; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 600;">
        Done: 0
      </span>
    </div>
    
    <div id="gfg-status-msg" style="color: #cbd5e1; margin-bottom: 10px; font-size: 12px; min-height: 28px;">
      Initializing video controller...
    </div>
    
    <div style="display: flex; gap: 6px; align-items: center; justify-content: space-between;">
      <div style="display: flex; gap: 5px;">
        <button id="gfg-btn-spd" style="background: #0284c7; color: white; border: none; padding: 4px 9px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">2.0x</button>
        <button id="gfg-btn-vol" style="background: #334155; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 11px;">🔇 Muted</button>
      </div>
      <button id="gfg-btn-state" style="background: #22c55e; color: white; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">Running</button>
    </div>
  `;
  document.body.appendChild(hud);

  const statusMsg = document.getElementById('gfg-status-msg');
  const statusDot = document.getElementById('gfg-status-dot');
  const badgeCount = document.getElementById('gfg-badge-count');
  const btnSpd = document.getElementById('gfg-btn-spd');
  const btnVol = document.getElementById('gfg-btn-vol');
  const btnState = document.getElementById('gfg-btn-state');

  // Controls Event Listeners
  btnSpd.addEventListener('click', () => {
    if (targetSpeed === 2.0) targetSpeed = 1.5;
    else if (targetSpeed === 1.5) targetSpeed = 1.0;
    else targetSpeed = 2.0;
    btnSpd.innerText = targetSpeed.toFixed(1) + 'x';
    const video = document.querySelector('video');
    if (video) video.playbackRate = targetSpeed;
  });

  btnVol.addEventListener('click', () => {
    isMuted = !isMuted;
    btnVol.innerText = isMuted ? '🔇 Muted' : '🔊 Sound';
    const video = document.querySelector('video');
    if (video) video.muted = isMuted;
  });

  btnState.addEventListener('click', () => {
    isPaused = !isPaused;
    if (isPaused) {
      btnState.innerText = 'Paused';
      btnState.style.background = '#ef4444';
      statusDot.style.background = '#ef4444';
      statusMsg.innerText = 'Automation paused by user.';
    } else {
      btnState.innerText = 'Running';
      btnState.style.background = '#22c55e';
      statusDot.style.background = '#22c55e';
      statusMsg.innerText = 'Resuming auto-player...';
    }
  });

  function setStatus(text, color = '#cbd5e1') {
    if (statusMsg) {
      statusMsg.innerText = text;
      statusMsg.style.color = color;
    }
  }

  // Multi-Strategy Target Finder for Next Video / Track
  function findNextTarget() {
    const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));

    // Strategy 1: Top-Right "Next »", "Next >>", "Next" (not Prev)
    const exactNext = candidates.find(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return (text === 'next' || text === 'next >>' || text === 'next »' || text === 'next >' || text === 'next ›');
    });
    if (exactNext) {
      console.log('[GFG Auto] Found Next button (Strategy 1):', exactNext);
      return exactNext;
    }

    // Strategy 2: "Next Track" button (at bottom left or top right)
    const nextTrack = candidates.find(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return text.includes('next') && text.includes('track') && !text.includes('prev');
    });
    if (nextTrack) {
      console.log('[GFG Auto] Found Next Track button (Strategy 2):', nextTrack);
      return nextTrack;
    }

    // Strategy 3: Any button/link starting with "next" (excluding prev)
    const genericNext = candidates.find(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      return text.startsWith('next') && !text.includes('prev');
    });
    if (genericNext) {
      console.log('[GFG Auto] Found generic Next element (Strategy 3):', genericNext);
      return genericNext;
    }

    // Strategy 4: Next video item in the left sidebar list
    const videoLinks = Array.from(document.querySelectorAll('a[href*="/video/"]'));
    if (videoLinks.length > 0) {
      const currIdx = videoLinks.findIndex(a => a.href === location.href || location.href.includes(a.getAttribute('href') || ''));
      if (currIdx !== -1 && currIdx + 1 < videoLinks.length) {
        console.log('[GFG Auto] Found next video link in sidebar (Strategy 4):', videoLinks[currIdx + 1]);
        return videoLinks[currIdx + 1];
      }
    }

    return null;
  }

  // Trigger Advance to Next Video / Track
  function advanceToNext() {
    // Cooldown check (prevent accidental double clicks within 6 seconds)
    const now = Date.now();
    if (now - lastAdvanceTime < 6000) {
      return;
    }
    lastAdvanceTime = now;

    setStatus('Advancing to next video...', '#38bdf8');
    const target = findNextTarget();

    if (target) {
      target.click();
      completedCount++;
      if (badgeCount) badgeCount.innerText = `Done: ${completedCount}`;
      setStatus('Clicked Next! Loading upcoming video...', '#22c55e');
      waitingForCredit = false;
      countdownSec = 0;
    } else {
      setStatus('Could not locate Next button. Check playlist!', '#f59e0b');
      console.warn('[GFG Auto] No Next button or link found on page.');
    }
  }

  // Main Loop (runs every 1 second)
  setInterval(() => {
    if (isPaused) return;

    // Detect SPA page/URL change
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      waitingForCredit = false;
      countdownSec = 0;
      setStatus('New video detected! Initializing...', '#38bdf8');
    }

    const video = document.querySelector('video');
    if (!video) {
      setStatus('Waiting for video player...', '#94a3b8');
      return;
    }

    // Countdown while waiting for GFG server to record completion progress
    if (waitingForCredit) {
      countdownSec--;
      setStatus(`Video finished! Waiting ${countdownSec}s for server credit...`, '#f59e0b');
      if (countdownSec <= 0) {
        waitingForCredit = false;
        advanceToNext();
      }
      return;
    }

    // Enforce mute state (enables reliable background autoplay)
    if (video.muted !== isMuted) {
      video.muted = isMuted;
    }

    // Enforce 2x playback speed
    if (video.playbackRate !== targetSpeed) {
      video.playbackRate = targetSpeed;
    }

    // Autoplay if paused
    if (video.paused && !video.ended) {
      video.play().then(() => {
        setStatus(`Playing at ${targetSpeed}x`, '#22c55e');
      }).catch(() => {
        // Fallback: mute to satisfy browser autoplay policy
        video.muted = true;
        isMuted = true;
        if (btnVol) btnVol.innerText = '🔇 Muted';
        video.play().catch(() => {});
        setStatus('Autoplay blocked. Click page once!', '#f59e0b');
      });
      return;
    }

    // Detect Video Completion (ended or within 0.75s of duration)
    const isEnded = video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.75);
    if (isEnded) {
      waitingForCredit = true;
      countdownSec = 5; // 5-second grace period for GFG progress heartbeat
      setStatus('Video ended! Waiting 5s for GFG server credit...', '#f59e0b');
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
  }, 1000);

  console.log('%c[GFG Auto-Advancer] Active! Playing at 2x and auto-advancing.', 'color: #22c55e; font-size: 14px; font-weight: bold;');
})();
