// sidebar.js - UI Controller

document.addEventListener('DOMContentLoaded', () => {
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
  const tagsTitle = document.getElementById('tags-title');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFileInput = document.getElementById('import-file-input');
  const formPanelBtn = document.getElementById('form-panel-btn');
  
  // 表单面板元素
  const backToMainBtn = document.getElementById('back-to-main-btn');
  const formExtractBtn = document.getElementById('form-extract-btn');
  const formMapBtn = document.getElementById('form-map-btn');
  const saveFormDataBtn = document.getElementById('save-form-data-btn');
  const formDataContainer = document.getElementById('form-data-container');
  
  // 模态框元素
  const formMappingModal = document.getElementById('form-mapping-modal');
  const settingsModal = document.getElementById('settings-modal');
  const closeModalButtons = document.querySelectorAll('.close-modal');
  const saveMappingBtn = document.getElementById('save-mapping-btn');

  // 表单面板标签页元素
  const formTabButtons = document.querySelectorAll('.form-tabs .tab-button');
  const formTabContents = document.querySelectorAll('.form-tab-content');
  
  // 设置面板标签页元素
  const settingsTabButtons = document.querySelectorAll('.settings-tabs .tab-button');
  const settingsTabContents = document.querySelectorAll('.settings-tabs .tab-content');
  
  // 保存的数据列表容器
  const savedFormsList = document.getElementById('saved-forms-list');
  const formMappingsList = document.getElementById('form-mappings-list');
  const savedFormsSettingsList = document.getElementById('saved-forms-settings-list');
  const formMappingsSettingsList = document.getElementById('form-mappings-settings-list');
  
  // --- 状态变量 ---
  let selectedTag = null;
  let currentPage = 1;
  const itemsPerPage = 10;
  let isTagsExpanded = false;
  let currentTab = null;
  let mappingFieldData = null; // 存储正在被映射的字段数据
  let isMappingMode = false;

  // --- 初始化 ---

  // 获取当前活动标签页
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs.length > 0) {
      currentTab = tabs[0];
    }
  });

  // 设置国际化文本
  tagsTitle.textContent = chrome.i18n.getMessage("tagsTitle") || "Tags";
  searchBox.placeholder = chrome.i18n.getMessage("searchPlaceholder") || "Search clipboard items...";
  tagSearchBox.placeholder = chrome.i18n.getMessage("tagSearchPlaceholder") || "Search tags...";
  exportBtn.title = chrome.i18n.getMessage("exportButtonTitle") || "Export clipboard data";
  importBtn.title = chrome.i18n.getMessage("importButtonTitle") || "Import clipboard data";
  formPanelBtn.title = chrome.i18n.getMessage("formPanelButtonTitle") || "Form Panel";
  backToMainBtn.title = chrome.i18n.getMessage("backToMainButtonTitle") || "Back to Main";
  formExtractBtn.title = chrome.i18n.getMessage("extractFormButtonTitle") || "Extract Form";
  formMapBtn.title = chrome.i18n.getMessage("mapFormButtonTitle") || "Map Form";

  // --- 事件监听器 ---

  // 面板切换
  formPanelBtn.addEventListener('click', () => switchToPanel(formPanel));
  backToMainBtn.addEventListener('click', () => switchToPanel(mainPanel));

  // 导出/导入
  exportBtn.addEventListener('click', exportClipboardData);
  importBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) importClipboardData(file);
    event.target.value = '';
  });

  // 表单功能按钮
  formExtractBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'extractFormData' }, (response) => {
      if (response && response.success) {
        renderFormData(response.formData);
      } else {
        formDataContainer.innerHTML = `<p>Error: ${response?.error || 'Could not extract form.'}</p>`;
      }
    });
  });

  saveFormDataBtn.addEventListener('click', () => {
    const formsToSave = getFormsToSaveFromUI();
    if (formsToSave.length > 0) {
      chrome.runtime.sendMessage({ action: 'saveExtractedForms', forms: formsToSave }, (response) => {
        if (response && response.success) {
          alert(`Successfully saved data from ${formsToSave.length} form(s).`);
          formDataContainer.innerHTML = '';
        } else {
          alert('Failed to save forms.');
        }
      });
    } else {
      alert("No fields were selected to save.");
    }
  });
  
  formMapBtn.addEventListener('click', () => {
      isMappingMode = !isMappingMode;
      chrome.runtime.sendMessage({ action: 'toggleMappingMode', isStarting: isMappingMode }, (response) => {
          if (response && response.success) {
              updateMappingButtonUI();
          } else {
              alert(`Error toggling mapping mode: ${response?.error || 'Unknown error'}`);
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
      if (tabId === 'saved-forms') loadSavedForms(savedFormsList);
      else if (tabId === 'form-mappings') loadFormMappings(formMappingsList);
    });
  });
  
  // 搜索和过滤
  searchBox.addEventListener('input', () => { loadClipboardItems(); updateClearButtonVisibility(); });
  tagSearchBox.addEventListener('input', () => { loadClipboardItems(); updateClearButtonVisibility(); });
  document.getElementById('search-clear-btn')?.addEventListener('click', () => { searchBox.value = ''; loadClipboardItems(); });
  document.getElementById('tag-search-clear-btn')?.addEventListener('click', () => { tagSearchBox.value = ''; loadClipboardItems(); });
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
      formDataContainer.innerHTML = '<p>No forms found on this page.</p>';
      return;
    }
    forms.forEach((form, formIndex) => {
      const formSection = document.createElement('div');
      formSection.className = 'form-section';
      
      formSection.innerHTML = `
        <input type="text" class="edit-input form-title-input" value="${(form.formName || `Form ${formIndex + 1}`).replace(/"/g, "&quot;")}">
        <div class="form-fields-container">
          ${form.fields.map((field, fieldIndex) => `
            <div class="form-field-item">
              <input type="checkbox" id="field-${formIndex}-${fieldIndex}" checked>
              <div class="form-field-info">
                <label for="field-${formIndex}-${fieldIndex}" class="form-field-label">${field.label || 'Unnamed Field'}</label>
                <div class="form-field-details">Type: ${field.type} | ID: ${field.id || 'N/A'} | Name: ${field.name || 'N/A'}</div>
                <input type="text" class="form-field-value" value="${(field.value || '').replace(/"/g, "&quot;")}" placeholder="${field.placeholder || ''}">
              </div>
            </div>
          `).join('')}
        </div>
      `;

      formDataContainer.appendChild(formSection);
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
          formName: formName, // Use the (potentially edited) value from the input
          url: currentTab ? currentTab.url : '',
          timestamp: new Date().toISOString(),
          fields: fields
        });

      }
    });
    return formsToSave;
  }
  
  function updateMappingButtonUI() {
    formMapBtn.textContent = isMappingMode ? "⏹️" : "🗺️";
    formMapBtn.title = isMappingMode ? "Stop Form Mapping" : "Map Form";
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
    if (!mappingFieldData) return alert("No field data to save.");
    const mappingName = document.getElementById('mapping-name').value.trim();
    const mappingColumn = document.getElementById('mapping-column').value.trim();
    if (!mappingName || !mappingColumn) return alert("Please provide both a mapping name and a column value.");

    const mappingData = {
      name: mappingName,
      urlPattern: new URL(currentTab.url).hostname,
      field: mappingFieldData.elementLabel,
      selectors: mappingFieldData.selectors,
      columnValue: mappingColumn
    };
    
    chrome.runtime.sendMessage({ action: 'saveFormMapping', mappingData }, (response) => {
        if(response && response.success) {
            alert('Mapping saved successfully!');
            formMappingModal.classList.add('hidden');
            mappingFieldData = null;
        } else {
            alert(`Failed to save mapping: ${response?.error || 'Unknown error'}`);
        }
    });
  }

  // 加载/渲染已保存的数据
