# Super Clipboard

[English](README.md) | [中文简体](README_CN.md)

A powerful clipboard extension for Chrome that helps you better manage and organize copied content.

## Features

- **Content Collection**: Copy selected text to the extension's clipboard via the context menu
- **History Tracking**: Save all copied content, including text, timestamps, and source URLs
- **Tag Management**: Add tags to clipboard items for easy categorization and searching
- **Search Functionality**: Search through clipboard content and tags
- **Content Editing**: Edit clipboard content directly within the extension
- **Data Import/Export**: Import and export clipboard data for backup and transfer
- **Responsive Design**: Adapts to different screen sizes and window dimensions
- **Form Management**: Extract forms from web pages, save them, and auto-fill forms with saved data

## Installation and Usage

1. Download or clone this project to your local machine
2. Open Chrome browser and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select this project folder
5. Once installed, you can use the extension in two ways:
   - Click the extension icon in the browser toolbar to open the clipboard panel
   - Select text on a webpage, right-click, and choose "Copy to Super Clipboard" to add content to the clipboard

### Using Clipboard Features

- Use the search box to find specific clipboard items by content
- Filter items by tags using the tag filter section
- Copy items to your system clipboard with the copy button
- Edit item content by clicking the edit button
- Delete items you no longer need
- Navigate to the source webpage of an item with the link button
- Add tags to items for better organization

### Using Form Features

1. Open the Form Panel by clicking the clipboard icon in the main panel header
2. Use the "Extract Form" tab to extract forms from the current webpage
3. Save extracted forms for later use
4. Use the "Saved Forms" tab to manage your saved forms
5. Return to the main clipboard panel at any time with the back button

### Import/Export Functionality

The extension provides data import and export capabilities:
- **Export**: Click the 📤 button in the header to export all clipboard data as a JSON file
- **Import**: Click the 📥 button in the header to import previously exported clipboard data
- Exported files contain all clipboard items with timestamps, source URLs, and tags
- Imported data will replace your current clipboard data after confirmation

## Privacy and Data Storage

All clipboard content collected by this extension is stored locally within your browser's storage. No data is transmitted to any external servers or third parties. The extension respects your privacy by:

- Storing all data locally in your browser's storage area
- Not collecting or transmitting any personal information
- Not tracking your browsing activities
- Not sharing data with any external services

Your clipboard history remains private and secure, accessible only to you on your local machine.

## Interface Overview

<img width="918" height="1284" alt="super_clipboard_01" src="https://github.com/user-attachments/assets/180cfd44-d390-4ca5-bf96-e00730162544" />

### Main Panel
- Search box: Search through clipboard content
- Tag area: Shows frequently used tags, click to filter
- Content list: Displays clipboard items grouped by date
- Import/Export buttons: Buttons in the header to import or export clipboard data
- Form Panel button: Access form management features

### Tag Features
- By default, displays the top 5 most frequently used tags
- Click the collapse button to expand and show all tags
- When expanded, you can search for tags in the search box
- Click tags to filter corresponding content

### Content Actions
Each clipboard item provides the following action buttons:
- 📋 Copy: Copy content to the system clipboard
- ✏️ Edit: Edit the content text
- 🗑️ Delete: Remove this item
- 🔗 Link: Navigate to the source webpage
- 🏷️ Tag: Add tags to the content

## Development and Contribution

Feel free to submit Issues and Pull Requests to improve this project.

## License

This project is licensed under the [MIT License](LICENSE).