# NotebookLM Research Summarizer

A Chrome extension + local Node.js broker that lets you:

- Search for most relevant academic papers using **Semantic Scholar** and **arXiv**
- Automatically download the top PDFs and inputs top PDFs to NoteBookLM and fully automates hallucination-free summarization
- View the summaries directly inside the extension popup
---

## Features

- k-NN ranking across Semantic Scholar & arXiv APIs
- Automatic PDF downloading and formatting
- NotebookLM integration using Playwright
- Lightweight Chrome extension (no backend dependencies)

---

## Installation

### Clone this repo

```bash
git clone https://github.com/Rohan-dev-C/LiteratureSummarizationEngine.git
cd notebooklm-summarizer
```

### Set up the local automation server (Node.js + Playwright)
```bash
cd notebooklm-summarizer
npm install
npm start
```
This will launch a local server at http://localhost:3000. It opens your real Chrome profile to ensure you're already signed into Google. You’ll be prompted to sign in to NotebookLM the **first time only**.

### Load the Chrome Extension

1. Open Chrome to `chrome://extensions`
2. Enable Developer Mode and click `Load unpacked`
4. Select the LiteratureSummarizationEngine directory
5. Pin the extension from your toolbar

# Using the Extension
1. Click the extension icon and type a topic like `"Graph Neural Networks"` and hit Search
2. Click "Summarize in NotebookLM" and all of the PDFs will be downloaded and uploaded to NotebookLM, and the summaries will appear directly in the popup UI.

## Troubleshooting
### Extension does nothing when clicking "Summarize"
- Make sure npm start is running (check logs for ⇢ http://localhost:3000)
- Open DevTools in the extension popup and check the console logs to make sure all code is ran properly

### Google login fails
- Chrome must not be in guest/incognito mode since it uses your current Chrome profile
- Only requires one sign in

## Built With
Playwright
Semantic Scholar API
arXiv API
NotebookLM

