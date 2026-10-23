(() => {
  'use strict';
  if (window.__hfpV4Installed) return;
  window.__hfpV4Installed = true;
  // Clean up the previous release's visible overlays if its isolated world is still present.
  document.getElementById('__hfp_v3_pointer')?.remove();
  document.getElementById('__hfp_v3_keyboard')?.remove();
  let pointer = null, keyboardRoot = null, keyboardTarget = null;
  let pointerX = Math.round(innerWidth/2), pointerY = Math.round(innerHeight/2), lastClick = 0;

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
  function buildKeyboard() {
    if (keyboardRoot?.isConnected) return;
    keyboardRoot = document.createElement('div');
    keyboardRoot.id = '__hfp_v4_keyboard';
    Object.assign(keyboardRoot.style,{position:'fixed',zIndex:'2147483647',bottom:'10px',left:'50%',transform:'translateX(-50%)',display:'grid',gridTemplateColumns:'repeat(10,minmax(24px,1fr))',gap:'4px',padding:'9px',background:'#111827',border:'1px solid #526078',borderRadius:'12px',maxWidth:'calc(100vw - 14px)',width:'min(590px,calc(100vw - 14px))',boxShadow:'0 8px 35px #0008',font:'13px system-ui'});
    const keys = ['1','2','3','4','5','6','7','8','9','0','q','w','e','r','t','y','u','i','o','p','a','s','d','f','g','h','j','k','l','⌫','z','x','c','v','b','n','m',',','.','-','Space','Enter','Hide'];
    for (const key of keys) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = key;
      Object.assign(button.style,{minWidth:'0',padding:'10px 2px',border:'0',borderRadius:'6px',background:key==='Hide'?'#7f2632':'#364154',color:'white',font:'600 12px system-ui',cursor:'pointer'});
      button.addEventListener('click',() => { if (key==='Hide') { removeKeyboard(); return; } typeKey(key); });
      keyboardRoot.appendChild(button);
    }
    document.documentElement.appendChild(keyboardRoot);
  }
  function removeKeyboard() { keyboardRoot?.remove(); keyboardRoot=null; keyboardTarget=null; }
  function typeKey(key) {
    const el = keyboardTarget?.isConnected ? keyboardTarget : (isEditable(document.activeElement) ? document.activeElement : null);
    if (!el) return;
    try { el.focus({preventScroll:true}); } catch {}
    if (el.isContentEditable || el.getAttribute?.('role')==='textbox') {
      if (key==='Enter') { document.execCommand('insertLineBreak'); return; }
      if (key==='⌫') { document.execCommand('delete'); return; }
      document.execCommand('insertText',false,key==='Space'?' ':key);
      return;
    }
    const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value')?.set;
    let start = typeof el.selectionStart==='number' ? el.selectionStart : String(el.value || '').length;
    let end = typeof el.selectionEnd==='number' ? el.selectionEnd : start;
    let inserted = key==='Space' ? ' ' : key==='Enter' ? '\n' : key;
    let newValue = String(el.value || '');
    if (key==='Enter' && el.tagName !== 'TEXTAREA') {
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));
      if (el.form) el.form.requestSubmit?.();
      else el.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true}));
      return;
    }
    if (key==='⌫') {
      inserted='';
      if (start===end && start>0) start--;
    }
    newValue = newValue.slice(0,start) + inserted + newValue.slice(end);
    try { if (valueSetter) valueSetter.call(el,newValue); else el.value=newValue; } catch { el.value=newValue; }
    const caret = start + inserted.length;
    try { el.setSelectionRange(caret,caret); } catch {}
    el.dispatchEvent(new InputEvent('input',{bubbles:true,cancelable:false,inputType:key==='⌫'?'deleteContentBackward':'insertText',data:inserted || null}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'HFP4') return;
    (async () => {
      try {
        let result = {ok:true};
        switch(message.command) {
          case 'PING': result = {ok:true,version:4,detail:'page script connected'}; break;
          case 'MOVE': move(message.x,message.y,message.showPointer !== false); result = {ok:true}; break;
          case 'HIDE': hidePointer(); result = {ok:true}; break;
          case 'CLICK': result = clickTarget() || {ok:true}; break;
          case 'PAUSE': result = await media(false); break;
          case 'PLAY': result = await media(true); break;
          case 'SCROLL': result = scrollPage(Number(message.amount) || 0); break;
          case 'KEYBOARD': if (message.open) buildKeyboard(); else removeKeyboard(); result = {ok:true,detail:message.open?'keyboard opened':'keyboard closed'}; break;
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
