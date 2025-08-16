document.addEventListener('DOMContentLoaded', () => {
  const searchBox = document.getElementById('search-box');
  const tagSearchBox = document.getElementById('tag-search-box');
  const tagSearchWrapper = document.getElementById('tag-search-wrapper');
  const clipboardList = document.getElementById('clipboard-list');
  const toggleTagsBtn = document.getElementById('toggle-tags-btn');
  const topTagsContainer = document.getElementById('top-tags-container');
  const allTagsContainer = document.getElementById('all-tags-container');
  let selectedTag = null;
  let currentPage = 1;
  const itemsPerPage = 5;
  let isTagsExpanded = false;

  // 切换标签显示/隐藏
  toggleTagsBtn.addEventListener('click', () => {
    isTagsExpanded = !isTagsExpanded;
    if (isTagsExpanded) {
      allTagsContainer.classList.remove('hidden');
      tagSearchWrapper.classList.remove('hidden'); // 确保搜索框在展开时可见
      toggleTagsBtn.textContent = '▲';
    } else {
      allTagsContainer.classList.add('hidden');
      tagSearchWrapper.classList.add('hidden'); // 隐藏搜索框
      toggleTagsBtn.textContent = '▼';
    }
    loadClipboardItems();
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
    const filteredRemainingTags = tagSearchTerm 
      ? remainingTags.filter(tag => tag.toLowerCase().includes(tagSearchTerm))
      : remainingTags;

    // 渲染顶部标签（使用最多的5个）
    topTagsContainer.innerHTML = '';
    const allButton = document.createElement('button');
    allButton.textContent = 'All';
    allButton.className = selectedTag === null ? 'tag-button active' : 'tag-button';
    allButton.addEventListener('click', () => {
      selectedTag = null;
      currentPage = 1;
      loadClipboardItems();
    });
    topTagsContainer.appendChild(allButton);

    topTags.forEach(tag => {
      const tagButton = document.createElement('button');
      tagButton.textContent = `${tag} (${tagCounts[tag]})`;
      tagButton.className = selectedTag === tag ? 'tag-button active' : 'tag-button';
      tagButton.addEventListener('click', () => {
        selectedTag = tag;
        currentPage = 1;
        loadClipboardItems();
      });
      topTagsContainer.appendChild(tagButton);
    });

    // 渲染剩余标签（在展开时显示）
    allTagsContainer.innerHTML = '';
    filteredRemainingTags.forEach(tag => {
      const tagButton = document.createElement('button');
      tagButton.textContent = `${tag} (${tagCounts[tag]})`;
      tagButton.className = selectedTag === tag ? 'tag-button active' : 'tag-button';
      tagButton.addEventListener('click', () => {
        selectedTag = tag;
        currentPage = 1;
        loadClipboardItems();
      });
      allTagsContainer.appendChild(tagButton);
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
      const tagSearchTerm = tagSearchBox.value.toLowerCase();
      
      // 过滤和搜索逻辑
      let filteredItems = allItems.filter(item => {
        const matchesSearch = item.text.toLowerCase().includes(searchTerm);
        const matchesTag = !selectedTag || item.tags.includes(selectedTag);
        const matchesTagSearch = !tagSearchTerm || item.tags.some(tag => tag.toLowerCase().includes(tagSearchTerm));
        return matchesSearch && matchesTag && matchesTagSearch;
      });
      
      // 更新标签过滤器和渲染结果
      renderTagFilters(allItems);
      renderClipboardItems(filteredItems);
    });
  };

  // 添加搜索框清除按钮事件监听
  document.getElementById('search-clear-btn')?.addEventListener('click', () => {
    searchBox.value = '';
    loadClipboardItems();
  });
  
  document.getElementById('tag-search-clear-btn')?.addEventListener('click', () => {
    tagSearchBox.value = '';
    loadClipboardItems();
  });

  // 输入时触发搜索
  searchBox.addEventListener('input', loadClipboardItems);
  tagSearchBox.addEventListener('input', loadClipboardItems);
  
  // 初始加载
  loadClipboardItems();
  
  // 监听来自内容脚本的数据更新
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'clipboardUpdated') {
      loadClipboardItems();
    }
  });
});