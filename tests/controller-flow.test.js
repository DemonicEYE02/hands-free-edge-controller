const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../gesture-core.js');

class El {
  constructor(id='') { this.id=id; this.value=''; this.checked=true; this.textContent=''; this.className=''; this.style={}; this.listeners={}; this.width=0; this.height=0; this.readyState=2; this.srcObject=null; }
  addEventListener(type,fn) { (this.listeners[type] ||= []).push(fn); }
  click() { for (const fn of this.listeners.click||[]) fn({target:this}); }
  getContext() { return ctx; }
  play() { return Promise.resolve(); }
}
const ctx={clearRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},lineWidth:1,strokeStyle:'',fillStyle:''};
const elements={};
for (const id of ['video','canvas','tracking','message','status','log','targetStatus','fps','sens','sensval','scroll','scrollval','pointer','start','pause','gestureStatus']) elements[id]=new El(id);
elements.sens.value='5'; elements.scroll.value='5'; elements.pointer.checked=true;
elements.video.readyState=2;
const iframeWindow={postMessage(payload) {
  if(payload.type==='FRAME') {
    frameCount++;
    const sample = frameCount <= 3 ? pointerHand() : pinchHand();
    const event={source:iframeWindow,data:{type:'FRAME_RESULT',requestId:payload.requestId,hands:[{landmarks:sample,handedness:'Right'}]}};
    for(const fn of windowListeners.message||[]) fn(event);
  }
}};
elements.visionFrame=new El('visionFrame'); elements.visionFrame.contentWindow=iframeWindow;
const document={getElementById(id){return elements[id] || null;},createElement(tag){return new El(tag);}};
const windowListeners={}; let frameCount=0; let virtualNow=100; let pumpSchedules=0; const sent=[];
const fakeWindow={addEventListener(type,fn){(windowListeners[type] ||= []).push(fn);},setTimeout(fn,delay){const token=++pumpSchedules;if(delay===30 && token<=8) setTimeout(fn,2);return token;},clearTimeout(){}};
const stream={getTracks(){return [{stop(){}}]}};
const navigator={mediaDevices:{getUserMedia:async()=>stream}};
const chrome={runtime:{sendMessage:async message=>{
  sent.push(message);
  if(message.command==='CHECK_TARGET') return {ok:true,url:'https://example.test/',host:'example.test'};
  return {ok:true,url:'https://example.test/',host:'example.test',pageResult:{ok:true}};
}}};
function makeHand({pinch=false}={}) {
  const p=Array.from({length:21},()=>({x:.5,y:.6,z:0}));
  const set=(i,x,y)=>p[i]={x,y,z:0};
  set(0,.5,.9); set(1,.46,.78); set(2,.43,.76); set(3,.45,.77); set(4,pinch?.42:.47,pinch?.18:.79);
  const finger=(base,x,extended)=>{set(base,x,.69);set(base+1,x,.56);set(base+2,x,extended?.38:.60);set(base+3,x,extended?.19:.65)};
  finger(5,.42,true); finger(9,.49,false); finger(13,.56,false); finger(17,.63,false);
  set(8,.42,.18); set(12,.49,.64); set(16,.56,.64); set(20,.63,.64);
  if(pinch) set(4,.425,.185);
  return p;
}
function pointerHand(){return makeHand({pinch:false})}
function pinchHand(){return makeHand({pinch:true})}
vm.runInNewContext(fs.readFileSync('controller.js','utf8'),{
  document,window:fakeWindow,navigator,chrome,HFPGestureCore:core,performance:{now(){virtualNow+=100;return virtualNow;}},
  createImageBitmap:async()=>({close(){}}),Date,Math,Number,String,Promise,URL,console
});
for(const fn of windowListeners.message||[]) fn({source:iframeWindow,data:{type:'ENGINE_STATUS',state:'ready',message:'test engine ready'}});
(async()=>{
  elements.start.click();
  await new Promise(resolve=>setTimeout(resolve,120));
  const commands=sent.map(m=>m.command);
  assert.ok(commands.includes('CHECK_TARGET'),'controller validates target on startup');
  assert.ok(commands.includes('MOVE'),'one-index-finger pose sends pointer movement');
  assert.ok(commands.includes('CLICK'),'pinch transition sends a click command');
  assert.equal(elements.gestureStatus.textContent,'Gesture: pinch','panel reports current pose');
  console.log('controller-flow: all 4 assertions passed');
})().catch(error=>{console.error(error);process.exitCode=1});
