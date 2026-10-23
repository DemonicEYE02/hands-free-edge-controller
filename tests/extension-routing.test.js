const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const pages = {
  1: {id:1,windowId:10,url:'https://example.test/',active:true},
  2: {id:2,windowId:10,url:'https://second.test/',active:false}
};
let injected = false;
let lastRoutedMessage = null;
let playError = false;
let runtimeListener;
const onActivated = {addListener() {}};
const onRemoved = {addListener() {}};
const chrome = {
  storage: {local: {
    get: async () => ({hfpTargetTabId:1,hfpTargetWindowId:10}),
    set: async () => {},
    remove: async () => {}
  }},
  tabs: {
    get: async id => { if (!pages[id]) throw new Error('No tab'); return {...pages[id]}; },
    query: async query => {
      let items = Object.values(pages).filter(p => query.windowId == null || p.windowId === query.windowId);
      if (query.active) items = items.filter(p => p.active);
      return items.map(p => ({...p}));
    },
    sendMessage: async (id, message) => {
      if (!injected) throw new Error('Receiving end does not exist');
      lastRoutedMessage = message;
      if (message.command === 'PING') return {ok:true,version:4,detail:'page script connected'};
      if (message.command === 'PLAY' && playError) return {ok:false,error:'Autoplay blocked'};
      return {ok:true,detail:`${message.command.toLowerCase()} test ack`};
    },
    update: async (id, changes) => {
      if (changes.active) for (const page of Object.values(pages)) page.active = page.id === id;
      return {...pages[id]};
    },
    onActivated,
    onRemoved
  },
  scripting: {executeScript: async () => { injected = true; return [{}]; }},
  runtime: {onMessage: {addListener(fn) { runtimeListener = fn; }}}
};
vm.runInNewContext(fs.readFileSync('background.js','utf8'), {chrome, URL, Promise, Number, Error, RegExp, Object, String, Math});

function request(message) {
  return new Promise((resolve, reject) => {
    let returned;
    try { returned = runtimeListener(message, {}, resolve); }
    catch (e) { reject(e); }
    if (returned !== true) reject(new Error('listener did not keep the response channel open'));
  });
}
(async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
  const check = await request({type:'HFP4',command:'CHECK_TARGET'});
  assert.equal(check.ok, true, 'CHECK_TARGET should succeed');
  assert.equal(check.injected, true, 'missing page script should be injected automatically');
  assert.equal(check.host, 'example.test');

  const move = await request({type:'HFP4',command:'MOVE',x:.3,y:.7,showPointer:true});
  assert.equal(move.ok, true, 'MOVE should reach page');
  assert.equal(lastRoutedMessage.type, 'HFP4', 'messages to page must use versioned channel');
  assert.equal(lastRoutedMessage.command, 'MOVE');

  playError = true;
  const play = await request({type:'HFP4',command:'PLAY'});
  assert.equal(play.ok, false, 'page-level playback rejection must be reported');
  assert.match(play.error, /Autoplay blocked/);

  const switchTab = await request({type:'HFP4',command:'TAB',direction:'next'});
  assert.equal(switchTab.ok, true, 'TAB gesture should switch tabs');
  assert.equal(switchTab.tabId, 2);
  console.log('extension-routing: all 10 assertions passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