function loadSavedForms() {
  chrome.runtime.sendMessage({ action: 'getSavedForms' }, (forms) => {
      if (forms) {
          const sortedForms = forms.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          renderSavedForms(sortedForms, savedFormsList);
      }
  });
}
  
  function renderSavedForms(forms, container) {
      container.innerHTML = '';
      if (!forms || forms.length === 0) {
          container.innerHTML = `<p>No saved forms found.</p>`;
          return;
      }
      forms.forEach((form, index) => {
          const item = document.createElement('div');
          item.className = 'saved-form-item';
          item.innerHTML = `
              <div class="saved-form-header"><span class="saved-form-title">${form.formName.replace(/</g,"&lt;")}</span></div>
              <div class="saved-form-meta">Saved: ${new Date(form.timestamp).toLocaleString()}</div>
              <div class="saved-form-fields">${form.fields.map(f => `<div class="saved-form-field"><span class="field-label">${f.label.replace(/</g,"&lt;")}:</span> <span class="field-value">${(f.value || '').replace(/</g,"&lt;")}</span></div>`).join('')}</div>
              <div class="form-actions-inline">
                  <button class="btn-small btn-secondary edit-form-btn" data-index="${index}">Edit</button>
                  <button class="btn-small btn-primary autofill-form-btn" data-index="${index}">Auto-fill</button>
                  <button class="btn-small btn-secondary delete-form-btn" data-index="${index}">Delete</button>
              </div>`;
          container.appendChild(item);
      });

      container.querySelectorAll('.edit-form-btn').forEach(btn => btn.addEventListener('click', e => editSavedForm(parseInt(e.target.dataset.index), forms, container)));
      container.querySelectorAll('.autofill-form-btn').forEach(btn => btn.addEventListener('click', e => autofillFromSavedForm(forms[parseInt(e.target.dataset.index, 10)])));
      container.querySelectorAll('.delete-form-btn').forEach(btn => {
          btn.addEventListener('click', e => {
              if (confirm("Are you sure you want to delete this saved form?")) {
                  chrome.runtime.sendMessage({ action: 'deleteSavedForm', index: parseInt(e.target.dataset.index, 10) }, () => loadSavedForms(container));
              }
          });
      });
  }
