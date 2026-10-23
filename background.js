chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'prevTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0] && tabs[0].index > 0) {
        chrome.tabs.query({ currentWindow: true }, all => {
          const sorted = all.sort((a, b) => a.index - b.index);
          const currentIndex = sorted.findIndex(t => t.id === tabs[0].id);
          const prev = sorted[(currentIndex - 1 + sorted.length) % sorted.length];
          if (prev) chrome.tabs.update(prev.id, { active: true });
        });
      }
    });
  }
  if (msg.action === 'nextTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.query({ currentWindow: true }, all => {
        const sorted = all.sort((a, b) => a.index - b.index);
        const currentIndex = sorted.findIndex(t => t.id === tabs[0].id);
        const next = sorted[(currentIndex + 1) % sorted.length];
        if (next) chrome.tabs.update(next.id, { active: true });
      });
    });
  }
  return true;
});
