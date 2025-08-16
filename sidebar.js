document.addEventListener('DOMContentLoaded', () => {
  const searchBox = document.getElementById('search-box');
  const tagSearchBox = document.getElementById('tag-search-box');
  const tagSearchWrapper = document.getElementById('tag-search-wrapper');
  const clipboardList = document.getElementById('clipboard-list');
  const toggleTagsBtn = document.getElementById('toggle-tags-btn');
  const tagsContainer = document.getElementById('tags-container'); // 更新为新的标签容器
  let selectedTag = null;
  let currentPage = 1;
  const itemsPerPage = 10;
  let isTagsExpanded = false;

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
    const filteredAllTags = tagSearchTerm 
      ? allTags.filter(tag => tag.toLowerCase().includes(tagSearchTerm))
      : allTags;
      
    // 重新计算topTags和remainingTags基于过滤后的结果
    const filteredTopTags = filteredAllTags.filter(tag => topTags.includes(tag));
    const filteredRemainingTags = filteredAllTags.filter(tag => remainingTags.includes(tag));

    // 渲染所有标签（使用最多的5个标记为data-top-tag属性）
    tagsContainer.innerHTML = '';
    
    // 添加"All"按钮，初始状态为选中
    const allButton = document.createElement('button');
    allButton.textContent = 'All';
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
              <button class="copy-btn" title="Copy">📋</button>
              <button class="edit-btn" title="Edit">✏️</button>
              <button class="delete-btn" title="Delete">🗑️</button>
              <a href="${item.url}" target="_blank" title="Go to link">🔗</a>
              <button class="add-tag-btn" title="Add Tag">🏷️</button>
            </div>
          </div>
          <div class="item-text" contenteditable="false">${item.text}</div>
          <div class="item-tags"></div>
          <div class="item-domain">${item.domain}</div>
        `;

        itemDiv.querySelector('.copy-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(item.text);
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
          const newTag = prompt('Enter a new tag:');
          if (newTag) {
            chrome.storage.local.get({ clipboard: [] }, (result) => {
              const newClipboard = result.clipboard.map(clip => {
                if (clip.timestamp === item.timestamp) {
                  if (clip.tags.length < 3) { // Limit to 3 tags
                    clip.tags.push(newTag);
                  } else {
                    alert('You can only add up to 3 tags per item.');
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