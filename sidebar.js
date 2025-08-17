document.addEventListener('DOMContentLoaded', () => {
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
  let selectedTag = null;
  let currentPage = 1;
  const itemsPerPage = 5;
  let isTagsExpanded = false;

  // 设置国际化文本（保留标题为英文）
  tagsTitle.textContent = chrome.i18n.getMessage("tagsTitle") || "Tags";
  searchBox.placeholder = chrome.i18n.getMessage("searchPlaceholder") || "Search clipboard items...";
  tagSearchBox.placeholder = chrome.i18n.getMessage("tagSearchPlaceholder") || "Search tags...";
  exportBtn.title = chrome.i18n.getMessage("exportButtonTitle") || "Export clipboard data";
  importBtn.title = chrome.i18n.getMessage("importButtonTitle") || "Import clipboard data";

  // 添加导出按钮事件监听器
  exportBtn.addEventListener('click', () => {
    exportClipboardData();
  });

  // 添加导入按钮事件监听器
  importBtn.addEventListener('click', () => {
    importFileInput.click(); // 触发文件选择对话框
  });

  // 添加文件选择事件监听器
  importFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      importClipboardData(file);
    }
    // 重置文件输入元素
    event.target.value = '';
  });

  // 导出剪贴板数据功能
  const exportClipboardData = () => {
    chrome.storage.local.get({ clipboard: [] }, (result) => {
      const clipboardData = result.clipboard;
      
      // 创建要导出的数据对象
      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        itemCount: clipboardData.length,
        items: clipboardData
      };
      
      // 将数据转换为JSON格式
      const dataStr = JSON.stringify(exportData, null, 2);
      
      // 创建一个Blob对象
      const blob = new Blob([dataStr], { type: 'application/json' });
      
      // 创建一个下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `super-clipboard-export-${new Date().toISOString().slice(0, 10)}.json`;
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  };

  // 导入剪贴板数据功能
  const importClipboardData = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importData = JSON.parse(event.target.result);
        
        // 验证数据格式
        if (!importData.version || !importData.items || !Array.isArray(importData.items)) {
          throw new Error(chrome.i18n.getMessage("invalidImportFileFormat") || "Invalid file format");
        }
        
        // 确认是否要导入数据
        const confirmMsg = chrome.i18n.getMessage("importConfirmMessage") || 
                          `Import ${importData.items.length} clipboard items? This will replace your current clipboard data.`;
        if (confirm(confirmMsg)) {
          // 保存导入的数据
          chrome.storage.local.set({ clipboard: importData.items }, () => {
            // 显示导入成功的消息
            const successMsg = chrome.i18n.getMessage("importSuccessMessage") || 
                              `Successfully imported ${importData.items.length} clipboard items.`;
            alert(successMsg);
            
            // 重新加载界面
            loadClipboardItems();
          });
        }
      } catch (error) {
        console.error('Error importing data:', error);
        const errorMsg = chrome.i18n.getMessage("importFailedMessage") || 
                        "Failed to import clipboard data. Please check the file format.";
        alert(errorMsg);
      }
    };
    
    reader.onerror = () => {
      const errorMsg = chrome.i18n.getMessage("importFailedMessage") || 
                      "Failed to import clipboard data. Please check the file format.";
      alert(errorMsg);
    };
    
    reader.readAsText(file);
  };

  // 切换标签显示/隐藏
  toggleTagsBtn.addEventListener('click', () => {
    isTagsExpanded = !isTagsExpanded;
    if (isTagsExpanded) {
      tagsContainer.classList.remove('hidden');
      tagSearchWrapper.classList.remove('hidden'); // 确保搜索框在展开时可见
      toggleTagsBtn.textContent = '▲';
    } else {
      tagSearchWrapper.classList.add('hidden'); // 隐藏搜索框
      toggleTagsBtn.textContent = '▼';
    }
    updateTagVisibility(); // 更新标签可见性
  });

  // 统计标签使用次数
  const getTagCounts = (items) => {
    const tagCounts = {};
    items.forEach(item => {
      item.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return tagCounts;
  };

  // 获取使用次数最多的前N个标签
  const getTopTags = (tagCounts, limit = 5) => {
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(entry => entry[0]);
  };

  const renderTagFilters = (items) => {
    const tagCounts = getTagCounts(items);
    const topTags = getTopTags(tagCounts, 5);
    const allTags = Object.keys(tagCounts);
    const remainingTags = allTags.filter(tag => !topTags.includes(tag));
    const tagSearchTerm = tagSearchBox.value.toLowerCase();
    
    // 搜索应该针对所有标签，而不仅仅是隐藏的标签
    let filteredAllTags = tagSearchTerm 
      ? allTags.filter(tag => tag.toLowerCase().includes(tagSearchTerm))
      : allTags;
      
    // 对过滤后的标签按使用次数排序
    filteredAllTags = filteredAllTags.sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0));
      
    // 重新计算topTags和remainingTags基于过滤和排序后的结果
    const filteredTopTags = filteredAllTags.filter(tag => topTags.includes(tag));
    // 确保filteredTopTags也按照使用次数排序
    filteredTopTags.sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0));
    
    const filteredRemainingTags = filteredAllTags.filter(tag => remainingTags.includes(tag));
    // 确保filteredRemainingTags也按照使用次数排序
    filteredRemainingTags.sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0));

    // 渲染所有标签（使用最多的5个标记为data-top-tag属性）
    tagsContainer.innerHTML = '';
    
    // 添加"All"按钮，初始状态为选中
    const allButton = document.createElement('button');
    allButton.textContent = chrome.i18n.getMessage("allTagsButton") || "All";
    allButton.className = selectedTag === null ? 'tag-button active' : 'tag-button';
    allButton.addEventListener('click', () => {
        selectedTag = null;
        currentPage = 1;
        loadClipboardItems();
    });
    tagsContainer.appendChild(allButton);

    // 添加顶部标签
    filteredTopTags.forEach(tag => {
        const tagButton = document.createElement('button');
        tagButton.textContent = `${tag} (${tagCounts[tag]})`;
        // 仅在选中时添加active类
        tagButton.className = selectedTag === tag ? 'tag-button active' : 'tag-button';
        tagButton.dataset.topTag = 'true'; // 标记为顶部标签
        tagButton.addEventListener('click', () => {
            selectedTag = tag;
            currentPage = 1;
            loadClipboardItems();
        });
        tagsContainer.appendChild(tagButton);
    });

    // 添加剩余标签（在展开时显示）
    filteredRemainingTags.forEach(tag => {
        const tagButton = document.createElement('button');
        tagButton.textContent = `${tag} (${tagCounts[tag]})`;
        // 仅在选中时添加active类
        tagButton.className = selectedTag === tag ? 'tag-button active' : 'tag-button';
        tagButton.dataset.topTag = 'false'; // 标记为非顶部标签
        tagButton.addEventListener('click', () => {
            selectedTag = tag;
            currentPage = 1;
            loadClipboardItems();
        });
        tagsContainer.appendChild(tagButton);
    });
    
    // 根据展开状态决定是否显示非顶部标签
    updateTagVisibility();
  };

  // 根据展开状态更新标签可见性
  const updateTagVisibility = () => {
    const allTagButtons = tagsContainer.querySelectorAll('button[data-top-tag]');
    allTagButtons.forEach(button => {
      const isTopTag = button.dataset.topTag === 'true';
      // 如果是顶部标签，始终显示；如果不是顶部标签，仅在展开时显示
      if (!isTopTag && !isTagsExpanded) {
        button.style.display = 'none';
      } else {
        button.style.display = '';
      }
    });
  };

  const renderClipboardItems = (items) => {
    clipboardList.innerHTML = '';
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = items.slice(startIndex, endIndex);

    const groupedByDate = paginatedItems.reduce((groups, item) => {
      const date = new Date(item.timestamp).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
      return groups;
    }, {});

    for (const date in groupedByDate) {
      const dateHeader = document.createElement('h3');
      dateHeader.textContent = date;
      clipboardList.appendChild(dateHeader);

      groupedByDate[date].forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'clipboard-item';
        itemDiv.innerHTML = `
          <div class="item-header">
            <div class="item-time">${new Date(item.timestamp).toLocaleTimeString()}</div>
            <div class="item-actions">
              <button class="copy-btn" title="${chrome.i18n.getMessage("copyButtonTitle") || "Copy"}">📋</button>
              <button class="edit-btn" title="${chrome.i18n.getMessage("editButtonTitle") || "Edit"}">✏️</button>
              <button class="delete-btn" title="${chrome.i18n.getMessage("deleteButtonTitle") || "Delete"}">🗑️</button>
              <a href="${item.url}" target="_blank" title="${chrome.i18n.getMessage("linkButtonTitle") || "Go to link"}">🔗</a>
              <button class="add-tag-btn" title="${chrome.i18n.getMessage("addTagButtonTitle") || "Add Tag"}">🏷️</button>
            </div>
          </div>
          <div class="item-text" contenteditable="false">${item.text}</div>
          <div class="item-tags"></div>
          <div class="item-domain">${item.domain}</div>
        `;

        itemDiv.querySelector('.copy-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(item.text);
          
          // 添加复制成功的提示
          const copyBtn = itemDiv.querySelector('.copy-btn');
          const originalTitle = copyBtn.title;
          copyBtn.title = chrome.i18n.getMessage("copiedButtonTitle") || "Copied!";
          copyBtn.textContent = "✓";
          
          // 2秒后恢复原始状态
          setTimeout(() => {
            copyBtn.title = originalTitle;
            copyBtn.textContent = "📋";
          }, 2000);
        });

        const itemTextDiv = itemDiv.querySelector('.item-text');
        const editButton = itemDiv.querySelector('.edit-btn');

        editButton.addEventListener('click', () => {
          const isEditable = itemTextDiv.contentEditable === 'true';
          itemTextDiv.contentEditable = !isEditable;
          editButton.textContent = isEditable ? '✏️' : '💾'; // Toggle icon
          if (isEditable) {
            // Save changes
            chrome.storage.local.get({ clipboard: [] }, (result) => {
              const newClipboard = result.clipboard.map(clip => {
                if (clip.timestamp === item.timestamp) {
                  clip.text = itemTextDiv.textContent;
                }
                return clip;
              });
              chrome.storage.local.set({ clipboard: newClipboard }, () => {
                loadClipboardItems();
              });
            });
          }
        });

        itemDiv.querySelector('.delete-btn').addEventListener('click', () => {
          chrome.storage.local.get({ clipboard: [] }, (result) => {
            const newClipboard = result.clipboard.filter(
              (clip) => clip.timestamp !== item.timestamp
            );
            chrome.storage.local.set({ clipboard: newClipboard }, () => {
              loadClipboardItems();
            });
          });
        });

        const tagsContainer = itemDiv.querySelector('.item-tags');
        item.tags.forEach(tag => {
          const tagSpan = document.createElement('span');
          tagSpan.className = 'tag';
          tagSpan.textContent = tag;
          const deleteTagBtn = document.createElement('button');
          deleteTagBtn.textContent = 'x';
          deleteTagBtn.addEventListener('click', () => {
            chrome.storage.local.get({ clipboard: [] }, (result) => {
              const newClipboard = result.clipboard.map(clip => {
                if (clip.timestamp === item.timestamp) {
                  clip.tags = clip.tags.filter(t => t !== tag);
                }
                return clip;
              });
              chrome.storage.local.set({ clipboard: newClipboard }, () => {
                loadClipboardItems();
              });
            });
          });
          tagSpan.appendChild(deleteTagBtn);
          tagsContainer.appendChild(tagSpan);
        });

        itemDiv.querySelector('.add-tag-btn').addEventListener('click', () => {
          const newTag = prompt(chrome.i18n.getMessage("enterTagPrompt") || "Enter a new tag:");
          if (newTag) {
            chrome.storage.local.get({ clipboard: [] }, (result) => {
              const newClipboard = result.clipboard.map(clip => {
                if (clip.timestamp === item.timestamp) {
                  if (clip.tags.length < 3) { // Limit to 3 tags
                    clip.tags.push(newTag);
                  } else {
                    alert(chrome.i18n.getMessage("tagLimitAlert") || "You can only add up to 3 tags per item.");
                  }
                }
                return clip;
              });
              chrome.storage.local.set({ clipboard: newClipboard }, () => {
                loadClipboardItems();
              });
            });
          }
        });

        clipboardList.appendChild(itemDiv);
      });
    }

    // Pagination controls
    const totalPages = Math.ceil(items.length / itemsPerPage);
    if (totalPages > 1) {
      const paginationDiv = document.createElement('div');
      paginationDiv.className = 'pagination';
      for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = currentPage === i ? 'active' : '';
        pageButton.addEventListener('click', () => {
          currentPage = i;
          loadClipboardItems();
        });
        paginationDiv.appendChild(pageButton);
      }
      clipboardList.appendChild(paginationDiv);
    }
  };

  const loadClipboardItems = () => {
    chrome.storage.local.get({ clipboard: [] }, (result) => {
      const allItems = result.clipboard;
      const searchTerm = searchBox.value.toLowerCase();
      // 移除标签搜索对内容列表的过滤影响
      // const tagSearchTerm = tagSearchBox.value.toLowerCase();
      
      // 过滤和搜索逻辑
      let filteredItems = allItems.filter(item => {
        const matchesSearch = item.text.toLowerCase().includes(searchTerm);
        const matchesTag = !selectedTag || item.tags.includes(selectedTag);
        // 移除标签搜索对内容列表的过滤影响
        // const matchesTagSearch = !tagSearchTerm || item.tags.some(tag => tag.toLowerCase().includes(tagSearchTerm));
        // return matchesSearch && matchesTag && matchesTagSearch;
        return matchesSearch && matchesTag;
      });
      
      // 更新标签过滤器和渲染结果
      renderTagFilters(allItems);
      renderClipboardItems(filteredItems);
      
      // 更新清除按钮的显示状态
      updateClearButtonVisibility();
    });
  };

  // 更新清除按钮的显示状态
  const updateClearButtonVisibility = () => {
    const searchClearBtn = document.getElementById('search-clear-btn');
    const tagSearchClearBtn = document.getElementById('tag-search-clear-btn');
    
    if (searchClearBtn) {
      searchClearBtn.style.display = searchBox.value ? 'flex' : 'none';
    }
    
    if (tagSearchClearBtn) {
      tagSearchClearBtn.style.display = tagSearchBox.value ? 'flex' : 'none';
    }
  };

  // 添加搜索框清除按钮事件监听
  document.getElementById('search-clear-btn')?.addEventListener('click', () => {
    searchBox.value = '';
    loadClipboardItems();
    updateClearButtonVisibility();
  });
  
  document.getElementById('tag-search-clear-btn')?.addEventListener('click', () => {
    tagSearchBox.value = '';
    loadClipboardItems();
    updateClearButtonVisibility();
  });

  // 输入时触发搜索
  searchBox.addEventListener('input', () => {
    loadClipboardItems();
    updateClearButtonVisibility();
  });
  
  // 移除标签搜索的事件监听，避免联动内容列表
  // tagSearchBox.addEventListener('input', loadClipboardItems);
  // 添加标签搜索的独立处理
  tagSearchBox.addEventListener('input', () => {
    // 只更新标签显示，不影响内容列表
    chrome.storage.local.get({ clipboard: [] }, (result) => {
      renderTagFilters(result.clipboard);
    });
    updateClearButtonVisibility();
  });
  
  // 初始加载
  loadClipboardItems();
  
  // 监听来自内容脚本的数据更新
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'clipboardUpdated') {
      loadClipboardItems();
    }
  });
});