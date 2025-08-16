document.addEventListener('DOMContentLoaded', () => {
  const searchBox = document.getElementById('search-box');
  const clipboardList = document.getElementById('clipboard-list');
  const tagFilterContainer = document.getElementById('tag-filter-container');
  let selectedTag = null;

  const renderTagFilters = (items) => {
    const allTags = [...new Set(items.flatMap(item => item.tags))];
    tagFilterContainer.innerHTML = '';

    const allButton = document.createElement('button');
    allButton.textContent = 'All';
    allButton.className = selectedTag === null ? 'active' : '';
    allButton.addEventListener('click', () => {
      selectedTag = null;
      loadClipboardItems();
    });
    tagFilterContainer.appendChild(allButton);

    allTags.forEach(tag => {
      const tagButton = document.createElement('button');
      tagButton.textContent = tag;
      tagButton.className = selectedTag === tag ? 'active' : '';
      tagButton.addEventListener('click', () => {
        selectedTag = tag;
        loadClipboardItems();
      });
      tagFilterContainer.appendChild(tagButton);
    });
  };

  const renderClipboardItems = (items) => {
    clipboardList.innerHTML = '';
    const groupedByDate = items.reduce((groups, item) => {
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
                  clip.tags.push(newTag);
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