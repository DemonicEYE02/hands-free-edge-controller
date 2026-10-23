'use strict';
let targetTabId = null;
let targetWindowId = null;
const storageReady = chrome.storage.local.get(['hfpTargetTabId','hfpTargetWindowId']).then(saved => {
  if (Number.isInteger(saved.hfpTargetTabId)) targetTabId = saved.hfpTargetTabId;
  if (Number.isInteger(saved.hfpTargetWindowId)) targetWindowId = saved.hfpTargetWindowId;
}).catch(() => {});

function isWebTab(tab) {
  const url = tab?.url || tab?.pendingUrl || '';
  return /^https?:\/\//i.test(url);
}
function hostOf(tab) {
  try { return new URL(tab.url || tab.pendingUrl || '').hostname || 'local page'; }
  catch { return 'current webpage'; }
}
async function rememberTarget(tabId, windowId) {
  if (!Number.isInteger(tabId)) return false;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isWebTab(tab)) return false;
    targetTabId = tabId;
    targetWindowId = Number.isInteger(windowId) ? windowId : tab.windowId;
    await chrome.storage.local.set({hfpTargetTabId:targetTabId,hfpTargetWindowId:targetWindowId});
    return true;
  } catch { return false; }
}
async function currentTarget() {
  await storageReady;
  if (Number.isInteger(targetTabId)) {
    try {
      const tab = await chrome.tabs.get(targetTabId);
      if (isWebTab(tab)) return tab;
    } catch {}
  }
  const opts = Number.isInteger(targetWindowId) ? {active:true,windowId:targetWindowId} : {active:true,lastFocusedWindow:true};
  const tabs = await chrome.tabs.query(opts);
  const tab = tabs.find(isWebTab);
  if (tab) {
    await rememberTarget(tab.id, tab.windowId);
    return tab;
  }
  return null;
}

