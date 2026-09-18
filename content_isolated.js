// GFG Course Auto-Advancer - Isolated World Bridge (v5.3.0)
// Manages background tab muting and heartbeat bridging to MAIN world

(function () {
  'use strict';

  let port = null;

  function ensureMuted() {
    try {
      chrome.runtime.sendMessage({ action: 'MUTE_TAB' }).catch(() => {});
    } catch (e) {}
  }

  function connectKeepAlive() {
    try {
      port = chrome.runtime.connect({ name: 'gfg_keepalive_port' });

      port.onMessage.addListener((msg) => {
        if (msg?.action === 'PULSE') {
          try { port.postMessage({ action: 'ACK' }); } catch (e) {}
          window.postMessage({ source: 'gfg_isolated_pulse', type: 'TICK' }, '*');
        }
      });

      port.onDisconnect.addListener(() => {
        port = null;
        setTimeout(connectKeepAlive, 1000);
      });
    } catch (e) {
      setTimeout(connectKeepAlive, 2000);
    }
  }

  ensureMuted();
  connectKeepAlive();

  window.addEventListener('message', (e) => {
    if (e.data?.source === 'gfg_main_request' && e.data?.action === 'MUTE_TAB') {
      ensureMuted();
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.action === 'PULSE') {
      window.postMessage({ source: 'gfg_isolated_pulse', type: 'TICK' }, '*');
    }
  });
})();
