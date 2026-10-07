// Erzeugt Blob-URLs für Downloads (im Service Worker gibt es kein URL.createObjectURL).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return;
  if (msg.type === 'blob-url') {
    sendResponse({ url: URL.createObjectURL(new Blob([msg.text], { type: msg.mime })) });
  } else if (msg.type === 'revoke') {
    // Kurz warten, damit der Download die URL sicher gelesen hat.
    setTimeout(() => URL.revokeObjectURL(msg.url), 60_000);
  }
});
