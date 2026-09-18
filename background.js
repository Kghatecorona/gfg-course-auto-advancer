// GFG Course Auto-Advancer - Background Service Worker (v5.1.0)
// Maintains continuous keep-alive, port pulsing, and background unthrottling

console.log('[GFG Auto v5.1.0] Background Service Worker registered');

// Persistent Port Keep-Alive
// When a content script connects via Port, we send a heartbeat every 1 second.
// This prevents Chrome from suspending the service worker and wakes up the tab renderer.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'gfg_keepalive_port') {
    console.log('[GFG Auto v5.1.0] Active keep-alive port connected');
    
    const interval = setInterval(() => {
      try {
        port.postMessage({ action: 'PULSE', timestamp: Date.now() });
      } catch (e) {
        clearInterval(interval);
      }
    }, 1000);

    port.onMessage.addListener((msg) => {
      // Respond to content script pings
      if (msg?.action === 'ACK') {
        // Keep-alive acknowledged
      }
    });

    port.onDisconnect.addListener(() => {
      clearInterval(interval);
      console.log('[GFG Auto v5.1.0] Keep-alive port disconnected');
    });
  }
});

// Alarm fallback in case port drops
chrome.alarms.create('gfg_alarm_watchdog', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'gfg_alarm_watchdog') {
    chrome.tabs.query({ url: '*://*.geeksforgeeks.org/batch/*' }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'PULSE' }).catch(() => {});
        }
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === 'STATUS_PING') {
    sendResponse({ status: 'OK', timestamp: Date.now() });
  }
  return true;
});
