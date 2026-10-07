const params = new URLSearchParams(location.search);
const reason = params.get('reason') === 'file' ? 'file' : 'restricted';
document.getElementById(reason).hidden = false;

const detail = params.get('detail');
if (detail) document.getElementById('detail').textContent = 'Technische Meldung: ' + detail;

for (const btn of document.querySelectorAll('.open-details')) {
  btn.addEventListener('click', () => chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` }));
}
