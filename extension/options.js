const apiInput = document.getElementById('apiUrl');
const statusEl = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');

const defaultUrl = 'http://127.0.0.1:8000';

const loadSettings = () => {
  if (!chrome?.storage?.sync) {
    statusEl.textContent = 'Storage unavailable in this context.';
    apiInput.value = defaultUrl;
    return;
  }
  chrome.storage.sync.get({ apiBaseUrl: defaultUrl }, (result) => {
    apiInput.value = result.apiBaseUrl || defaultUrl;
  });
};

const saveSettings = () => {
  if (!chrome?.storage?.sync) {
    statusEl.textContent = 'Storage unavailable in this context.';
    return;
  }
  const value = apiInput.value.trim() || defaultUrl;
  chrome.storage.sync.set({ apiBaseUrl: value }, () => {
    statusEl.textContent = 'Saved.';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 1500);
  });
};

saveBtn.addEventListener('click', saveSettings);
loadSettings();
