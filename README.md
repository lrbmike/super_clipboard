# Super Clipboard

[English](README.md) | [中文简体](README_CN.md)

A powerful clipboard extension for Chrome that helps you better manage and organize copied content.

## Features

- **Content Collection**: Copy selected text to the extension's clipboard via the context menu
- **History Tracking**: Save all copied content, including text, timestamps, and source URLs
- **Tag Management**: Add tags to clipboard items for easy categorization and searching
- **Search Functionality**: Search through clipboard content and tags
- **Content Editing**: Edit clipboard content directly within the extension
- **Responsive Design**: Adapts to different screen sizes and window dimensions

## Installation and Usage

1. Download or clone this project to your local machine
2. Open Chrome browser and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select this project folder
5. Once installed, you can use the extension in two ways:
   - Click the extension icon in the browser toolbar to open the clipboard panel
   - Select text on a webpage, right-click, and choose "复制到我的剪切板" (Copy to My Clipboard) to add content to the clipboard

## Interface Overview

### Main Panel
- Top displays the extension title "Super Clipboard"
- Search box: Search through clipboard content
- Tag area: Shows frequently used tags, click to filter
- Content list: Displays clipboard items grouped by date

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

## Technical Implementation

- Built with Chrome Extension Manifest V3
- Uses HTML/CSS/JavaScript stack
- Leverages Chrome Storage API for data persistence
- Utilizes Chrome Side Panel API for the sidebar interface
- Supports automatic switching between dark and light modes

## Development and Contribution

Feel free to submit Issues and Pull Requests to improve this project.

## License

This project is licensed under the [MIT License](LICENSE).