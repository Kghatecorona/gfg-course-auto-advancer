// GFG Course Auto-Advancer - Background Service Worker (v5.7.0)
// Prevents tab discarding, maintains active keep-alive watchdog

console.log('[GFG Auto v5.7.0] Service Worker active');

function protectTab(tabId) {
  if (!tabId) return;
  try {
    chrome.tabs.update(tabId, { autoDiscardable: false }, () => {
      if (chrome.runtime.lastError) {}
    });
  } catch (e) {}
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab?.url && tab.url.includes('geeksforgeeks.org/batch/')) {
    protectTab(tabId);
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'gfg_keepalive_port') {
    if (port.sender?.tab?.id) {
      protectTab(port.sender.tab.id);
    }

    const interval = setInterval(() => {
      try {
        port.postMessage({ action: 'PULSE', timestamp: Date.now() });
      } catch (e) {
        clearInterval(interval);
      }
    }, 500);

    port.onMessage.addListener(() => {});

    port.onDisconnect.addListener(() => {
      clearInterval(interval);
    });
  }
});

chrome.alarms.create('gfg_alarm_watchdog', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'gfg_alarm_watchdog') {
    chrome.tabs.query({ url: '*://*.geeksforgeeks.org/batch/*' }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          protectTab(tab.id);
          chrome.tabs.sendMessage(tab.id, { action: 'PULSE' }).catch(() => {});
        }
      }
    });
  }
});
