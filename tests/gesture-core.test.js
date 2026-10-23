const assert = require('node:assert/strict');
const core = require('../gesture-core.js');

function hand({thumb=false, index=false, middle=false, ring=false, pinky=false}={}) {
  // Build a compact, normalized 21-landmark hand with controllable finger extension.
  const p = Array.from({length:21}, () => ({x:0.5,y:0.6,z:0}));
  const set = (i,x,y) => { p[i]={x,y,z:0}; };
  set(0,.50,.90);
  // thumb: folded close to palm; extended across and away from the index MCP
  set(1,.46,.78); set(2,.43,.76); set(3,thumb?.36:.45,thumb?.71:.77); set(4,thumb?.27:.47,thumb?.69:.79);
  const finger = (base, x, extended) => {
    set(base,x,.69); set(base+1,x,.56); set(base+2,x,extended?.38:.60); set(base+3,x,extended?.19:.65);
  };
  finger(5,.42,index); finger(9,.49,middle); finger(13,.56,ring); finger(17,.63,pinky);
  // put tips at the expected MediaPipe indices
  set(8,.42,index?.18:.64); set(12,.49,middle?.18:.64); set(16,.56,ring?.19:.64); set(20,.63,pinky?.22:.64);
  return p;
}
const state = opts => core.fingerState(hand(opts));
assert.deepEqual(state({index:true}), [false,true,false,false,false], 'index-only gesture');
assert.deepEqual(state({index:true,middle:true}), [false,true,true,false,false], 'two-finger gesture');
assert.deepEqual(state({index:true,middle:true,ring:true}), [false,true,true,true,false], 'pinky-click pose');
assert.deepEqual(state({index:true,middle:true,ring:true,pinky:true}), [false,true,true,true,true], 'open palm without the thumb');
assert.deepEqual(state({thumb:true,index:true,middle:true,ring:true,pinky:true}), [true,true,true,true,true], 'all ten fingers gesture requires an extended thumb on each hand');
assert.equal(core.classifyPose([false,true,false,false,false]), 'pointer');
assert.equal(core.classifyPose([false,true,true,false,false]), 'two-finger');
assert.equal(core.classifyPose([false,true,true,true,false]), 'pinky-click');
assert.equal(core.classifyPose([false,false,false,false,false]), 'fist');
assert.equal(core.classifyPose([false,true,true,true,true]), 'open-palm');
assert.equal(core.classifyPose([false,false,false,false,false], true), 'pinch');
const center = core.pointerFromIndex({x:.5,y:.5}, 5);
assert.ok(Math.abs(center.x-.5)<1e-9 && Math.abs(center.y-.5)<1e-9);
const left = core.pointerFromIndex({x:0,y:0}, 5);
assert.ok(left.x <= 1 && left.x >= 0 && left.y <= 1 && left.y >= 0);
console.log('gesture-core: all 13 assertions passed');
