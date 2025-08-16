// This is the service worker script, which executes in the background.
// It is responsible for handling events such as context menu clicks.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "copyToClipboard",
    title: chrome.i18n.getMessage("contextMenuTitle"),
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "copyToClipboard" && info.selectionText) {
    const text = info.selectionText;
    const now = new Date();
    const timestamp = now.toLocaleString();
    const url = tab.url;
    const domain = new URL(url).hostname;

    const data = {
      text,
      timestamp,
      url,
      domain,
      tags: []
    };

    chrome.storage.local.get({ clipboard: [] }, (result) => {
      const clipboard = result.clipboard;
      clipboard.unshift(data);
      chrome.storage.local.set({ clipboard }, () => {
        chrome.runtime.sendMessage({ message: 'clipboardUpdated' });
      });
    });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (textToCopy) => {
        navigator.clipboard.writeText(textToCopy);
      },
      args: [text]
    });
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

console.log("Super Clipboard service worker started.");