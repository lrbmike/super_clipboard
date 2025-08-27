// background.js - Service Worker (FIXED for connection errors)

/**
 * 一个健壮的函数，用于向当前活动标签页发送消息。
 * 如果内容脚本尚未准备好（连接失败），它会尝试动态注入脚本然后重试。
 * @param {object} message - 要发送的消息对象，例如 { action: 'extractForm' }
 * @param {function} callback - 用于处理最终响应的回调函数
 */
function sendMessageToActiveTab(message, callback) {
  // 1. 查询当前活动标签页
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // 确保找到了一个活动标签页
    if (tabs && tabs.length > 0) {
      const tabId = tabs[0].id;
      
      // 2. 首次尝试发送消息
      chrome.tabs.sendMessage(tabId, message, (response) => {
        // 3. 检查是否是"接收端不存在"的特定错误
        if (chrome.runtime.lastError && 
            chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
          
          console.log("Content script not ready or injected. Attempting to inject and retry...");
          
          // 4. 动态注入 content.js
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }, (injectionResults) => {
            // 检查注入是否成功
            if (chrome.runtime.lastError) {
              console.error("Failed to inject script:", chrome.runtime.lastError);
              if (callback) callback({ success: false, error: "Failed to inject content script." });
              return;
            }
            
            // 5. 注入成功后，重试发送消息
            chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
              if (chrome.runtime.lastError) {
                console.error("Failed to send message even after retry:", chrome.runtime.lastError);
                if (callback) callback({ success: false, error: "Connection failed after script injection." });
              } else {
                // 重试成功
                if (callback) callback(retryResponse);
              }
            });
          });
        } else {
          // 6. 首次发送成功，或遇到了其他类型的错误
          if (callback) callback(response);
        }
      });
    } else {
      // 未找到活动标签页
      if (callback) callback({ success: false, error: "No active tab found." });
    }
  });
}

// --- 安装与初始化 ---
chrome.runtime.onInstalled.addListener(() => {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: "copyToClipboard",
    title: "Add to Super Clipboard",
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
    // --- 剪贴板数据操作 ---
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
          sendResponse({ success: false, error: "Item not found" });
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

    // --- 表单数据操作 ---
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
          sendResponse({ success: false, error: "Form not found" });
        }
      });
      return true;
    },
    saveFormMapping: (data) => {
      // (这个功能逻辑尚未在之前的代码中实现，这里补充上)
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


    // --- 页面操作 (全部使用新的辅助函数) ---
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

  // 执行对应的操作
  if (actions[request.action]) {
    // 注意：我们将request本身作为数据传递给处理函数
    return actions[request.action](request, sender);
  }

  // 转发其他类型的消息（如来自content.js的通知）
  if (request.action === "showMappingDialog" || request.action === "mapping_finished") {
      chrome.runtime.sendMessage(request);
  }
});

console.log("Super Clipboard service worker started.");