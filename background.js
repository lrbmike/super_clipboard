// background.js - Service Worker (FIXED for connection errors)

/**
 * 一个健壮的函数，用于向当前活动标签页发送消息。
 * 如果内容脚本尚未准备好（连接失败），它会尝试动态注入脚本然后重试。
 * @param {object} message - 要发送的消息对象，例如 { action: 'extractForm' }
 * @param {function} callback - 用于处理最终响应的回调函数
 */
function sendMessageToActiveTab(message, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      const tabId = tabs[0].id;
      
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError && 
            chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
          
          console.log("Content script not ready or injected. Attempting to inject and retry...");
          
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }, (injectionResults) => {
            if (chrome.runtime.lastError) {
              console.error("Failed to inject script:", chrome.runtime.lastError);
              // 修改点
              if (callback) callback({ success: false, error: chrome.i18n.getMessage("errorInjectScriptFailed") });
              return;
            }
            
            chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
              if (chrome.runtime.lastError) {
                console.error("Failed to send message even after retry:", chrome.runtime.lastError);
                // 修改点
                if (callback) callback({ success: false, error: chrome.i18n.getMessage("errorConnectionFailedAfterInject") });
              } else {
                if (callback) callback(retryResponse);
              }
            });
          });
        } else {
          if (callback) callback(response);
        }
      });
    } else {
      // 修改点
      if (callback) callback({ success: false, error: chrome.i18n.getMessage("errorNoActiveTab") });
    }
  });
}

// --- 安装与初始化 ---
chrome.runtime.onInstalled.addListener(() => {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: "copyToClipboard",
    title: chrome.i18n.getMessage("contextMenuAddToSuperClipboard"),
    contexts: ["selection"]
  });

  // 初始化存储
  chrome.storage.local.get(null, (data) => {
    if (data.clipboard === undefined) chrome.storage.local.set({ clipboard: [] });
    if (data.savedForms === undefined) chrome.storage.local.set({ savedForms: [] });
    if (data.formMappings === undefined) chrome.storage.local.set({ formMappings: [] });
  });
});

// --- 事件监听 ---

// 右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "copyToClipboard" && info.selectionText) {
    const newItem = {
      text: info.selectionText,
      timestamp: new Date().toISOString(),
      url: tab.url,
      domain: new URL(tab.url).hostname,
      tags: []
    };

    chrome.storage.local.get({ clipboard: [] }, (result) => {
      const clipboard = [newItem, ...result.clipboard];
      chrome.storage.local.set({ clipboard }, () => {
        // 通知侧边栏更新
        chrome.runtime.sendMessage({ message: 'clipboardUpdated' });
      });
    });
  }
});

// 点击扩展图标打开侧边栏
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});


// --- 消息中心：处理来自 sidebar 和 content script 的所有消息 ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const actions = {
    getClipboardItems: () => {
      chrome.storage.local.get({ clipboard: [] }, (result) => sendResponse(result.clipboard));
      return true;
    },
    updateClipboardItem: (data) => {
      chrome.storage.local.get({ clipboard: [] }, (result) => {
        const index = result.clipboard.findIndex(clip => clip.timestamp === data.item.timestamp);
        if (index > -1) {
          result.clipboard[index] = { ...result.clipboard[index], ...data.updates };
          chrome.storage.local.set({ clipboard: result.clipboard }, () => sendResponse({ success: true }));
        } else {
          // 修改点
          sendResponse({ success: false, error: chrome.i18n.getMessage("errorItemNotFound") });
        }
      });
      return true;
    },
    deleteClipboardItem: (data) => {
      chrome.storage.local.get({ clipboard: [] }, (result) => {
        const newClipboard = result.clipboard.filter(clip => clip.timestamp !== data.timestamp);
        chrome.storage.local.set({ clipboard: newClipboard }, () => sendResponse({ success: true }));
      });
      return true;
    },
    getSavedForms: () => {
      chrome.storage.local.get({ savedForms: [] }, (result) => sendResponse(result.savedForms));
      return true;
    },
    saveExtractedForms: (data) => {
       chrome.storage.local.get({ savedForms: [] }, (result) => {
        const updatedForms = result.savedForms.concat(data.forms);
        chrome.storage.local.set({ savedForms: updatedForms }, () => sendResponse({ success: true }));
      });
      return true;
    },
    deleteSavedForm: (data) => {
      chrome.storage.local.get({ savedForms: [] }, (result) => {
        result.savedForms.splice(data.index, 1);
        chrome.storage.local.set({ savedForms: result.savedForms }, () => sendResponse({ success: true }));
      });
      return true;
    },
    updateSavedForm: (data) => {
      chrome.storage.local.get({ savedForms: [] }, (result) => {
        if (result.savedForms && result.savedForms[data.index]) {
          result.savedForms[data.index] = data.form;
          chrome.storage.local.set({ savedForms: result.savedForms }, () => sendResponse({ success: true }));
        } else {
          // 修改点
          sendResponse({ success: false, error: chrome.i18n.getMessage("errorFormNotFound") });
        }
      });
      return true;
    },
    saveFormMapping: (data) => {
      chrome.storage.local.get({ formMappings: [] }, (result) => {
        let mappings = result.formMappings || [];
        const { mappingData } = data;
        const existingMappingIndex = mappings.findIndex(m => m.name === mappingData.name && m.urlPattern === mappingData.urlPattern);
        
        if (existingMappingIndex > -1) {
          mappings[existingMappingIndex].mappings.push({
            field: mappingData.field,
            selectors: mappingData.selectors,
            columnValue: mappingData.columnValue
          });
          mappings[existingMappingIndex].timestamp = new Date().toISOString();
        } else {
          mappings.push({
            name: mappingData.name,
            urlPattern: mappingData.urlPattern,
            timestamp: new Date().toISOString(),
            mappings: [{
              field: mappingData.field,
              selectors: mappingData.selectors,
              columnValue: mappingData.columnValue
            }]
          });
        }
        chrome.storage.local.set({ formMappings: mappings }, () => sendResponse({ success: true }));
      });
      return true;
    },
    exportData: (data) => {
        chrome.storage.local.get(null, (allData) => {
            const exportObj = {
                version: "1.1",
                exportDate: new Date().toISOString(),
                data: allData
            };
            sendResponse(exportObj);
        });
        return true;
    },
    importData: (data) => {
        chrome.storage.local.clear(() => {
            chrome.storage.local.set(data.data, (result) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true });
                }
            });
        });
        return true;
    },
    extractFormData: () => {
      sendMessageToActiveTab({ action: "extractForm" }, sendResponse);
      return true;
    },
    autoFillForm: (data) => {
      sendMessageToActiveTab({ action: "autoFillForm", data: data.mappingData }, sendResponse);
      return true;
    },
    toggleMappingMode: (data) => {
      const action = data.isStarting ? "startFormMapping" : "stopFormMapping";
      sendMessageToActiveTab({ action }, sendResponse);
      return true;
    }
  };

  if (actions[request.action]) {
    return actions[request.action](request, sender);
  }

  if (request.action === "showMappingDialog" || request.action === "mapping_finished") {
      chrome.runtime.sendMessage(request);
  }
});

console.log("Super Clipboard service worker started.");