function editSavedForm(index, forms, container) {
      const form = forms[index];
      const itemElement = container.querySelector(`.edit-form-btn[data-index="${index}"]`).closest('.saved-form-item');

      // *** MODIFICATION 1: Make the form title an editable input ***
      // Target the header element and replace its content with an input field.
      const headerElement = itemElement.querySelector('.saved-form-header');
      headerElement.innerHTML = `<input type="text" class="edit-input saved-form-title-input" value="${form.formName.replace(/"/g, "&quot;")}">`;
      
      // This part remains the same: it makes the fields editable.
      itemElement.querySelector('.saved-form-fields').innerHTML = form.fields.map((field, fieldIndex) => `<div class="saved-form-field" style="display:block;margin-bottom:8px;"><label class="field-label" for="edit-field-${index}-${fieldIndex}">${field.label.replace(/</g,"&lt;")}</label><input class="edit-input" id="edit-field-${index}-${fieldIndex}" type="text" value="${(field.value || '').replace(/"/g, "&quot;")}" data-field-index="${fieldIndex}"></div>`).join('');
      
      // This part also remains the same: it changes the action buttons.
      itemElement.querySelector('.form-actions-inline').innerHTML = `<button class="btn-small btn-secondary cancel-edit-btn">Cancel</button><button class="btn-small btn-primary save-edit-btn">Save</button>`;
      
      // Add event listener for the new "Save" button
      itemElement.querySelector('.save-edit-btn').addEventListener('click', () => {
          // *** MODIFICATION 2: Read the new title from the input when saving ***
          forms[index].formName = itemElement.querySelector('.saved-form-title-input').value;
          
          // This part remains the same: it reads the new field values.
          itemElement.querySelectorAll('.edit-input[data-field-index]').forEach(input => {
              forms[index].fields[parseInt(input.dataset.fieldIndex, 10)].value = input.value;
          });
          forms[index].timestamp = new Date().toISOString(); // Update timestamp

          // Send the entire updated form object to be saved
          chrome.runtime.sendMessage({ action: 'updateSavedForm', index, form: forms[index] }, () => loadSavedForms(container));
      });

      // Add event listener for the new "Cancel" button
      itemElement.querySelector('.cancel-edit-btn').addEventListener('click', () => renderSavedForms(forms, container));
  }

  function autofillFromSavedForm(form) {
      const mappingData = {
          mappings: form.fields.map(field => {
              const idMatch = field.details.match(/ID: ([^|]+)/);
              const nameMatch = field.details.match(/Name: ([^|]+)/);
              const selectors = [];
              if (idMatch && idMatch[1].trim() !== 'N/A') selectors.push(`#${CSS.escape(idMatch[1].trim())}`);
              if (nameMatch && nameMatch[1].trim() !== 'N/A') selectors.push(`[name="${CSS.escape(nameMatch[1].trim())}"]`);
              selectors.push(`[placeholder="${CSS.escape(field.label)}"]`, `[aria-label="${CSS.escape(field.label)}"]`);
              return { selectors, columnValue: field.value };
          })
      };
      chrome.runtime.sendMessage({ action: 'autoFillForm', mappingData });
  }

  function loadFormMappings(container) { /* Implement similarly to loadSavedForms */ }

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
              if (confirm(`Import data? This will overwrite all current data.`)) {
                  chrome.runtime.sendMessage({ action: 'importData', data: importObj }, (response) => {
                      if(response.success) {
                          alert("Import successful!");
                          loadClipboardItems();
                          // Potentially reload form data too
                      } else {
                          alert(`Import failed: ${response.error}`);
                      }
                  });
              }
          } catch (error) {
              alert("Failed to read file. Please check file format.");
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
    itemDiv.innerHTML = `
      <div class="item-header">
        <div class="item-time">${new Date(item.timestamp).toLocaleTimeString()}</div>
        <div class="item-actions">
          <button class="copy-btn" title="Copy">📋</button>
          <button class="edit-btn" title="Edit">✏️</button>
          <button class="delete-btn" title="Delete">🗑️</button>
          <a href="${item.url}" target="_blank" title="Go to link">🔗</a>
          <button class="add-tag-btn" title="Add Tag">🏷️</button>
        </div>
      </div>
      <div class="item-text" contenteditable="false">${(item.text || '').replace(/</g, "&lt;")}</div>
      <div class="item-tags">${item.tags.map(tag => `<span class="tag">${tag.replace(/</g, "&lt;")}<button class="delete-tag-btn" data-tag="${tag}">x</button></span>`).join('')}</div>
      <div class="item-domain">${(item.domain || '').replace(/</g, "&lt;")}</div>`;
    
    itemDiv.querySelector('.copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(item.text);
      const btn = itemDiv.querySelector('.copy-btn');
      btn.textContent = '✓';
      setTimeout(() => btn.textContent = '📋', 1500);
    });

    itemDiv.querySelector('.edit-btn').addEventListener('click', (e) => handleEdit(e.target, item));
    itemDiv.querySelector('.delete-btn').addEventListener('click', () => handleDelete(item));
    itemDiv.querySelector('.add-tag-btn').addEventListener('click', () => handleAddTag(item));
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
    if (confirm("Are you sure you want to delete this item?")) {
      chrome.runtime.sendMessage({ action: 'deleteClipboardItem', timestamp: item.timestamp }, loadClipboardItems);
    }
  }

  function handleAddTag(item) {
    const newTag = prompt("Enter a new tag:");
    if (newTag && newTag.trim()) {
      const newTags = [...item.tags, newTag.trim()];
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
    const allBtn = createTagButton("All", null, selectedTag === null);
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
  });
  
  // --- 初始加载 ---
  switchToPanel(mainPanel);
  loadClipboardItems();
});