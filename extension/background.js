// HTML Feedback – Service Worker
// Injiziert das Overlay, macht Screenshots und speichert den Export als Datei.

const CURSOR_CSS = 'html.hf-region-mode, html.hf-region-mode * { cursor: crosshair !important; }';

chrome.action.onClicked.addListener(async (tab) => {
  const url = tab.url || '';
  if (url.startsWith('file:') && !(await chrome.extension.isAllowedFileSchemeAccess())) {
    return openHelp('file');
  }
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, css: CURSOR_CSS });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (err) {
    openHelp('restricted', err.message);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'hf-capture') {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' })
      .then((dataUrl) => sendResponse({ dataUrl }), (err) => sendResponse({ error: err.message }));
    return true;
  }
  if (msg?.type === 'hf-download') {
    download(msg).then(sendResponse, (err) => sendResponse({ error: err.message }));
    return true;
  }
});

function openHelp(reason, detail = '') {
  chrome.tabs.create({
    url: chrome.runtime.getURL(`help.html?reason=${reason}&detail=${encodeURIComponent(detail)}`),
  });
}

// Große JSON-Pakete nicht als data:-URL herunterladen (Längenlimit),
// sondern als Blob-URL aus einem Offscreen-Dokument.
async function download({ json, filename, saveAs }) {
  await ensureOffscreen();
  const { url } = await chrome.runtime.sendMessage({
    target: 'offscreen', type: 'blob-url', text: json, mime: 'application/json',
  });
  try {
    let id;
    try {
      id = await chrome.downloads.download({ url, filename, saveAs: !!saveAs, conflictAction: 'uniquify' });
    } catch (err) {
      if (/cancel/i.test(err.message)) return { cancelled: true };
      throw err;
    }
    if (await waitForDownload(id) === 'cancelled') return { cancelled: true };
    const [item] = await chrome.downloads.search({ id });
    return { path: item.filename };
  } finally {
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'revoke', url }).catch(() => {});
  }
}

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existing.length) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'Blob-URL für den Feedback-Export erzeugen',
  });
}

function waitForDownload(id) {
  return new Promise((resolve, reject) => {
    const done = (result, err) => {
      chrome.downloads.onChanged.removeListener(listener);
      err ? reject(err) : resolve(result);
    };
    const check = (state, error) => {
      if (state === 'complete') done('complete');
      else if (state === 'interrupted') {
        if (error === 'USER_CANCELED') done('cancelled');
        else done(null, new Error(`Download abgebrochen (${error || 'unbekannt'})`));
      }
    };
    const listener = (delta) => {
      if (delta.id === id && delta.state) check(delta.state.current, delta.error?.current);
    };
    chrome.downloads.onChanged.addListener(listener);
    chrome.downloads.search({ id }).then(([item]) => item && check(item.state, item.error));
  });
}
