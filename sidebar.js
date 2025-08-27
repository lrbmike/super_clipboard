// sidebar.js - UI Controller

document.addEventListener('DOMContentLoaded', () => {

  // --- 国际化渲染函数 ---
  function localizeHtmlPage() {
    // 处理 data-i18n 属性 (设置元素的 textContent)
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const message = chrome.i18n.getMessage(element.getAttribute('data-i18n'));
      if (message) {
        element.textContent = message;
      }
    });

    // 处理 data-i18n-placeholder 属性
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const message = chrome.i18n.getMessage(element.getAttribute('data-i18n-placeholder'));
      if (message) {
        element.placeholder = message;
      }
    });

    // 处理 data-i18n-title 属性
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const message = chrome.i18n.getMessage(element.getAttribute('data-i18n-title'));
      if (message) {
        element.title = message;
      }
    });

    // 单独处理页面标题
    document.title = chrome.i18n.getMessage('extensionName');
  }

  // --- 在所有代码之前立即调用它 ---
  localizeHtmlPage();

  // --- DOM 元素定义 ---

  // 面板元素
  const mainPanel = document.getElementById('main-panel');
  const formPanel = document.getElementById('form-panel');
  
  // 主面板元素
  const searchBox = document.getElementById('search-box');
  const tagSearchBox = document.getElementById('tag-search-box');
  const tagSearchWrapper = document.getElementById('tag-search-wrapper');
  const clipboardList = document.getElementById('clipboard-list');
  const toggleTagsBtn = document.getElementById('toggle-tags-btn');
  const tagsContainer = document.getElementById('tags-container');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFileInput = document.getElementById('import-file-input');
  const formPanelBtn = document.getElementById('form-panel-btn');
  const extractFormWrapper = document.getElementById('extract-form-wrapper');
  
  // 表单面板元素
  const backToMainBtn = document.getElementById('back-to-main-btn');
  const formMapBtn = document.getElementById('form-map-btn');
  const saveFormDataBtn = document.getElementById('save-form-data-btn');
  const formDataContainer = document.getElementById('form-data-container');
  
  // Saved Forms 搜索元素
  const savedFormsSearchBox = document.getElementById('saved-forms-search');
  const savedFormsSearchClearBtn = document.getElementById('saved-forms-search-clear-btn');
  
  // 模态框元素
  const formMappingModal = document.getElementById('form-mapping-modal');
  const closeModalButtons = document.querySelectorAll('.close-modal');
  const saveMappingBtn = document.getElementById('save-mapping-btn');

  // 表单面板标签页元素
  const formTabButtons = document.querySelectorAll('.form-tabs .tab-button');
  const formTabContents = document.querySelectorAll('.form-tab-content');
  
  // 保存的数据列表容器
  const savedFormsList = document.getElementById('saved-forms-list');
  
  // --- 状态变量 ---
  let selectedTag = null;
  let currentPage = 1;
  const itemsPerPage = 10;
  let isTagsExpanded = false;
  let currentTab = null;
  let mappingFieldData = null; // 存储正在被映射的字段数据
  let isMappingMode = false;
  
  // Saved Forms 分页和搜索状态变量
  let savedFormsCurrentPage = 1;
  const savedFormsItemsPerPage = 10;
  let savedFormsSearchTerm = '';

  // --- 初始化 ---

  // 获取当前活动标签页
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs.length > 0) {
      currentTab = tabs[0];
    }
  });

  // 设置模态框中的国际化文本 (这些是动态加载的，需要在JS中设置)
 function setModalI18nText() {
    const mapFormTitle = document.querySelector('#form-mapping-modal .modal-header h2');
    if (mapFormTitle) mapFormTitle.textContent = chrome.i18n.getMessage("mapFormTitle");
    
    const fieldNameLabel = document.querySelector('label[for="field-name"]');
    if (fieldNameLabel) fieldNameLabel.textContent = chrome.i18n.getMessage("formFieldNameLabel");

    const mappingNameLabel = document.querySelector('label[for="mapping-name"]');
    if (mappingNameLabel) mappingNameLabel.textContent = chrome.i18n.getMessage("formMappingNameLabel");
    
    const mappingNameInput = document.getElementById('mapping-name');
    if (mappingNameInput) mappingNameInput.placeholder = chrome.i18n.getMessage("formMappingNamePlaceholder");

    const mappingColumnLabel = document.querySelector('label[for="mapping-column"]');
    if (mappingColumnLabel) mappingColumnLabel.textContent = chrome.i18n.getMessage("formMappingColumnLabel");
    
    const mappingColumnInput = document.getElementById('mapping-column');
    if (mappingColumnInput) mappingColumnInput.placeholder = chrome.i18n.getMessage("formMappingColumnPlaceholder");

    const saveMappingBtn = document.getElementById('save-mapping-btn');
    if (saveMappingBtn) saveMappingBtn.textContent = chrome.i18n.getMessage("saveButtonTitle");
  }
  setModalI18nText();
  
  // --- 事件监听器 ---

  // 面板切换
  formPanelBtn.addEventListener('click', () => {
    switchToPanel(formPanel);
    formTabButtons[0].click(); 
  });
  backToMainBtn.addEventListener('click', () => switchToPanel(mainPanel));

  // 导出/导入
  exportBtn.addEventListener('click', exportClipboardData);
  importBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) importClipboardData(file);
    event.target.value = '';
  });
  
  // Saved Forms 搜索功能
  if (savedFormsSearchBox) {
      savedFormsSearchBox.addEventListener('input', () => {
          savedFormsSearchTerm = savedFormsSearchBox.value;
          savedFormsCurrentPage = 1; // 重置到第一页
          loadSavedForms();
          updateSavedFormsClearButtonVisibility();
      });
  }
  
  if (savedFormsSearchClearBtn) {
      savedFormsSearchClearBtn.addEventListener('click', () => {
          savedFormsSearchBox.value = '';
          savedFormsSearchTerm = '';
          savedFormsCurrentPage = 1; // 重置到第一页
          loadSavedForms();
          updateSavedFormsClearButtonVisibility();
      });
  }

  saveFormDataBtn.addEventListener('click', () => {
    const formsToSave = getFormsToSaveFromUI();
    if (formsToSave.length > 0) {
      chrome.runtime.sendMessage({ action: 'saveExtractedForms', forms: formsToSave }, (response) => {
        if (response && response.success) {
          alert(chrome.i18n.getMessage("saveFormsSuccessAlert", [String(formsToSave.length)]));
          const savedFormsTabButton = document.querySelector('.form-tabs .tab-button[data-tab="saved-forms"]');
          if (savedFormsTabButton) {
            savedFormsTabButton.click();
          }
        } else {
          alert(chrome.i18n.getMessage("saveFormsFailedAlert"));
        }
      });
    } else {
      alert(chrome.i18n.getMessage("noFieldsSelectedAlert"));
    }
  });
  
  formMapBtn.addEventListener('click', () => {
      isMappingMode = !isMappingMode;
      chrome.runtime.sendMessage({ action: 'toggleMappingMode', isStarting: isMappingMode }, (response) => {
          if (response && response.success) {
              updateMappingButtonUI();
          } else {
              const errorMsg = response?.error || chrome.i18n.getMessage("unknownErrorText");
              alert(chrome.i18n.getMessage("toggleMappingModeErrorAlert", [errorMsg]));
              isMappingMode = false;
              updateMappingButtonUI();
          }
      });
  });

  saveMappingBtn.addEventListener('click', saveFormMapping);

  closeModalButtons.forEach(button => {
    button.addEventListener('click', () => button.closest('.modal').classList.add('hidden'));
  });
  window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
      event.target.classList.add('hidden');
    }
  });

  // 标签页切换
  formTabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.tab;
      activateTab(formTabButtons, formTabContents, button, `${tabId}-tab`);
      
      if (tabId === 'extract-form') {
        showInitialExtractView();
      } else if (tabId === 'saved-forms') {
        savedFormsCurrentPage = 1;
        savedFormsSearchTerm = '';
        if (savedFormsSearchBox) {
            savedFormsSearchBox.value = '';
            updateSavedFormsClearButtonVisibility();
        }
        loadSavedForms();
      }
    });
  });
  
  // 搜索和过滤
  searchBox.addEventListener('input', () => { loadClipboardItems(); updateClearButtonVisibility(); });
  tagSearchBox.addEventListener('input', () => { loadClipboardItems(); updateClearButtonVisibility(); });
  document.getElementById('search-clear-btn')?.addEventListener('click', () => { searchBox.value = ''; loadClipboardItems(); updateClearButtonVisibility(); });
  document.getElementById('tag-search-clear-btn')?.addEventListener('click', () => { tagSearchBox.value = ''; loadClipboardItems(); updateClearButtonVisibility(); });
  toggleTagsBtn.addEventListener('click', toggleTagsVisibility);


  // --- 核心功能函数 ---
  
  // 面板和标签页管理
  function switchToPanel(panelToShow) {
    mainPanel.classList.remove('active');
    formPanel.classList.remove('active');
    panelToShow.classList.add('active');
  }

  function activateTab(buttons, contents, activeButton, activeContentId) {
    buttons.forEach(btn => btn.classList.remove('active'));
    activeButton.classList.add('active');
    contents.forEach(content => content.classList.remove('active'));
    const activeContent = document.getElementById(activeContentId);
    if(activeContent) activeContent.classList.add('active');
  }

  // 表单数据UI处理
  function renderFormData(forms) {
    formDataContainer.innerHTML = '';
    if (!forms || forms.length === 0) {
      formDataContainer.innerHTML = `<p style="text-align: center;">${chrome.i18n.getMessage("noFormsFoundText")}</p>`;
      return;
    }

    const naText = chrome.i18n.getMessage("notAvailableShort");
    const unnamedFieldText = chrome.i18n.getMessage("unnamedFieldLabel");
    const typeText = chrome.i18n.getMessage("fieldTypeLabel");
    const idText = chrome.i18n.getMessage("fieldIdLabel");
    const nameText = chrome.i18n.getMessage("fieldNameDetailLabel");

    forms.forEach((form, formIndex) => {
      const formSection = document.createElement('div');
      formSection.className = 'form-section';
      const formTitle = form.formName || chrome.i18n.getMessage("formDefaultName", [String(formIndex + 1)]);
      
      formSection.innerHTML = `
        <input type="text" class="edit-input form-title-input" value="${formTitle.replace(/"/g, "&quot;")}">
        <div class="form-fields-container">
          ${form.fields.map((field, fieldIndex) => `
            <div class="form-field-item">
              <input type="checkbox" id="field-${formIndex}-${fieldIndex}" checked>
              <div class="form-field-info">
                <label for="field-${formIndex}-${fieldIndex}" class="form-field-label">${field.label || unnamedFieldText}</label>
                <div class="form-field-details">${typeText}: ${field.type} | ${idText}: ${field.id || naText} | ${nameText}: ${field.name || naText}</div>
                <input type="text" class="form-field-value" value="${(field.value || '').replace(/"/g, "&quot;")}" placeholder="${field.placeholder || ''}">
              </div>
            </div>
          `).join('')}
        </div>
      `;

      formDataContainer.appendChild(formSection);
    });
  }

  function showInitialExtractView() {
    formDataContainer.innerHTML = ''; // Clear previous results
    saveFormDataBtn.style.display = 'none'; // Hide save button

    extractFormWrapper.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <p style="margin-bottom: 20px;">${chrome.i18n.getMessage("extractFormInitialText")}</p>
        <button id="trigger-extract-btn" class="btn-primary" style="padding: 10px 20px; font-size: 16px;">${chrome.i18n.getMessage("extractPageFormsButton")}</button>
      </div>
    `;

    document.getElementById('trigger-extract-btn').addEventListener('click', () => {
      extractFormWrapper.innerHTML = `<p style="text-align: center;">${chrome.i18n.getMessage("extractingText")}</p>`; 
      
      chrome.runtime.sendMessage({ action: 'extractFormData' }, (response) => {
        extractFormWrapper.innerHTML = '';
        if (response && response.success) {
          if (response.formData && response.formData.length > 0) {
            renderFormData(response.formData);
            saveFormDataBtn.style.display = 'block';
          } else {
            formDataContainer.innerHTML = `<p style="text-align: center;">${chrome.i18n.getMessage("noFormsFoundText")}</p>`;
          }
        } else {
          const errorMessage = response?.error || 'Could not extract form data.';
          formDataContainer.innerHTML = `<p style="text-align: center;">${chrome.i18n.getMessage("extractFormErrorText", [errorMessage])}</p>`;
        }
      });
    });
  }

  function getFormsToSaveFromUI() {
    const formsToSave = [];
    formDataContainer.querySelectorAll('.form-section').forEach(section => {
      const fields = [];
      section.querySelectorAll('.form-field-item').forEach(item => {
        if (item.querySelector('input[type="checkbox"]').checked) {
          fields.push({
            label: item.querySelector('.form-field-label').textContent,
            details: item.querySelector('.form-field-details').textContent,
            value: item.querySelector('.form-field-value').value,
          });
        }
      });
      
      if (fields.length > 0) {
        const formName = section.querySelector('.form-title-input').value;
        formsToSave.push({
          formName: formName,
          url: currentTab ? currentTab.url : '',
          timestamp: new Date().toISOString(),
          fields: fields
        });
      }
    });
    return formsToSave;
  }
  
  // 加载/渲染已保存的数据
  function loadSavedForms(container = savedFormsList) {
    chrome.runtime.sendMessage({ action: 'getSavedForms' }, (forms) => {
      if (forms) {
          const sortedForms = forms.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          renderSavedForms(sortedForms, container);
      }
    });
  }

  function renderSavedForms(forms, container) {
    let filteredForms = forms;
    if (savedFormsSearchTerm) {
        filteredForms = forms.filter(form => 
            form.formName.toLowerCase().includes(savedFormsSearchTerm.toLowerCase()) ||
            form.fields.some(field => 
                field.label.toLowerCase().includes(savedFormsSearchTerm.toLowerCase()) ||
                (field.value && field.value.toLowerCase().includes(savedFormsSearchTerm.toLowerCase()))
            )
        );
    }
    
    container.innerHTML = '';
    
    const totalItems = filteredForms.length;
    const totalPages = Math.ceil(totalItems / savedFormsItemsPerPage);
    
    if (savedFormsCurrentPage > totalPages && totalPages > 0) {
        savedFormsCurrentPage = totalPages;
    }
    
    if (totalItems === 0) {
        container.innerHTML = `<p>${chrome.i18n.getMessage("noSavedFormsFoundText")}</p>`;
        return;
    }
    
    const startIndex = (savedFormsCurrentPage - 1) * savedFormsItemsPerPage;
    const paginatedForms = filteredForms.slice(startIndex, Math.min(startIndex + savedFormsItemsPerPage, filteredForms.length));
    
    paginatedForms.forEach((form) => {
        const actualIndex = forms.indexOf(form);
        const item = document.createElement('div');
        item.className = 'saved-form-item';
        item.innerHTML = `
            <div class="saved-form-header"><span class="saved-form-title">${form.formName.replace(/</g,"&lt;")}</span></div>
            <div class="saved-form-meta">${chrome.i18n.getMessage("savedMetaPrefix")}: ${new Date(form.timestamp).toLocaleString()}</div>
            <div class="saved-form-fields">${form.fields.map(f => `<div class="saved-form-field"><span class="field-label">${f.label.replace(/</g,"&lt;")}:</span> <span class="field-value">${(f.value || '').replace(/</g,"&lt;")}</span></div>`).join('')}</div>
            <div class="form-actions-inline">
                <button class="btn-small btn-secondary edit-form-btn" data-index="${actualIndex}">${chrome.i18n.getMessage("editButtonTitle")}</button>
                <button class="btn-small btn-primary autofill-form-btn" data-index="${actualIndex}">${chrome.i18n.getMessage("autofillButtonText")}</button>
                <button class="btn-small btn-secondary delete-form-btn" data-index="${actualIndex}">${chrome.i18n.getMessage("deleteButtonTitle")}</button>
            </div>`;
        container.appendChild(item);
    });

    if (totalPages > 1) {
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'form-pagination';
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            if (i === savedFormsCurrentPage) pageButton.classList.add('active');
            pageButton.addEventListener('click', () => {
                savedFormsCurrentPage = i;
                renderSavedForms(forms, container);
            });
            paginationContainer.appendChild(pageButton);
        }
        container.appendChild(paginationContainer);
    }

    container.querySelectorAll('.edit-form-btn').forEach(btn => btn.addEventListener('click', e => editSavedForm(parseInt(e.target.dataset.index), forms, container)));
    container.querySelectorAll('.autofill-form-btn').forEach(btn => btn.addEventListener('click', e => autofillFromSavedForm(forms[parseInt(e.target.dataset.index, 10)])));
    container.querySelectorAll('.delete-form-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            if (confirm(chrome.i18n.getMessage("deleteFormConfirm"))) {
                chrome.runtime.sendMessage({ action: 'deleteSavedForm', index: parseInt(e.target.dataset.index, 10) }, () => {
                    savedFormsCurrentPage = 1;
                    loadSavedForms();
                });
            }
        });
    });
    
    updateSavedFormsClearButtonVisibility();
  }

  function editSavedForm(index, forms, container) {
      const form = forms[index];
      const itemElement = container.querySelector(`.edit-form-btn[data-index="${index}"]`).closest('.saved-form-item');
      
      const headerElement = itemElement.querySelector('.saved-form-header');
      headerElement.innerHTML = `<input type="text" class="edit-input saved-form-title-input" value="${form.formName.replace(/"/g, "&quot;")}">`;
      
      itemElement.querySelector('.saved-form-fields').innerHTML = form.fields.map((field, fieldIndex) => `<div class="saved-form-field" style="display:block;margin-bottom:8px;"><label class="field-label" for="edit-field-${index}-${fieldIndex}">${field.label.replace(/</g,"&lt;")}</label><input class="edit-input" id="edit-field-${index}-${fieldIndex}" type="text" value="${(field.value || '').replace(/"/g, "&quot;")}" data-field-index="${fieldIndex}"></div>`).join('');
      
      itemElement.querySelector('.form-actions-inline').innerHTML = `<button class="btn-small btn-secondary cancel-edit-btn">${chrome.i18n.getMessage("cancelButtonTitle")}</button><button class="btn-small btn-primary save-edit-btn">${chrome.i18n.getMessage("saveButtonTitle")}</button>`;
      
      itemElement.querySelector('.save-edit-btn').addEventListener('click', () => {
          forms[index].formName = itemElement.querySelector('.saved-form-title-input').value;
          itemElement.querySelectorAll('.edit-input[data-field-index]').forEach(input => {
              forms[index].fields[parseInt(input.dataset.fieldIndex, 10)].value = input.value;
          });
          forms[index].timestamp = new Date().toISOString();
          chrome.runtime.sendMessage({ action: 'updateSavedForm', index, form: forms[index] }, () => loadSavedForms(container));
      });

      itemElement.querySelector('.cancel-edit-btn').addEventListener('click', () => renderSavedForms(forms, container));
  }

  function autofillFromSavedForm(form) {
      const mappingData = {
          mappings: form.fields.map(field => {
              const idMatch = field.details.match(/ID: ([^|]+)/);
              const nameMatch = field.details.match(/Name: ([^|]+)/);
              const selectors = [];
              if (idMatch && idMatch[1].trim() !== 'N/A' && idMatch[1].trim() !== chrome.i18n.getMessage("notAvailableShort")) selectors.push(`#${CSS.escape(idMatch[1].trim())}`);
              if (nameMatch && nameMatch[1].trim() !== 'N/A' && nameMatch[1].trim() !== chrome.i18n.getMessage("notAvailableShort")) selectors.push(`[name="${CSS.escape(nameMatch[1].trim())}"]`);
              selectors.push(`[placeholder="${CSS.escape(field.label)}"]`, `[aria-label="${CSS.escape(field.label)}"]`);
              return { selectors, columnValue: field.value };
          })
      };
      chrome.runtime.sendMessage({ action: 'autoFillForm', mappingData });
  }

  function showMappingDialog(fieldData) {
    mappingFieldData = fieldData;
    document.getElementById('field-name').value = fieldData.elementLabel;
    document.getElementById('mapping-name').value = '';
    document.getElementById('mapping-column').value = '';
    formMappingModal.classList.remove('hidden');
    document.getElementById('mapping-name').focus();
  }

  function saveFormMapping() {
    if (!mappingFieldData) return alert(chrome.i18n.getMessage("noMappingFieldDataAlert"));
    const mappingName = document.getElementById('mapping-name').value.trim();
    const mappingColumn = document.getElementById('mapping-column').value.trim();
    if (!mappingName || !mappingColumn) return alert(chrome.i18n.getMessage("mappingInputErrorAlert"));

    const mappingData = {
      name: mappingName,
      urlPattern: new URL(currentTab.url).hostname,
      field: mappingFieldData.elementLabel,
      selectors: mappingFieldData.selectors,
      columnValue: mappingColumn
    };
    
    chrome.runtime.sendMessage({ action: 'saveFormMapping', mappingData }, (response) => {
        if(response && response.success) {
            alert(chrome.i18n.getMessage("mappingSaveSuccessAlert"));
            formMappingModal.classList.add('hidden');
            mappingFieldData = null;
        } else {
            const errorMsg = response?.error || chrome.i18n.getMessage("unknownErrorText");
            alert(chrome.i18n.getMessage("mappingSaveFailedAlert", [errorMsg]));
        }
    });
  }

  // 导入/导出
  function exportClipboardData() {
      chrome.runtime.sendMessage({ action: 'exportData' }, (exportObj) => {
        if(exportObj) {
            const dataStr = JSON.stringify(exportObj, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `super-clipboard-export-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
        }
      });
  }

  function importClipboardData(file) {
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const importObj = JSON.parse(event.target.result);
              if (confirm(chrome.i18n.getMessage("importConfirmMessage"))) {
                  chrome.runtime.sendMessage({ action: 'importData', data: importObj }, (response) => {
                      if(response.success) {
                          alert(chrome.i18n.getMessage("importSuccessMessage"));
                          loadClipboardItems();
                          loadSavedForms(); 
                      } else {
                          alert(chrome.i18n.getMessage("importFailedMessage", [response.error]));
                      }
                  });
              }
          } catch (error) {
              alert(chrome.i18n.getMessage("importFileReadErrorMessage"));
          }
      };
      reader.readAsText(file);
  }
  
  // 剪贴板核心功能
  function loadClipboardItems() {
    chrome.runtime.sendMessage({ action: 'getClipboardItems' }, (allItems) => {
      if(!allItems) return;
      const searchTerm = searchBox.value.toLowerCase();
      const tagSearchTerm = tagSearchBox.value.toLowerCase();

      let filteredItems = allItems.filter(item => 
        (item.text || '').toLowerCase().includes(searchTerm) && 
        (!selectedTag || item.tags.includes(selectedTag)) &&
        (!tagSearchTerm || item.tags.some(tag => tag.toLowerCase().includes(tagSearchTerm)))
      );
      renderTagFilters(allItems);
      renderClipboardItems(filteredItems);
      updateClearButtonVisibility();
    });
  }

  function renderClipboardItems(items) {
    clipboardList.innerHTML = '';
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = items.slice(startIndex, startIndex + itemsPerPage);

    const groupedByDate = paginatedItems.reduce((groups, item) => {
      const date = new Date(item.timestamp).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
      return groups;
    }, {});

    Object.keys(groupedByDate).forEach(date => {
      const dateHeader = document.createElement('h3');
      dateHeader.textContent = date;
      clipboardList.appendChild(dateHeader);
      groupedByDate[date].forEach(item => clipboardList.appendChild(createItemElement(item)));
    });

    const totalPages = Math.ceil(items.length / itemsPerPage);
    if (totalPages > 1) {
      clipboardList.appendChild(createPagination(totalPages));
    }
  }

  function createItemElement(item) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'clipboard-item';

  // 使用国际化API为所有按钮的 title 属性设置文本
  itemDiv.innerHTML = `
    <div class="item-header">
      <div class="item-time">${new Date(item.timestamp).toLocaleTimeString()}</div>
      <div class="item-actions">
        <button class="copy-btn" title="${chrome.i18n.getMessage("copyButtonTitle")}">📋</button>
        <button class="edit-btn" title="${chrome.i18n.getMessage("editButtonTitle")}">✏️</button>
        <button class="delete-btn" title="${chrome.i18n.getMessage("deleteButtonTitle")}">🗑️</button>
        <a href="${item.url}" target="_blank" title="${chrome.i18n.getMessage("linkButtonTitle")}">🔗</a>
        <button class="add-tag-btn" title="${chrome.i18n.getMessage("addTagButtonTitle")}">🏷️</button>
      </div>
    </div>
    <div class="item-text" contenteditable="false">${(item.text || '').replace(/</g, "&lt;")}</div>
    <div class="item-tags">
      ${item.tags.map(tag => 
        `<span class="tag">${tag.replace(/</g, "&lt;")}
           <button class="delete-tag-btn" data-tag="${tag.replace(/"/g, '&quot;')}">x</button>
         </span>`
      ).join('')}
    </div>
    <div class="item-domain">${(item.domain || '').replace(/</g, "&lt;")}</div>`;
  
  // --- 为新创建的元素绑定事件监听器 ---
  
  // 复制按钮
  itemDiv.querySelector('.copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(item.text);
    const btn = itemDiv.querySelector('.copy-btn');
    btn.textContent = '✓';
    setTimeout(() => btn.textContent = '📋', 1500);
  });

  // 编辑按钮
  itemDiv.querySelector('.edit-btn').addEventListener('click', (e) => handleEdit(e.target, item));
  
  // 删除按钮
  itemDiv.querySelector('.delete-btn').addEventListener('click', () => handleDelete(item));
  
  // 添加标签按钮
  itemDiv.querySelector('.add-tag-btn').addEventListener('click', () => handleAddTag(item));
  
  // 删除单个标签的按钮 (为每个标签按钮都添加监听)
  itemDiv.querySelectorAll('.delete-tag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => handleDeleteTag(item, e.target.dataset.tag));
  });

  return itemDiv;
}

function handleEdit(button, item) {
    const textDiv = button.closest('.clipboard-item').querySelector('.item-text');
    const isEditable = textDiv.isContentEditable;
    textDiv.contentEditable = !isEditable;
    button.textContent = isEditable ? '✏️' : '💾';
    if (isEditable) { // 保存
      chrome.runtime.sendMessage({ action: 'updateClipboardItem', item, updates: { text: textDiv.textContent } }, loadClipboardItems);
    } else { // 编辑
      textDiv.focus();
    }
  }

  function handleDelete(item) {
    if (confirm(chrome.i18n.getMessage("deleteItemConfirm"))) {
      chrome.runtime.sendMessage({ action: 'deleteClipboardItem', timestamp: item.timestamp }, loadClipboardItems);
    }
  }

  function handleAddTag(item) {
    const newTag = prompt(chrome.i18n.getMessage("enterTagPrompt"));
    if (newTag && newTag.trim()) {
      const newTags = [...new Set([...item.tags, newTag.trim()])]; // Use Set to avoid duplicates
      chrome.runtime.sendMessage({ action: 'updateClipboardItem', item, updates: { tags: newTags } }, loadClipboardItems);
    }
  }
  
  function handleDeleteTag(item, tagToDelete) {
      const newTags = item.tags.filter(t => t !== tagToDelete);
      chrome.runtime.sendMessage({ action: 'updateClipboardItem', item, updates: { tags: newTags } }, loadClipboardItems);
  }

  // --- UI 辅助函数 ---
  function renderTagFilters(items) {
    const tagCounts = items.flatMap(item => item.tags).reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
    
    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    
    tagsContainer.innerHTML = '';
    const allBtn = createTagButton(chrome.i18n.getMessage("allTagsButton"), null, selectedTag === null);
    allBtn.addEventListener('click', () => { selectedTag = null; currentPage = 1; loadClipboardItems(); });
    tagsContainer.appendChild(allBtn);

    const tagSearchTerm = tagSearchBox.value.toLowerCase();
    sortedTags
      .filter(tag => tag.toLowerCase().includes(tagSearchTerm))
      .forEach((tag, index) => {
        const btn = createTagButton(`${tag} (${tagCounts[tag]})`, tag, selectedTag === tag);
        btn.addEventListener('click', () => { selectedTag = tag; currentPage = 1; loadClipboardItems(); });
        if (index >= 5 && !isTagsExpanded) {
          btn.style.display = 'none';
        }
        tagsContainer.appendChild(btn);
    });
  }
  
  function createTagButton(text, value, isActive) {
      const button = document.createElement('button');
      button.className = 'tag-button' + (isActive ? ' active' : '');
      button.textContent = text;
      button.dataset.value = value;
      return button;
  }

  function createPagination(totalPages) {
    const div = document.createElement('div');
    div.className = 'pagination';
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      if (i === currentPage) btn.className = 'active';
      btn.addEventListener('click', () => { currentPage = i; loadClipboardItems(); });
      div.appendChild(btn);
    }
    return div;
  }

  function toggleTagsVisibility() {
      isTagsExpanded = !isTagsExpanded;
      toggleTagsBtn.textContent = isTagsExpanded ? '▲' : '▼';
      tagSearchWrapper.classList.toggle('hidden', !isTagsExpanded);
      loadClipboardItems(); // To re-apply visibility logic
  }
  
  function updateClearButtonVisibility() {
    document.getElementById('search-clear-btn').style.display = searchBox.value ? 'block' : 'none';
    document.getElementById('tag-search-clear-btn').style.display = tagSearchBox.value ? 'block' : 'none';
  }
  
  function updateSavedFormsClearButtonVisibility() {
      if (savedFormsSearchClearBtn) {
          savedFormsSearchClearBtn.style.display = savedFormsSearchBox.value ? 'block' : 'none';
      }
  }

  // (This function is likely defined elsewhere, stubbing it here for completeness if needed)
  function updateMappingButtonUI() {
    if (formMapBtn) {
      formMapBtn.classList.toggle('active', isMappingMode);
    }
  }

  // --- Chrome API 监听器 ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'clipboardUpdated') {
      loadClipboardItems();
    } else if (request.action === "showMappingDialog") {
      showMappingDialog(request.fieldData);
    } else if (request.action === "mapping_finished") {
      isMappingMode = false;
      updateMappingButtonUI();
    }
    // Return true to indicate you wish to send a response asynchronously
    // This is good practice, though not strictly necessary for all listeners.
    return true; 
  });
  
  // --- 初始加载 ---
  switchToPanel(mainPanel);
  loadClipboardItems();
  updateClearButtonVisibility();
  updateSavedFormsClearButtonVisibility();
});