// Existing tabs may predate extension installation/reload. Inject only after a messaging
// failure, then retry exactly once; content.js has an idempotency guard to prevent duplicates.
async function sendToPage(tab, message) {
  let firstError = null;
  try {
    const result = await chrome.tabs.sendMessage(tab.id, message);
    // A stale content script can silently ignore HFP41 and resolve with undefined. Treat that
    // as a missing receiver, inject the current version, and retry rather than claiming success.
    const currentReply = message.command === 'PING' ? result?.version === 41 : !!result && typeof result === 'object';
    if (currentReply) return {ok:result?.ok !== false, result};
    firstError = new Error('The current tab is running an older page controller or did not acknowledge the command.');
  } catch (error) {
    firstError = error;
  }
  if (!/^https?:\/\//i.test(tab.url || tab.pendingUrl || '') && !/^file:\/\//i.test(tab.url || tab.pendingUrl || '')) {
    return {ok:false,error:'This browser page is protected and cannot be controlled by extensions.'};
  }
  try {
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
    const result = await chrome.tabs.sendMessage(tab.id, message);
    if (message.command === 'PING' && result?.version !== 41) {
      return {ok:false,error:'The page script could not be updated. Reload this webpage once, then reopen the control panel.'};
    }
    return {ok:result?.ok !== false, result:result || {ok:true}, injected:true};
  } catch (secondError) {
    const detail = secondError?.message || firstError?.message || 'No response from the webpage.';
    if (/cannot access|permission|not allowed|extensions gallery|chrome:\/\//i.test(detail)) {
      return {ok:false,error:'Edge blocked access to this page. Use a normal HTTP/HTTPS webpage and allow the extension to access that site.'};
    }
    return {ok:false,error:'Could not connect to the webpage script. Reload the page, verify Edge site access for this extension, and retry. (' + detail + ')'};
  }
}
async function handleMessage(message) {
  await storageReady;
  if (message.command === 'REGISTER_TARGET') {
    const ok = await rememberTarget(message.tabId, message.windowId);
    if (!ok) return {ok:false,error:'Could not register the webpage. Open a normal HTTP/HTTPS webpage first.'};
    const tab = await chrome.tabs.get(message.tabId);
    return {ok:true,tabId:tab.id,windowId:tab.windowId,url:tab.url || '',host:hostOf(tab)};
  }
  if (message.command === 'GET_TARGET') {
    const tab = await currentTarget();
    return tab ? {ok:true,tabId:tab.id,windowId:tab.windowId,url:tab.url || tab.pendingUrl || '',host:hostOf(tab)} : {ok:false,error:'No controllable webpage selected.'};
  }
  if (message.command === 'OPEN_COMPACT') {
    const activeTarget = await currentTarget();
    const winId = Number.isInteger(message.targetWindowId) ? message.targetWindowId : activeTarget?.windowId;
    if (!activeTarget || !Number.isInteger(winId)) return {ok:false,error:'Open a normal webpage before moving the controller to compact mode.'};
    if (!chrome.windows?.create || !chrome.sidePanel?.close) return {ok:false,error:'This Edge version does not support automatic side-panel hiding. Update Edge, or use the panel close button.'};
    const mini = await chrome.windows.create({url:chrome.runtime.getURL('controller.html?compact=1&targetWindowId='+winId),type:'popup',width:390,height:560,focused:true});
    try {
      await chrome.sidePanel.close({windowId:winId});
      return {ok:true,compactWindowId:mini?.id,detail:'Moved to compact controller window'};
    } catch (error) {
      // Avoid stranding the user in two controllers if closing the side panel is unsupported.
      if (Number.isInteger(mini?.id)) await chrome.windows.remove(mini.id).catch(()=>{});
      return {ok:false,error:'Could not close the Edge side panel: '+(error?.message || String(error))};
    }
  }
  if (message.command === 'CHECK_TARGET') {
    const tab = await currentTarget();
    if (!tab) return {ok:false,error:'No target webpage. Open a normal HTTP/HTTPS tab and open this extension from that tab.'};
    const ping = await sendToPage(tab,{type:'HFP41',command:'PING'});
    if (!ping.ok) return {ok:false,tabId:tab.id,url:tab.url || '',host:hostOf(tab),error:ping.error};
    return {ok:true,tabId:tab.id,windowId:tab.windowId,url:tab.url || '',host:hostOf(tab),injected:!!ping.injected,pageResult:ping.result};
  }
  if (message.command === 'TAB') {
    const active = await currentTarget();
    const windowId = Number.isInteger(targetWindowId) ? targetWindowId : active?.windowId;
    if (!Number.isInteger(windowId)) return {ok:false,error:'No target browser window.'};
    const allTabs = await chrome.tabs.query({windowId});
    const pages = allTabs.filter(isWebTab);
    if (pages.length < 2) return {ok:false,error:'Open at least two normal webpages to switch tabs.'};
    let index = pages.findIndex(tab => tab.id === active?.id);
    if (index < 0) index = 0;
    const direction = message.direction === 'next' ? 1 : -1;
    const next = pages[(index + direction + pages.length) % pages.length];
    await chrome.tabs.update(next.id,{active:true});
    await rememberTarget(next.id,windowId);
    return {ok:true,tabId:next.id,url:next.url || '',host:hostOf(next),pageResult:{ok:true,detail:'switched tab'}};
  }
  const target = await currentTarget();
  if (!target) return {ok:false,error:'No target webpage. Open a normal webpage and click the extension icon to register it.'};
  const routed = await sendToPage(target,{...message,type:'HFP41'});
  if (!routed.ok || routed.result?.ok === false) {
    return {ok:false,tabId:target.id,url:target.url || '',host:hostOf(target),error:routed.error || routed.result?.error || 'The webpage rejected this gesture action.'};
  }
  return {ok:true,tabId:target.id,url:target.url || '',host:hostOf(target),pageResult:routed.result,injected:!!routed.injected};
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'HFP' && message?.type !== 'HFP4' && message?.type !== 'HFP41') return;
  handleMessage(message).then(sendResponse).catch(error => sendResponse({ok:false,error:error?.message || String(error)}));
  return true;
});
chrome.tabs.onActivated.addListener(async activeInfo => {
  await storageReady;
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (isWebTab(tab)) await rememberTarget(tab.id, activeInfo.windowId);
  } catch {}
});
chrome.tabs.onRemoved.addListener(async removedTabId => {
  await storageReady;
  if (removedTabId !== targetTabId) return;
  targetTabId = null;
  const tabs = await chrome.tabs.query(Number.isInteger(targetWindowId) ? {active:true,windowId:targetWindowId} : {active:true,lastFocusedWindow:true});
  const tab = tabs.find(isWebTab);
  if (tab) await rememberTarget(tab.id,tab.windowId);
  else await chrome.storage.local.remove(['hfpTargetTabId','hfpTargetWindowId']);
});
