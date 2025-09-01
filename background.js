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
      url: tab && tab.url ? tab.url : '自定义',
      domain: tab && tab.url ? new URL(tab.url).hostname : '自定义',
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
  
  // 定义所有 action 的处理器
  // *** 核心修改：所有函数都统一使用 (request, sender, sendResponse) 签名 ***
  const actions = {
    getClipboardItems: (request, sender, sendResponse) => {
      chrome.storage.local.get({ clipboard: [] }, (result) => sendResponse(result.clipboard));
      return true;
    },
    updateClipboardItem: (request, sender, sendResponse) => {
      chrome.storage.local.get({ clipboard: [] }, (result) => {
        const index = result.clipboard.findIndex(clip => clip.timestamp === request.item.timestamp);
        if (index > -1) {
          result.clipboard[index] = { ...result.clipboard[index], ...request.updates };
          chrome.storage.local.set({ clipboard: result.clipboard }, () => sendResponse({ success: true }));
        } else {
          sendResponse({ success: false, error: chrome.i18n.getMessage("errorItemNotFound") });
        }
      });
      return true;
    },
    deleteClipboardItem: (request, sender, sendResponse) => {
      chrome.storage.local.get({ clipboard: [] }, (result) => {
        const newClipboard = result.clipboard.filter(clip => clip.timestamp !== request.timestamp);
        chrome.storage.local.set({ clipboard: newClipboard }, () => sendResponse({ success: true }));
      });
      return true;
    },
    getSavedForms: (request, sender, sendResponse) => {
      chrome.storage.local.get({ savedForms: [] }, (result) => sendResponse(result.savedForms));
      return true;
    },
    saveExtractedForms: (request, sender, sendResponse) => {
       chrome.storage.local.get({ savedForms: [] }, (result) => {
        const updatedForms = result.savedForms.concat(request.forms);
        chrome.storage.local.set({ savedForms: updatedForms }, () => sendResponse({ success: true }));
      });
      return true;
    },
    deleteSavedForm: (request, sender, sendResponse) => {
      chrome.storage.local.get({ savedForms: [] }, (result) => {
        result.savedForms.splice(request.index, 1);
        chrome.storage.local.set({ savedForms: result.savedForms }, () => sendResponse({ success: true }));
      });
      return true;
    },
    updateSavedForm: (request, sender, sendResponse) => {
      chrome.storage.local.get({ savedForms: [] }, (result) => {
        if (result.savedForms && result.savedForms[request.index]) {
          result.savedForms[request.index] = request.form;
          chrome.storage.local.set({ savedForms: result.savedForms }, () => sendResponse({ success: true }));
        } else {
          sendResponse({ success: false, error: chrome.i18n.getMessage("errorFormNotFound") });
        }
      });
      return true;
    },
    saveFormMapping: (request, sender, sendResponse) => {
      chrome.storage.local.get({ formMappings: [] }, (result) => {
        let mappings = result.formMappings || [];
        const { mappingData } = request;
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
    exportData: (request, sender, sendResponse) => {
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
    importData: (request, sender, sendResponse) => { // 这是我们之前修改过的函数，保持不变
        const importedDataContainer = request.data;
        const dataToImport = importedDataContainer.data;

        if (!dataToImport || typeof dataToImport !== 'object') {
            const errorMessage = chrome.i18n.getMessage("importFileReadErrorMessage") || "Invalid file format.";
            sendResponse({ success: false, error: errorMessage });
            return true;
        }

        chrome.storage.local.set(dataToImport, () => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true });
                // 通知所有已连接的侧边栏更新
                chrome.runtime.sendMessage({ message: 'clipboardUpdated' });
            }
        });
        return true;
    },
    addClipboardItem: (request, sender, sendResponse) => {
      chrome.storage.local.get({ clipboard: [] }, (result) => {
        const clipboard = [request.item, ...result.clipboard];
        chrome.storage.local.set({ clipboard }, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true });
            // 通知所有已连接的侧边栏更新
            chrome.runtime.sendMessage({ message: 'clipboardUpdated' });
          }
        });
      });
      return true;
    },
    extractFormData: (request, sender, sendResponse) => {
      sendMessageToActiveTab({ action: "extractForm" }, sendResponse);
      return true;
    },
    autoFillForm: (request, sender, sendResponse) => {
      sendMessageToActiveTab({ action: "autoFillForm", data: request.mappingData }, sendResponse);
      return true;
    },
    toggleMappingMode: (request, sender, sendResponse) => {
      const action = request.isStarting ? "startFormMapping" : "stopFormMapping";
      sendMessageToActiveTab({ action }, sendResponse);
      return true;
    },
    // 下面这些是不需要响应的广播消息，所以它们没有 sendResponse，也不返回 true
    showMappingDialog: (request) => {
        chrome.runtime.sendMessage(request);
    },
    mapping_finished: (request) => {
        chrome.runtime.sendMessage(request);
    }
  };

  // 统一的调度器
  const handler = actions[request.action];

  if (handler) {
    // *** 核心修改：总是用这三个参数来调用 handler ***
    return handler(request, sender, sendResponse);
  } else {
    console.warn("Unknown action received in background.js:", request.action);
  }
});

console.log("Super Clipboard service worker started.");