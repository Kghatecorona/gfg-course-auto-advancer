// GFG Course Auto-Advancer - Background Service Worker (v5.0)
// Manages tab keep-alive, wake alarms, and background unthrottling

chrome.runtime.onInstalled.addListener(() => {
  console.log('[GFG Auto v5.0] Background Service Worker installed');
  chrome.alarms.create('gfg_keep_alive', { periodInMinutes: 0.25 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('gfg_keep_alive', { periodInMinutes: 0.25 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'gfg_keep_alive') {
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
