const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class FakeEvent { constructor(type, opts={}) { this.type=type; Object.assign(this,opts); } }
class FakeNode {
  constructor(tagName='DIV', registry=null) {
    this.tagName=tagName.toUpperCase(); this.registry=registry; this.id=''; this.style={overflowY:'visible'};
    this.children=[]; this.parentElement=null; this.isConnected=false; this.textContent=''; this.dataset={};
    this.scrollHeight=100; this.clientHeight=100; this.value=''; this.type=''; this.attributes={};
  }
  appendChild(child) { child.parentElement=this; child.isConnected=true; this.children.push(child); if(child.id && this.registry) this.registry[child.id]=child; return child; }
  remove() { this.isConnected=false; if(this.registry && this.id) delete this.registry[this.id]; }
  closest(selector) { return selector.includes(this.tagName.toLowerCase()) || selector.includes(`[role="${this.getAttribute('role')}"]`) ? this : null; }
  matches(selector) { return selector.includes(this.tagName.toLowerCase()); }
  getAttribute(name) { return this.attributes[name] || null; }
  setAttribute(name,value) { this.attributes[name]=String(value); }
  focus() { if(this.registry) this.registry.__document.activeElement=this; }
  click() { this.clicked=(this.clicked||0)+1; if(this.registry && this.registry.__body) this.registry.__body.dataset.clicked='yes'; }
  dispatchEvent(event) { this.events=(this.events||[]).concat(event.type); return true; }
  addEventListener() {}
  scrollBy({top}) { this.scrollTop=(this.scrollTop||0)+top; }
}
const registry={};
const html=new FakeNode('HTML',registry), body=new FakeNode('BODY',registry);
registry.__document={activeElement:body}; registry.__body=body;
html.scrollHeight=2000; html.clientHeight=800; body.scrollHeight=2000; body.clientHeight=800;
const media={pauseCount:0,playCount:0,pause(){this.pauseCount++},play(){this.playCount++;return Promise.resolve()}};
let focusInListener=null;
const doc={
  documentElement:html, body, activeElement:body,
  createElement(tag){return new FakeNode(tag,registry)},
  getElementById(id){return registry[id] || (id==='__hfp_v3_pointer'||id==='__hfp_v3_keyboard' ? null : null)},
  elementFromPoint(){return button},
  querySelectorAll(selector){return /video,audio/.test(selector)?[media]:[]},
  addEventListener(type,fn){if(type==='focusin')focusInListener=fn},
};
const button=new FakeNode('BUTTON',registry); button.isConnected=true; button.clientHeight=20; button.scrollHeight=20;
let handler;
const chrome={runtime:{onMessage:{addListener(fn){handler=fn}}}};
const window={__hfpV4Installed:false,scrollY:0,scrollBy({top}){this.scrollY+=top}};
const context={window,document:doc,chrome,innerWidth:1000,innerHeight:800,getComputedStyle:node=>node.style,
  PointerEvent:FakeEvent,MouseEvent:FakeEvent,KeyboardEvent:FakeEvent,InputEvent:FakeEvent,Event:FakeEvent,
  Object,Number,String,Math,Date,Promise,console};
vm.runInNewContext(fs.readFileSync('content.js','utf8'),context);
function send(command, extra={}) {
  return new Promise((resolve,reject)=>{
    try { const keep=handler({type:'HFP4',command,...extra},{},resolve); if(keep!==true) reject(new Error('content handler did not keep response channel open')); }
    catch(e){reject(e)}
  });
}
(async()=>{
  let result=await send('PING'); assert.equal(result.version,4,'page script version responds');
  result=await send('MOVE',{x:.25,y:.75,showPointer:true}); assert.equal(result.ok,true); assert.equal(registry.__hfp_v4_pointer.style.display,'block'); assert.equal(registry.__hfp_v4_pointer.style.left,'250px'); assert.ok(button.events.includes('mousemove'),'pointer dispatches move events');
  result=await send('CLICK'); assert.equal(result.ok,true); assert.equal(body.dataset.clicked,'yes');
  result=await send('SCROLL',{amount:200}); assert.equal(result.ok,true); assert.equal(window.scrollY,200);
  result=await send('PAUSE'); assert.equal(result.ok,true); assert.equal(media.pauseCount,1);
  result=await send('PLAY'); assert.equal(result.ok,true); assert.equal(media.playCount,1);
  result=await send('KEYBOARD',{open:true}); assert.equal(result.ok,true); assert.ok(registry.__hfp_v4_keyboard.isConnected);
  result=await send('KEYBOARD',{open:false}); assert.equal(result.ok,true); assert.equal(registry.__hfp_v4_keyboard,undefined);
  result=await send('HIDE'); assert.equal(result.ok,true); assert.equal(registry.__hfp_v4_pointer.style.display,'none');
  console.log('page-content: all 19 assertions passed');
})().catch(error=>{console.error(error);process.exitCode=1});
