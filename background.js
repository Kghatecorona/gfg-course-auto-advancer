// GFG Course Auto-Advancer - Background Service Worker (v5.3.0)
// Auto-mutes GFG tabs at browser level (preventing Chromium background video pausing)
// Maintains continuous keep-alive port pulsing across virtual desktops

console.log('[GFG Auto v5.3.0] Background Service Worker registered');

function ensureTabMuted(tabId) {
  if (!tabId) return;
  try {
    chrome.tabs.update(tabId, { muted: true }, () => {
      if (chrome.runtime.lastError) {
        // Tab may have closed
      }
    });
  } catch (e) {}
}

// Auto-mute any GFG course tabs on creation / update
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab?.url && tab.url.includes('geeksforgeeks.org/batch/')) {
    ensureTabMuted(tabId);
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === 'MUTE_TAB' && sender.tab?.id) {
    ensureTabMuted(sender.tab.id);
    sendResponse({ status: 'MUTED' });
  }
  return true;
});

// Persistent Port Keep-Alive
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'gfg_keepalive_port') {
    if (port.sender?.tab?.id) {
      ensureTabMuted(port.sender.tab.id);
    }

    const interval = setInterval(() => {
      try {
        port.postMessage({ action: 'PULSE', timestamp: Date.now() });
      } catch (e) {
        clearInterval(interval);
      }
    }, 1000);

    port.onMessage.addListener((msg) => {
      if (msg?.action === 'ACK') {
        // Heartbeat acknowledged
      }
    });

    port.onDisconnect.addListener(() => {
      clearInterval(interval);
    });
  }
});

// Alarm watchdog fallback
chrome.alarms.create('gfg_alarm_watchdog', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'gfg_alarm_watchdog') {
    chrome.tabs.query({ url: '*://*.geeksforgeeks.org/batch/*' }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          ensureTabMuted(tab.id);
          chrome.tabs.sendMessage(tab.id, { action: 'PULSE' }).catch(() => {});
        }
      }
    });
  }
});
