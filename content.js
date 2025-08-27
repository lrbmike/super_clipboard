// content.js - Page DOM Manipulator

/**
 * 监听来自 background script 的指令
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "extractForm":
      try {
        const formData = extractFormDataFromPage();
        sendResponse({ success: true, formData });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;
    
    case "autoFillForm":
      try {
        autoFillFormOnPage(request.data);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      break;

    case "startFormMapping":
      document.addEventListener('click', handleFieldClickForMapping, true);
      sendResponse({ success: true, status: "mapping_started" });
      break;

    case "stopFormMapping":
      document.removeEventListener('click', handleFieldClickForMapping, true);
      sendResponse({ success: true, status: "mapping_stopped" });
      break;
  }
});


/**
 * 从当前页面提取表单数据
 * @returns {Array} 表单数据数组
 */
function extractFormDataFromPage() {
  const forms = document.querySelectorAll('form');
  const formData = [];
  forms.forEach((form, index) => {
    const fields = [];
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      if (['submit', 'reset', 'button', 'hidden'].includes(input.type)) return;
      fields.push({
        name: input.name || input.id || '',
        id: input.id || '',
        type: input.type,
        label: getLabelForInput(input) || input.placeholder || input.name,
        value: input.type === 'password' ? '[HIDDEN]' : (input.value || ''),
        placeholder: input.placeholder || ''
      });
    });
    if (fields.length > 0) {
      formData.push({
        formId: form.id || `form-${index}`,
        formName: form.name || `Form ${index + 1}`,
        fields: fields
      });
    }
  });
  return formData;
}

/**
 * 将数据填充到页面的表单中
 * @param {Object} mappingData - 包含选择器和值的映射数据
 */
function autoFillFormOnPage(mappingData) {
  mappingData.mappings.forEach(mapping => {
    let element = null;
    for (const selector of mapping.selectors) {
      try {
        element = document.querySelector(selector);
        if (element) break;
      } catch (e) { /* 无效选择器，忽略 */ }
    }
    
    if (element) {
      // 检查元素类型并分别处理
      const elementType = element.type;
      const savedValue = mapping.columnValue;

      if (elementType === 'checkbox' || elementType === 'radio') {
        // 对于复选框和单选按钮，设置 .checked 属性
        // "on", "true", or true should check the box. Other values will uncheck it.
        const shouldBeChecked = savedValue === 'on' || savedValue === true || savedValue === 'true';
        element.checked = shouldBeChecked;
      } else {
        // 对于所有其他元素，设置 .value 属性
        element.value = savedValue;
      }

      // 触发事件以确保页面（尤其是使用React/Vue等框架的页面）能识别到值的变化
      ['input', 'change', 'blur'].forEach(eventType => {
        element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
      });

    } else {
      console.warn(`Super Clipboard: Could not find element for mapping with selectors:`, mapping.selectors);
    }
  });
}

/**
 * 处理映射模式下的字段点击事件
 */
function handleFieldClickForMapping(event) {
    const target = event.target;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || ['submit', 'reset', 'button'].includes(target.type)) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();

    // 停止监听，确保只选择一次
    document.removeEventListener('click', handleFieldClickForMapping, true);
    
    // 生成可靠的选择器
    const selectors = [];
    if (target.id) selectors.push(`#${CSS.escape(target.id)}`);
    if (target.name) selectors.push(`[name="${CSS.escape(target.name)}"]`);
    if (target.placeholder) selectors.push(`[placeholder="${CSS.escape(target.placeholder)}"]`);

    // 通知 sidebar 显示映射对话框
    chrome.runtime.sendMessage({
        action: "showMappingDialog",
        fieldData: {
            selectors: selectors,
            elementLabel: getLabelForInput(target) || target.name || target.id,
        }
    });

    // 通知 background 映射已完成，以便它可以通知 sidebar 更新UI
    chrome.runtime.sendMessage({ action: "mapping_finished" });
}


/**
 * 辅助函数：获取输入框的标签文本
 * @param {HTMLElement} input - 输入框元素
 * @returns {string} 标签文本
 */
function getLabelForInput(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.textContent.trim();
  }
  const parentLabel = input.closest('label');
  if (parentLabel) return parentLabel.textContent.trim().split('\n')[0];
  return input.getAttribute('aria-label') || '';
}

console.log('Super Clipboard content script loaded and ready.');