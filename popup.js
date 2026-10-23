const $ = id => document.getElementById(id);
$('open').addEventListener('click', async () => {
  const button = $('open');
  button.disabled = true;
  button.textContent = 'Opening…';
  try {
    const [tab] = await chrome.tabs.query({active:true, lastFocusedWindow:true});
    if (!tab || !/^https?:\/\//i.test(tab.url || '')) {
      $('note').textContent = 'Open a normal http/https webpage first. Browser settings, Edge add-ons and some PDF pages are protected.';
      return;
    }
    // Start the user-gesture-gated side-panel open immediately, in parallel with target registration.
    const register = chrome.runtime.sendMessage({type:'HFP', command:'REGISTER_TARGET', tabId:tab.id, windowId:tab.windowId});
    if (chrome.sidePanel?.open) {
      const opening = chrome.sidePanel.open({windowId:tab.windowId});
      await Promise.all([register, opening]);
      window.close();
    } else {
      await register;
      chrome.tabs.create({url:chrome.runtime.getURL('controller.html')});
      $('note').textContent = 'This Edge build lacks side-panel support; target was registered, but background-tab tracking may be throttled.';
    }
  } catch (e) {
    $('note').textContent = 'Could not open panel: ' + (e?.message || String(e));
  } finally {
    button.disabled = false;
    button.textContent = 'Open control panel';
  }
});
