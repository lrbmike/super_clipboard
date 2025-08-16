document.addEventListener('DOMContentLoaded', () => {
  const searchBox = document.getElementById('search-box');
  const clipboardList = document.getElementById('clipboard-list');
  const tagFilterContainer = document.getElementById('tag-filter-container');
  let selectedTag = null;
  let currentPage = 1;
  const itemsPerPage = 20;

  const renderTagFilters = (items) => {
    const allTags = [...new Set(items.flatMap(item => item.tags))];
    tagFilterContainer.innerHTML = '';

    const allButton = document.createElement('button');
    allButton.textContent = 'All';
    allButton.className = selectedTag === null ? 'active' : '';
    allButton.addEventListener('click', () => {
      selectedTag = null;
      currentPage = 1;
      loadClipboardItems();
    });
    tagFilterContainer.appendChild(allButton);

    allTags.forEach(tag => {
      const tagButton = document.createElement('button');
      tagButton.textContent = tag;
      tagButton.className = selectedTag === tag ? 'active' : '';
      tagButton.addEventListener('click', () => {
        selectedTag = tag;
        currentPage = 1;
        loadClipboardItems();
      });
      tagFilterContainer.appendChild(tagButton);
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
      renderTagFilters(result.clipboard);
      const searchTerm = searchBox.value.toLowerCase();
      let filteredItems = result.clipboard.filter(item =>
        item.text.toLowerCase().includes(searchTerm)
      );
      if (selectedTag) {
        filteredItems = filteredItems.filter(item => item.tags.includes(selectedTag));
      }
      renderClipboardItems(filteredItems);
    });
  };

  searchBox.addEventListener('input', loadClipboardItems);
  loadClipboardItems();

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'clipboardUpdated') {
      loadClipboardItems();
    }
  });
});