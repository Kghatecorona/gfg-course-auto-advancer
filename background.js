// GFG Course Auto-Advancer - Background Service Worker (Manifest V3)
// Guarantees real-time execution in background tabs and across Windows virtual desktops

function pingTabs() {
  chrome.tabs.query({ url: "*://*.geeksforgeeks.org/batch/*" }, (tabs) => {
    if (chrome.runtime.lastError || !tabs) return;
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "HEARTBEAT" }).catch(() => {});
      }
    }
  });
}

// Send 1-second pulse to wake up GFG content scripts
setInterval(pingTabs, 1000);

// Keep the service worker alive using chrome.alarms
chrome.alarms.create("gfg_keepalive", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "gfg_keepalive") {
    pingTabs();
  }
});
