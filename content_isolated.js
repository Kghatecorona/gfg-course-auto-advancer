// GFG Course Auto-Advancer - Isolated World Bridge (v5.1.0)
// Connects to background service worker and bridges heartbeat pulses to MAIN world

(function () {
  'use strict';

  let port = null;

  function connectKeepAlive() {
    try {
      port = chrome.runtime.connect({ name: 'gfg_keepalive_port' });

      port.onMessage.addListener((msg) => {
        if (msg?.action === 'PULSE') {
          // Send acknowledgement to keep worker active
          try { port.postMessage({ action: 'ACK' }); } catch (e) {}
          // Forward pulse to Main World
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

  connectKeepAlive();

  // Fallback alarm message receiver
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.action === 'PULSE') {
      window.postMessage({ source: 'gfg_isolated_pulse', type: 'TICK' }, '*');
    }
  });
})();
