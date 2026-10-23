(() => {
  'use strict';
  if (window.__hfpV41Installed) return;
  window.__hfpV41Installed = true;
  // Clean up the previous release's visible overlays if its isolated world is still present.
  document.getElementById('__hfp_v3_pointer')?.remove();
  document.getElementById('__hfp_v3_keyboard')?.remove();
  document.getElementById('__hfp_v4_pointer')?.remove();
  document.getElementById('__hfp_v4_keyboard')?.remove();
  let pointer = null, keyboardRoot = null, keyboardTarget = null;
  let pointerX = Math.round(innerWidth/2), pointerY = Math.round(innerHeight/2), lastClick = 0;
  let continuousScrollTimer = null, continuousScrollDirection = 0, continuousScrollSpeed = 5;
  let keyboardAnchor = {x:0.5,y:0.48}, keyboardCaps = false, keyboardShift = false, keyboardSymbols = false;

  function ensurePointer() {
    if (pointer?.isConnected) return;
    pointer = document.createElement('div');
    pointer.id = '__hfp_v4_pointer';
    Object.assign(pointer.style,{position:'fixed',zIndex:'2147483647',width:'22px',height:'22px',border:'3px solid #ff3b30',borderRadius:'50%',background:'#ffffff55',boxShadow:'0 0 0 2px #1118',pointerEvents:'none',transform:'translate(-50%,-50%)',left:pointerX+'px',top:pointerY+'px',display:'none'});
    (document.documentElement || document.body).appendChild(pointer);
  }
  function move(x,y,show=true) {
    pointerX = Math.max(0,Math.min(Math.max(0,innerWidth-1),Number(x)*innerWidth));
    pointerY = Math.max(0,Math.min(Math.max(0,innerHeight-1),Number(y)*innerHeight));
    ensurePointer();
    pointer.style.left = pointerX+'px'; pointer.style.top = pointerY+'px'; pointer.style.display = show ? 'block':'none';
    // Script-driven mousemove supports JavaScript hover handlers; CSS :hover still requires a real pointer.
    const hit = document.elementFromPoint(pointerX,pointerY);
    if (hit) {
      const opts = {bubbles:true,cancelable:true,view:window,clientX:pointerX,clientY:pointerY,button:0,buttons:0};
      try { hit.dispatchEvent(new PointerEvent('pointermove',{...opts,pointerId:1,pointerType:'mouse',isPrimary:true})); } catch {}
      try { hit.dispatchEvent(new MouseEvent('mousemove',opts)); } catch {}
    }
  }
  function hidePointer() { if (pointer?.isConnected) pointer.style.display='none'; }
  function findTarget(x=pointerX,y=pointerY) {
    const raw = document.elementFromPoint(x,y);
    if (!raw) return null;
    return raw.closest?.('button,a,input,textarea,select,summary,[role="button"],[role="link"],[contenteditable="true"]') || raw;
  }
  function clickTarget() {
    const now = Date.now();
    if (now-lastClick < 520) return;
    lastClick = now;
    let target = findTarget();
    if (!target) return {ok:false,error:'No clickable page element is under the gesture pointer. Raise your index finger to position the pointer, then pinch.'};
    try { target.focus({preventScroll:true}); } catch {}
    // HTMLElement.click() activates common controls and links more reliably than a synthetic
    // event sequence. For canvas/custom surfaces, provide a normal untrusted mouse sequence.
    const isInteractive = target.matches?.('button,a,input,textarea,select,summary,[role="button"],[role="link"]');
    if (isInteractive && typeof target.click === 'function') {
      target.click();
    } else {
      const opts = {bubbles:true,cancelable:true,view:window,clientX:pointerX,clientY:pointerY,button:0,buttons:1};
      try { target.dispatchEvent(new PointerEvent('pointerdown',{...opts,pointerId:1,pointerType:'mouse',isPrimary:true})); } catch {}
      target.dispatchEvent(new MouseEvent('mousedown',opts));
      try { target.dispatchEvent(new PointerEvent('pointerup',{...opts,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:0})); } catch {}
      target.dispatchEvent(new MouseEvent('mouseup',{...opts,buttons:0}));
      target.dispatchEvent(new MouseEvent('click',{...opts,buttons:0}));
    }
    if (isEditable(target)) keyboardTarget = target;
    return {ok:true, detail:`clicked ${target.tagName.toLowerCase()}`};
  }
  function isEditable(el) {
    return !!el && (el.matches?.('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]),textarea') || el.isContentEditable || el.getAttribute?.('role') === 'textbox');
  }
  document.addEventListener('focusin', e => { if (isEditable(e.target)) keyboardTarget = e.target; }, true);
  async function media(play) {
    const elements = [...document.querySelectorAll('video,audio')];
    if (!elements.length) return {ok:false,error:'No audio/video element is accessible in this page. Some players live in cross-origin frames.'};
    if (!play) {
      elements.forEach(element => { try { element.pause(); } catch {} });
      return {ok:true,detail:`paused ${elements.length} media element(s)`};
    }
    const results = await Promise.all(elements.map(async element => {
      try { await element.play(); return true; } catch { return false; }
    }));
    const playing = results.filter(Boolean).length;
    if (!playing) return {ok:false,error:'The page or browser blocked scripted playback. Press its Play button once manually, then retry the open-palm gesture.'};
    return {ok:true,detail:`play requested for ${playing} media element(s)`};
  }
  function scrollPage(amount) {
    const hit = document.elementFromPoint(pointerX,pointerY);
    let node = hit;
    while (node && node !== document.body && node !== document.documentElement) {
      const style = getComputedStyle(node);
      const scrollable = /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 3;
      if (scrollable) { node.scrollBy({top:amount,behavior:'auto'}); return {ok:true,detail:'scrolled page region'}; }
      node = node.parentElement;
    }
    if (document.documentElement.scrollHeight > innerHeight + 3 || document.body.scrollHeight > innerHeight + 3) {
      window.scrollBy({top:amount,behavior:'auto'});
      return {ok:true,detail:'scrolled page'};
    }
    return {ok:false,error:'This page has no vertically scrollable area at the pointer position.'};
  }
  function stopContinuousScroll() {
    if (continuousScrollTimer !== null) clearInterval(continuousScrollTimer);
    continuousScrollTimer = null;
    continuousScrollDirection = 0;
  }
  function startContinuousScroll(direction, speed=5) {
    const dir = direction > 0 ? 1 : direction < 0 ? -1 : 0;
    if (!dir) { stopContinuousScroll(); return {ok:true,detail:'continuous scrolling stopped'}; }
    const parsedSpeed = Math.max(1, Math.min(10, Number(speed) || 5));
    if (continuousScrollTimer !== null && continuousScrollDirection === dir && continuousScrollSpeed === parsedSpeed) {
      return {ok:true,detail:dir < 0 ? 'continuous upward scroll active' : 'continuous downward scroll active'};
    }
    stopContinuousScroll();
    continuousScrollDirection = dir;
    continuousScrollSpeed = parsedSpeed;
    const tick = () => {
      const amount = continuousScrollDirection * Math.round(5 + continuousScrollSpeed * 3.1);
      const result = scrollPage(amount);
      if (!result.ok) stopContinuousScroll();
    };
    tick();
    continuousScrollTimer = setInterval(tick, 38);
    return {ok:true,detail:dir < 0 ? 'continuous upward scroll active' : 'continuous downward scroll active'};
  }
  function setKeyButtonStyle(button, key) {
    Object.assign(button.style,{
      all:'unset',boxSizing:'border-box',flex:key.wide ? `${key.wide} 1 0` : '1 1 0',minWidth:'0',minHeight:'38px',
      display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',borderRadius:'7px',
      background:['Close','Backspace'].includes(key.value) ? '#7f2632' : ['Caps','Shift','Enter','Tab','Space','123','ABC'].includes(key.value) ? '#465873' : '#26354a',
      color:'#f8fafc',font:'600 12px/1.1 system-ui,Segoe UI,sans-serif',cursor:'pointer',userSelect:'none',whiteSpace:'nowrap',
      boxShadow:'inset 0 -2px 0 #0003',overflow:'hidden'
    });
  }
  function keyboardLayouts() {
    if (!keyboardSymbols) return [
      ['1','2','3','4','5','6','7','8','9','0',{label:'⌫',value:'Backspace',wide:1.25}],
      ['q','w','e','r','t','y','u','i','o','p'],
      [{label:'Caps',value:'Caps',wide:1.3},'a','s','d','f','g','h','j','k','l',{label:'Enter',value:'Enter',wide:1.3}],
      [{label:'Shift',value:'Shift',wide:1.45},'z','x','c','v','b','n','m',',','.','/',{label:'Shift',value:'Shift',wide:1.45}],
      [{label:'123',value:'123',wide:1.15},{label:'Tab',value:'Tab',wide:1.1},{label:'Space',value:'Space',wide:5},{label:'←',value:'ArrowLeft',wide:1.05},{label:'→',value:'ArrowRight',wide:1.05},{label:'Close',value:'Close',wide:1.35}]
    ];
    return [
      ['1','2','3','4','5','6','7','8','9','0',{label:'⌫',value:'Backspace',wide:1.25}],
      ['!','@','#','$','%','^','&','*','(',')'],
      [{label:'ABC',value:'ABC',wide:1.3},'-','_','=','+','[',']','{','}','Enter'],
      [';',':',"'",'"',',','.','/','?','\\','|'],
      [{label:'ABC',value:'ABC',wide:1.15},{label:'Tab',value:'Tab',wide:1.1},{label:'Space',value:'Space',wide:5},{label:'←',value:'ArrowLeft',wide:1.05},{label:'→',value:'ArrowRight',wide:1.05},{label:'Close',value:'Close',wide:1.35}]
    ];
  }
  function handleVirtualKey(key) {
    if (key === 'Close') { removeKeyboard(); return; }
    if (key === 'Caps') { keyboardCaps = !keyboardCaps; refreshKeyboardLabels(); return; }
    if (key === 'Shift') { keyboardShift = !keyboardShift; refreshKeyboardLabels(); return; }
    if (key === '123') { keyboardSymbols = true; renderKeyboardRows(); return; }
    if (key === 'ABC') { keyboardSymbols = false; renderKeyboardRows(); return; }
    typeKey(key);
  }
  function renderKeyboardRows() {
    const rowsRoot = keyboardRoot?.querySelector?.('[data-key-rows]');
    if (!rowsRoot) return;
    rowsRoot.textContent = '';
    for (const rowKeys of keyboardLayouts()) {
      const row = document.createElement('div');
      Object.assign(row.style,{display:'flex',gap:'4px',justifyContent:'center',width:'100%',margin:'3px 0'});
      for (const raw of rowKeys) {
        const key = typeof raw === 'string' ? {label:raw,value:raw} : {...raw};
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = key.label;
        button.setAttribute('aria-label', ({'Space':'Space','Backspace':'Backspace','Close':'Close keyboard','Caps':'Caps lock','Shift':'Shift','123':'Symbols','ABC':'Letters','ArrowLeft':'Move caret left','ArrowRight':'Move caret right'}[key.value]) || key.label);
        button.dataset.key = key.value;
        setKeyButtonStyle(button,key);
        button.addEventListener('click', () => handleVirtualKey(key.value));
        row.appendChild(button);
      }
      rowsRoot.appendChild(row);
    }
  }
  function refreshKeyboardLabels() {
    if (!keyboardRoot?.isConnected) return;
    const buttons = keyboardRoot.querySelectorAll?.('button[data-key]') || [];
    for (const button of buttons) {
      const key = button.dataset.key;
      if (/^[a-z]$/i.test(key)) button.textContent = (keyboardCaps !== keyboardShift) ? key.toUpperCase() : key.toLowerCase();
    }
  }
  function positionKeyboard(anchor) {
    if (!keyboardRoot) return;
    if (anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)) {
      keyboardAnchor = {x:Math.max(0.03,Math.min(0.97,anchor.x)),y:Math.max(0.05,Math.min(0.90,anchor.y))};
    }
    const width = Math.min(760, Math.max(270, innerWidth - 16));
    const estimatedHeight = 280;
    const left = Math.max(8,Math.min(Math.max(8,innerWidth-width-8),Math.round(keyboardAnchor.x*innerWidth-width/2)));
    const top = Math.max(8,Math.min(Math.max(8,innerHeight-estimatedHeight-8),Math.round(keyboardAnchor.y*innerHeight+24)));
    keyboardRoot.style.width = `min(760px, calc(100vw - 16px))`;
    keyboardRoot.style.left = left+'px'; keyboardRoot.style.top = top+'px';
  }
  function buildKeyboard(anchor) {
    if (!keyboardRoot?.isConnected) {
      keyboardRoot = document.createElement('div');
      keyboardRoot.id = '__hfp_v41_keyboard';
      Object.assign(keyboardRoot.style,{all:'initial',position:'fixed',zIndex:'2147483647',bottom:'auto',left:'8px',top:'8px',transform:'none',display:'block',boxSizing:'border-box',width:'min(760px, calc(100vw - 16px))',maxWidth:'calc(100vw - 16px)',padding:'8px',background:'#101827',border:'1px solid #526078',borderRadius:'13px',boxShadow:'0 8px 35px #0009',font:'13px/1.3 system-ui,Segoe UI,sans-serif',color:'#f8fafc',isolation:'isolate'});
      const header = document.createElement('div');
      Object.assign(header.style,{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',marginBottom:'5px',padding:'2px 2px 5px',borderBottom:'1px solid #435169',color:'#f8fafc',font:'600 12px system-ui,sans-serif'});
      const title = document.createElement('span'); title.textContent = 'Hands-free keyboard · click a text field first';
      Object.assign(title.style,{display:'block',flex:'1',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'});
      const close = document.createElement('button'); close.type='button'; close.textContent='×'; close.setAttribute('aria-label','Close keyboard');
      Object.assign(close.style,{all:'unset',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',minWidth:'28px',minHeight:'28px',borderRadius:'7px',background:'#7f2632',color:'white',font:'700 21px system-ui,sans-serif'});
      close.addEventListener('click',removeKeyboard);
      header.appendChild(title); header.appendChild(close); keyboardRoot.appendChild(header);
      const rows = document.createElement('div'); rows.setAttribute('data-key-rows',''); keyboardRoot.appendChild(rows);
      document.documentElement.appendChild(keyboardRoot);
      renderKeyboardRows();
    }
    positionKeyboard(anchor);
  }
  function removeKeyboard() {
    keyboardRoot?.remove(); keyboardRoot=null; keyboardTarget=null;
    keyboardCaps=false; keyboardShift=false; keyboardSymbols=false;
  }
  function typeKey(key) {
    const el = keyboardTarget?.isConnected ? keyboardTarget : (isEditable(document.activeElement) ? document.activeElement : null);
    if (!el) return;
    if (key === 'Tab') {
      if (el.tagName === 'TEXTAREA' || el.isContentEditable) key = '\t';
      else {
        const editables = [...document.querySelectorAll('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"],[role="textbox"]')].filter(isEditable);
        const next = editables[(Math.max(0,editables.indexOf(el))+1)%Math.max(1,editables.length)];
        if (next) { next.focus(); keyboardTarget=next; }
        return;
      }
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      try {
        const pos = typeof el.selectionStart === 'number' ? el.selectionStart : String(el.value || '').length;
        const next = Math.max(0,Math.min(String(el.value || '').length,pos+(key==='ArrowLeft'?-1:1)));
        el.setSelectionRange(next,next);
      } catch {}
      return;
    }
    try { el.focus({preventScroll:true}); } catch {}
    const insertedLetter = /^[a-z]$/i.test(key) ? ((keyboardCaps !== keyboardShift) ? key.toUpperCase() : key.toLowerCase()) : key;
    keyboardShift = false;
    refreshKeyboardLabels();
    if (el.isContentEditable || el.getAttribute?.('role')==='textbox') {
      if (key==='Enter') { document.execCommand('insertLineBreak'); return; }
      if (key==='Backspace') { document.execCommand('delete'); return; }
      document.execCommand('insertText',false,key==='Space'?' ':insertedLetter);
      return;
    }
    const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value')?.set;
    let start = typeof el.selectionStart==='number' ? el.selectionStart : String(el.value || '').length;
    let end = typeof el.selectionEnd==='number' ? el.selectionEnd : start;
    let inserted = key==='Space' ? ' ' : key==='Enter' ? '\n' : insertedLetter;
    let newValue = String(el.value || '');
    if (key==='Enter' && el.tagName !== 'TEXTAREA') {
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
      if (el.form) el.form.requestSubmit?.();
      else el.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true}));
      return;
    }
    if (key==='Backspace') {
      inserted='';
      if (start===end && start>0) start--;
    }
    newValue = newValue.slice(0,start) + inserted + newValue.slice(end);
    try { if (valueSetter) valueSetter.call(el,newValue); else el.value=newValue; } catch { el.value=newValue; }
    const caret = start + inserted.length;
    try { el.setSelectionRange(caret,caret); } catch {}
    const inputType = key==='Backspace' ? 'deleteContentBackward' : 'insertText';
    el.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:false,inputType,data:inserted || null}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'HFP41') return;
    (async () => {
      try {
        let result = {ok:true};
        switch(message.command) {
          case 'PING': result = {ok:true,version:41,detail:'v4.1 page script connected'}; break;
          case 'MOVE': move(message.x,message.y,message.showPointer !== false); result = {ok:true}; break;
          case 'HIDE': hidePointer(); result = {ok:true}; break;
          case 'CLICK': result = clickTarget() || {ok:true}; break;
          case 'PAUSE': result = await media(false); break;
          case 'PLAY': result = await media(true); break;
          case 'SCROLL': result = scrollPage(Number(message.amount) || 0); break;
          case 'SCROLL_START': result = startContinuousScroll(Number(message.direction) || 0, Number(message.speed) || 5); break;
          case 'SCROLL_STOP': stopContinuousScroll(); result = {ok:true,detail:'continuous scrolling stopped'}; break;
          case 'KEYBOARD': if (message.open) buildKeyboard(message.anchor); else removeKeyboard(); result = {ok:true,detail:message.open?'keyboard opened below hand position':'keyboard closed'}; break;
          default: result = {ok:false,error:`Unknown page command: ${message.command || '(none)'}`};
        }
        sendResponse(result);
      } catch(error) {
        sendResponse({ok:false,error:error?.message || String(error)});
      }
    })();
    return true;
  });
})();
