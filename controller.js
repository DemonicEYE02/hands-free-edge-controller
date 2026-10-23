(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const video = $('video');
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const frameCanvas = document.createElement('canvas');
  const frameCtx = frameCanvas.getContext('2d', {alpha:false, desynchronized:true});
  const visionFrame = $('visionFrame');
  const previewStatus = $('tracking');
  let stream = null;
  let cameraActive = false;
  let cameraStarting = false;
  let cameraErrorMessage = '';
  let cameraStateText = 'Camera not started — click Start';
  let engineReady = false;
  let engineFailed = false;
  let enabled = true;
  let framePending = false;
  let requestId = 0;
  let lastSentAt = 0;
  let lastFrameAt = 0;
  let stateHistory = [];
  let targetHost = 'current webpage';
  let twoTrack = null;
  let keyboardOpen = false;
  let tenSince = 0;
  let lostTenSince = 0;
  let prevPinch = false;
  let prevPinkyPose = false;
  let mediaPose = '';
  let mediaPoseSince = 0;
  let mediaPoseFired = false;
  let lastMediaAt = 0;
  let lastClickAt = 0;
  let lastTabAt = 0;
  let lastRouteErrorAt = 0;
  let lastDebugAt = 0;

  function setStatus(text, kind='ok') {
    const el = $('status');
    el.textContent = text;
    el.className = 'status' + (kind === 'error' ? ' error' : kind === 'loading' ? ' loading' : '');
  }
  function log(text) { $('log').textContent = text; }
  function renderCameraStatus() {
    previewStatus.textContent = cameraStateText;
    if (cameraErrorMessage) {
      $('message').textContent = cameraErrorMessage;
    } else if (cameraStarting) {
      $('message').textContent = 'Requesting camera permission… approve the Edge prompt if one appears.';
    } else if (cameraActive) {
      $('message').textContent = engineReady
        ? 'Camera active. Hold one hand in view and raise your index finger to move the pointer.'
        : engineFailed
          ? 'Camera is active, but the online tracking engine failed. Check the error log.'
          : 'Camera is active; waiting for the online tracking engine…';
    } else if (engineFailed) {
      $('message').textContent = 'The online tracking engine failed. Check the error log and internet access.';
    } else if (engineReady) {
      $('message').textContent = 'Tracking engine ready. Click Start / restart camera to grant camera access.';
    } else {
      $('message').textContent = 'Waiting for the online tracking engine. Click Start / restart camera when ready.';
    }
  }
  function send(command, extra={}) {
    chrome.runtime.sendMessage({type:'HFP4', command, ...extra}).then(result => {
      if (result && result.ok === false) {
        if (Date.now() - lastRouteErrorAt > 1200 || command !== 'MOVE') {
          lastRouteErrorAt = Date.now();
          $('targetStatus').textContent = result.error || 'Target page unavailable';
          if (command !== 'MOVE') setStatus('Action not delivered','error');
          log((result.error || 'Could not contact target webpage') + (command === 'MOVE' ? '' : `\nGesture command: ${command}`));
        }
        return;
      }
      if (result?.host) targetHost = result.host;
      else if (result?.url) {
        try { targetHost = new URL(result.url).hostname || 'current webpage'; } catch {}
      }
      if (result?.pageResult?.detail && command !== 'MOVE') {
        $('targetStatus').textContent = `Connected: ${targetHost} · ${result.pageResult.detail}`;
      } else if (command !== 'MOVE' && result?.ok) {
        $('targetStatus').textContent = `Connected: ${targetHost} · ${command.toLowerCase()} delivered`;
      }
    }).catch(error => {
      if (Date.now() - lastRouteErrorAt > 1200) {
        lastRouteErrorAt = Date.now();
        $('targetStatus').textContent = 'Extension messaging failed';
        if (command !== 'MOVE') setStatus('Action not delivered','error');
        log('Extension messaging failed: ' + (error?.message || String(error)));
      }
    });
  }
  $('sens').addEventListener('input', e => $('sensval').textContent = e.target.value);
  $('scroll').addEventListener('input', e => $('scrollval').textContent = e.target.value);

  // Connections used for the small local preview overlay.
  const bones = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
  function drawHands(hands) {
    const w = 320, h = 240;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0,0,w,h);
    ctx.lineWidth = 2.2;
    for (const hand of hands) {
      const points = hand.landmarks;
      ctx.strokeStyle = '#43f0a0'; ctx.fillStyle = '#c8ffe4';
      for (const [a,b] of bones) {
        if (!points[a] || !points[b]) continue;
        ctx.beginPath(); ctx.moveTo(points[a].x*w, points[a].y*h); ctx.lineTo(points[b].x*w, points[b].y*h); ctx.stroke();
      }
      for (const p of points) { ctx.beginPath(); ctx.arc(p.x*w,p.y*h,2.3,0,Math.PI*2); ctx.fill(); }
    }
  }
  const distance = HFPGestureCore.distance;
  const fingerState = HFPGestureCore.fingerState;
  function stabilizeFingerStates(states) {
    if (stateHistory.length && stateHistory[stateHistory.length - 1].length !== states.length) stateHistory = [];
    stateHistory.push(states.map(f => f.slice()));
    if (stateHistory.length > 3) stateHistory.shift();
    if (stateHistory.length < 2) return states;
    return states.map((f, handIndex) => f.map((value, fingerIndex) => {
      const votes = stateHistory.reduce((n, snapshot) => n + (snapshot[handIndex]?.[fingerIndex] ? 1 : 0), 0);
      return votes >= Math.ceil(stateHistory.length / 2);
    }));
  }
  function setPointer(l) {
    const point = HFPGestureCore.pointerFromIndex(l[8], Number($('sens').value));
    send('MOVE',{x:point.x,y:point.y,showPointer:$('pointer').checked,sensitivity:Number($('sens').value)});
  }
  function stableMediaPose(key, now) {
    if (key !== mediaPose) { mediaPose = key; mediaPoseSince = now; mediaPoseFired = false; }
    if (!key) { mediaPoseSince = 0; mediaPoseFired = false; return; }
    if (!mediaPoseFired && now-mediaPoseSince >= 550 && now-lastMediaAt >= 1100) {
      send(key === 'fist' ? 'PAUSE' : 'PLAY');
      log(key === 'fist' ? 'Gesture: fist → pause media' : 'Gesture: open palm → play media');
      mediaPoseFired = true; lastMediaAt = now;
    }
  }
  function closeKeyboard() {
    if (keyboardOpen) send('KEYBOARD',{open:false});
    keyboardOpen = false; tenSince = 0; lostTenSince = 0;
  }
  function processHands(hands, now) {
    drawHands(hands);
    const countHands = hands.length;
    if (!countHands) stateHistory = [];
    const allStates = stabilizeFingerStates(hands.map(h => fingerState(h.landmarks)));
    const totalExtended = allStates.reduce((n, f) => n + f.filter(Boolean).length, 0);
    previewStatus.textContent = countHands ? `${countHands} hand(s) detected · ${totalExtended} fingers up` : 'No hand detected';
    let gestureLabel = 'none';
    if (countHands === 2 && allStates.every(f => f.every(Boolean))) gestureLabel = '10 fingers / keyboard';
    else if (countHands === 1) gestureLabel = HFPGestureCore.classifyPose(allStates[0], distance(hands[0].landmarks[4],hands[0].landmarks[8]) < 0.050);
    $('gestureStatus').textContent = `Gesture: ${gestureLabel.replaceAll('-', ' ')}`;

    const ten = countHands === 2 && allStates.every(f => f.every(Boolean));
    if (ten) {
      lostTenSince = 0;
      if (!tenSince) tenSince = now;
      if (!keyboardOpen && now-tenSince > 400) {
        keyboardOpen = true;
        send('KEYBOARD',{open:true});
        log('Gesture: both hands open → on-screen keyboard');
      }
    } else {
      tenSince = 0;
      if (keyboardOpen) {
        if (!lostTenSince) lostTenSince = now;
        if (now-lostTenSince > 260) {
          closeKeyboard();
          log('Keyboard closed: all ten fingers are no longer extended.');
        }
      }
    }

    if (!enabled || !countHands) {
      stableMediaPose('', now);
      twoTrack = null; prevPinch = false; prevPinkyPose = false;
      if (!countHands && keyboardOpen && !ten) closeKeyboard();
      return;
    }

    // Media commands intentionally only use one hand, to avoid clashes with the keyboard pose.
    const primary = hands[0].landmarks;
    const f = allStates[0];
    const fourFingerCount = f.slice(1).filter(Boolean).length;
    let mediaKey = '';
    if (countHands === 1 && fourFingerCount === 0) mediaKey = 'fist';
    else if (countHands === 1 && fourFingerCount === 4) mediaKey = 'palm';
    stableMediaPose(mediaKey, now);

    const pointerPose = f[1] && !f[2] && !f[3] && !f[4];
    if (countHands === 1 && pointerPose) setPointer(primary);

    const pinch = distance(primary[4],primary[8]) < 0.050;
    if (countHands === 1 && pinch && !prevPinch && now-lastClickAt > 650) {
      send('CLICK'); log('Gesture: thumb-index pinch → click'); lastClickAt = now;
    }
    prevPinch = pinch;

    // Pinky-click pose is deliberately gated to 3 other raised fingers so normal pointer motion
    // (index finger up with pinky naturally folded) doesn't accidentally click.
    const pinkyPose = f[1] && f[2] && f[3] && !f[4];
    if (countHands === 1 && pinkyPose && !prevPinkyPose && now-lastClickAt > 650) {
      send('CLICK'); log('Gesture: three fingers up + pinky folded → click'); lastClickAt = now;
    }
    prevPinkyPose = pinkyPose;

    const twoFingers = f[1] && f[2] && !f[3] && !f[4] && countHands === 1;
    if (!twoFingers) { twoTrack = null; return; }
    const center = {x:(primary[0].x+primary[9].x)/2, y:(primary[0].y+primary[9].y)/2};
    if (!twoTrack) { twoTrack = {start:center,last:center,mode:null}; return; }
    const dx = center.x - twoTrack.start.x, dy = center.y - twoTrack.start.y;
    if (!twoTrack.mode && (Math.abs(dx) > .022 || Math.abs(dy) > .022)) {
      twoTrack.mode = Math.abs(dx) > Math.abs(dy)*1.25 ? 'horizontal' : Math.abs(dy) > Math.abs(dx)*1.1 ? 'vertical' : null;
    }
    if (twoTrack.mode === 'horizontal' && Math.abs(dx) > .115 && now-lastTabAt > 1000) {
      const direction = dx < 0 ? 'next' : 'prev';
      send('TAB',{direction});
      log(direction === 'next' ? 'Gesture: horizontal swipe → next tab' : 'Gesture: horizontal swipe → previous tab');
      lastTabAt = now;
      twoTrack = {start:center,last:center,mode:null};
    } else if (twoTrack.mode === 'vertical') {
      const delta = center.y - twoTrack.last.y;
      if (Math.abs(delta) > .0014) {
        const amount = Math.round(Math.max(-125,Math.min(125,delta*1700*(Number($('scroll').value)/5))));
        if (amount) send('SCROLL',{amount});
      }
      twoTrack.last = center;
    } else {
      twoTrack.last = center;
    }
  }

  function onVisionMessage(event) {
    if (event.source !== visionFrame.contentWindow) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'ENGINE_STATUS') {
      if (msg.state === 'ready') {
        engineReady = true; engineFailed = false;
        setStatus('Online engine ready');
        renderCameraStatus();
        log((msg.message || 'Hand-tracking engine ready.') + ' Camera frames remain inside this browser.');
      } else if (msg.state === 'error') {
        engineFailed = true; engineReady = false;
        setStatus('Engine error','error'); renderCameraStatus();
        log(msg.message + '\nCheck your internet connection or whether Edge/network filtering blocks jsdelivr or Google Storage.');
      } else {
        setStatus(msg.message || 'Loading online engine…','loading');
        renderCameraStatus();
      }
      return;
    }
    if (msg.type === 'FRAME_RESULT') {
      if (msg.requestId !== requestId) return;
      framePending = false;
      if (msg.error) {
        if (Date.now()-lastDebugAt>2500) { log('Vision processing error: '+msg.error); lastDebugAt=Date.now(); }
        return;
      }
      if (msg.skipped) return;
      const now = Date.now();
      const gap = lastFrameAt ? now-lastFrameAt : 0;
      lastFrameAt = now;
      if (gap > 0) $('fps').textContent = `Inference ~${Math.round(1000/gap)} FPS · no upload`;
      processHands(msg.hands || [], now);
      if (msg.hands?.length) {
        setStatus('Tracking hands'); cameraStateText = `${msg.hands.length} hand(s) detected`; cameraErrorMessage = ''; renderCameraStatus();
      } else {
        setStatus('Camera active'); cameraStateText = 'Camera active — no hand detected'; cameraErrorMessage = ''; renderCameraStatus();
      }
    }
  }
  window.addEventListener('message', onVisionMessage);
  window.setTimeout(() => {
    if (!engineReady && !engineFailed) {
      setStatus('Still loading engine…','loading');
      renderCameraStatus();
      log('Waiting for the online MediaPipe runtime and hand model. If it remains here, a firewall, DNS filter or network policy may be blocking the required hosts.');
    }
  }, 18000);

  async function camera() {
    if (cameraStarting) return;
    cameraStarting = true;
    cameraErrorMessage = '';
    cameraStateText = 'Requesting camera permission…';
    renderCameraStatus();
    log('Requesting camera access from this extension side panel. Allow camera access if Edge prompts you.');
    let timedOut = false;
    let timeoutId = null;
    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw new Error('This Edge context does not expose camera access. Open the panel in current Microsoft Edge and check browser policy settings.');
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      cameraActive = false;
      const request = navigator.mediaDevices.getUserMedia({
        video:{facingMode:'user',width:{ideal:480},height:{ideal:360},frameRate:{ideal:15,max:20}},
        audio:false
      }).then(newStream => {
        if (timedOut) {
          newStream.getTracks().forEach(track => track.stop());
          throw new Error('Camera permission request completed after the 12-second timeout. Click Start / restart camera and allow access.');
        }
        return newStream;
      });
      stream = await Promise.race([
        request,
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => {
            timedOut = true;
            reject(new Error('Camera request timed out after 12 seconds. Click Start again; allow camera access for this extension in Edge settings and ensure no other app is holding the camera exclusively.'));
          }, 12000);
        })
      ]);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      video.srcObject = stream;
      await video.play();
      frameCanvas.width = 320; frameCanvas.height = 240;
      canvas.width = 320; canvas.height = 240;
      cameraActive = true;
      cameraStateText = 'Camera active — show a hand';
      renderCameraStatus();
      log('Camera active. Keep your hand inside the preview, palm facing the camera, in good lighting.');
      pump();
    } catch (error) {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      cameraActive = false;
      stream?.getTracks().forEach(track => track.stop());
      stream = null;
      const name = error?.name || 'Error';
      let guidance = error?.message || String(error);
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        guidance = 'Camera permission was denied or blocked. Allow camera access for Hands-Free Edge in Edge permissions, then click Start again. (' + guidance + ')';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        guidance = 'No available camera was found. Connect/enable a webcam, then click Start again. (' + guidance + ')';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        guidance = 'The camera exists but could not be opened. Close other apps using it and retry. (' + guidance + ')';
      }
      cameraErrorMessage = 'Camera failed: ' + guidance;
      cameraStateText = 'Camera error — see log';
      renderCameraStatus();
      log('Camera error [' + name + ']: ' + guidance + '\n\nTry: 1) click Start / restart camera; 2) allow camera permissions for this extension in Edge; 3) close Teams/Zoom/Camera app if it is using the webcam.');
    } finally {
      cameraStarting = false;
    }
  }

  async function pump() {
    if (!cameraActive) return;
    try {
      const now = performance.now();
      if (enabled && engineReady && !framePending && video.readyState >= 2 && now-lastSentAt >= 75) {
        lastSentAt = now;
        frameCtx.drawImage(video,0,0,frameCanvas.width,frameCanvas.height);
        framePending = true;
        requestId++;
        const bitmap = await createImageBitmap(frameCanvas);
        visionFrame.contentWindow.postMessage({type:'FRAME', requestId, bitmap}, '*', [bitmap]);
      }
    } catch (error) {
      framePending = false;
      if (Date.now()-lastDebugAt>2500) { log('Could not pass a camera frame to the vision engine: '+(error?.message||String(error))); lastDebugAt=Date.now(); }
    }
    window.setTimeout(pump, 30);
  }

  $('start').addEventListener('click', () => { camera(); });
  $('pause').addEventListener('click', () => {
    enabled = !enabled;
    $('pause').textContent = enabled ? 'Disable gestures' : 'Enable gestures';
    if (!enabled) {
      send('HIDE'); send('KEYBOARD',{open:false}); keyboardOpen=false;
      twoTrack=null; prevPinch=false; prevPinkyPose=false; stableMediaPose('',Date.now());
      log('Gestures disabled. Camera remains active; no gesture frames are sent to the engine.');
      setStatus('Gestures disabled');
    } else {
      log('Gestures enabled. Gesture state appears beneath the preview; page connection appears in the target badge.');
      setStatus('Gestures enabled');
    }
  });
  $('pointer').addEventListener('change', () => {
    if (!$('pointer').checked) send('HIDE');
  });
  chrome.runtime.sendMessage({type:'HFP4',command:'CHECK_TARGET'}).then(result => {
    if (result?.url) {
      targetHost = result.host || 'current webpage';
      try { targetHost = result.host || new URL(result.url).hostname || 'current webpage'; } catch { targetHost = result.host || 'current webpage'; }
      $('targetStatus').textContent = result.ok ? `Connected: ${targetHost}` : (result.error || `Target: ${targetHost}`);
      if (!result.ok) log(result.error || 'Could not connect to target webpage. Open a normal HTTPS page and reload it.');
    } else {
      $('targetStatus').textContent = result?.error || 'No target webpage';
    }
  }).catch(error => {
    $('targetStatus').textContent = 'Connection check failed';
    log('Could not check the target webpage: ' + (error?.message || String(error)));
  });
  window.addEventListener('beforeunload', () => {
    cameraActive = false;
    stream?.getTracks().forEach(track => track.stop());
    send('HIDE'); send('KEYBOARD',{open:false});
  });
  // Start only after a direct click so camera permission prompts are user-initiated and the error is visible.
  renderCameraStatus();
})();
