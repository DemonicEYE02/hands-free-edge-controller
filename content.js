/* HandWave Browser Controller v2 - Force Start / Clickable Fix */
(function () {
  'use strict';

  // Add visible START button immediately
  const btn = document.createElement('button');
  btn.id = 'hw-force-start';
  btn.innerText = '▶ START HANDWAVE';
  btn.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483647;background:#00cc44;color:#fff;border:none;padding:10px 16px;border-radius:20px;font-weight:bold;font-size:14px;cursor:pointer;box-shadow:0 4px 15px rgba(0,204,68,0.5);pointer-events:auto;';
  btn.onclick = () => {
    btn.style.display = 'none';
    startSystem();
  };
  document.body.appendChild(btn);

  function startSystem() {
    // Load scripts
    const scripts = [chrome.runtime.getURL('lib/camera_utils.js'), chrome.runtime.getURL('lib/hands.js')];
    let loaded = 0;
    function loadNext() {
      if (loaded >= scripts.length) { init(); return; }
      const s = document.createElement('script');
      s.src = scripts[loaded++];
      s.onload = loadNext;
      s.onerror = () => console.error('HandWave: script load fail', s.src);
      document.head.appendChild(s);
    }
    loadNext();
  }

  function init() {
    // Camera overlay (very visible)
    const vid = document.createElement('video');
    vid.id = 'hw-cam';
    vid.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483646;width:260px;height:195px;border:3px solid #00ff00;border-radius:12px;opacity:0.85;background:#000;pointer-events:none;box-shadow:0 0 20px rgba(0,255,0,0.6);';
    document.body.appendChild(vid);

    // Visual pointer (never blocks clicks)
    const pointer = document.createElement('div');
    pointer.id = 'hw-pointer';
    pointer.style.cssText = 'position:fixed;top:0;left:0;width:24px;height:24px;background:radial-gradient(circle,#00ff00,#006600);border:2px solid #fff;border-radius:50%;pointer-events:none;z-index:2147483645;transform:translate(-50%,-50%);box-shadow:0 0 12px #0f0;transition:top 70ms,left 70ms;';
    document.body.appendChild(pointer);

    // Status text
    const status = document.createElement('div');
    status.id = 'hw-status';
    status.innerText = 'HandWave: Starting camera...';
    status.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:2147483647;background:rgba(0,0,0,0.8);color:#0f0;padding:6px 12px;border-radius:8px;font-family:sans-serif;font-size:13px;border:1px solid #0f0;pointer-events:none;';
    document.body.appendChild(status);

    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } })
      .then(stream => {
        vid.srcObject = stream;
        vid.play().then(() => {
          status.innerText = 'HandWave: ACTIVE — show your hand';
          beginTracking(vid);
        }).catch(e => {
          status.innerText = 'HandWave: Play blocked (click START again)';
          console.error('HandWave play error', e);
        });
      })
      .catch(err => {
        status.innerText = 'HandWave: Camera denied — check permissions';
        console.error('HandWave camera error', err);
      });

    let keyboardOpen = false;
    let lastAction = Date.now();
    const cooldown = 700;
    let mx = window.innerWidth / 2, my = window.innerHeight / 2;

    function beginTracking(videoEl) {
      if (typeof Hands === 'undefined') { status.innerText = 'HandWave: Hands library missing'; return; }
      if (typeof Camera === 'undefined') { status.innerText = 'HandWave: Camera utils missing'; return; }

      const hands = new Hands({ locateFile: (file) => chrome.runtime.getURL('lib/' + file) });
      hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.65, minTrackingConfidence: 0.6 });
      hands.onResults(onResults);

      const cam = new Camera(videoEl, {
        onFrame: async () => { await hands.send({ image: videoEl }); },
        width: 640, height: 480
      });
      cam.start();
    }

    function countUp(landmarks) {
      let c = 0;
      const tips = [8, 12, 16, 20]; const pips = [6, 10, 14, 18];
      for (let i = 0; i < 4; i++) if (landmarks[tips[i]] && landmarks[pips[i]] && landmarks[tips[i]].y < landmarks[pips[i]].y) c++;
      if (landmarks[4] && landmarks[3] && landmarks[4].x > landmarks[3].x) c++;
      return c;
    }

    function onResults(results) {
      const now = Date.now();
      const statusEl = document.getElementById('hw-status');
      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        closeKeyboard();
        return;
      }
      const handsDetected = results.multiHandLandmarks.length;
      const landmarks = results.multiHandLandmarks[0];
      if (!landmarks) return;

      const fingersUp = countUp(landmarks);
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      const pinkyTip = landmarks[20];
      const wrist = landmarks[0];
      if (!indexTip || !thumbTip || !wrist) return;

      // HOVER: index finger moves pointer
      mx = indexTip.x * window.innerWidth;
      my = indexTip.y * window.innerHeight;
      const ptr = document.getElementById('hw-pointer');
      if (ptr) { ptr.style.top = my + 'px'; ptr.style.left = mx + 'px'; }

      // PINCH -> CLICK
      const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
      if (pinchDist < 0.07) {
        ptr.style.background = 'radial-gradient(circle,#ff0000,#880000)';
        setTimeout(() => {
          const el = document.elementFromPoint(mx, my);
          if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: mx, clientY: my }));
          ptr.style.background = 'radial-gradient(circle,#00ff00,#006600)';
        }, 60);
      }

      // PINKY -> hover + click when bent (close to palm)
      if (pinkyTip) {
        mx = pinkyTip.x * window.innerWidth;
        my = pinkyTip.y * window.innerHeight;
        const ptr2 = document.getElementById('hw-pointer');
        if (ptr2) { ptr2.style.top = my + 'px'; ptr2.style.left = mx + 'px'; }
        const palmDist = Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y);
        if (palmDist < 0.18) {
          ptr2.style.background = 'radial-gradient(circle,#ff0000,#880000)';
          setTimeout(() => {
            const el = document.elementFromPoint(mx, my);
            if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: mx, clientY: my }));
            ptr2.style.background = 'radial-gradient(circle,#00ff00,#006600)';
          }, 60);
        }
      }

      // GESTURE ACTIONS
      if (fingersUp >= 4) {
        if (now - lastAction > cooldown) { playPause(); lastAction = now; }
      } else if (fingersUp <= 1) {
        if (now - lastAction > cooldown) { playPause(); lastAction = now; }
      }

      // 2 fingers horizontal -> tab switch
      if (fingersUp === 2 && now - lastAction > cooldown) {
        if (landmarks[8] && landmarks[8].x < 0.42) chrome.runtime.sendMessage({ action: 'prevTab' });
        else chrome.runtime.sendMessage({ action: 'nextTab' });
        lastAction = now;
      }

      // 2 fingers vertical -> scroll
      if (fingersUp === 2 && landmarks[8] && landmarks[12]) {
        const dx = Math.abs(landmarks[8].x - landmarks[12].x);
        const dy = Math.abs(landmarks[8].y - landmarks[12].y);
        if (dx < 0.06 && dy > 0.06 && now - lastAction > cooldown) {
          window.scrollBy({ top: (landmarks[8].y < landmarks[12].y) ? -140 : 140, behavior: 'smooth' });
          lastAction = now;
        }
      }

      // 10 fingers (2 hands, ~5 each) -> open keyboard
      if (handsDetected >= 2) {
        const second = results.multiHandLandmarks[1];
        if (second && (countUp(landmarks) + countUp(second)) >= 9) {
          openKeyboard();
          return;
        }
      }
    }

    function playPause() {
      document.querySelectorAll('video').forEach(v => v.paused ? v.play() : v.pause());
      const ytBtn = document.querySelector('.ytp-play-button, .ytp-play-button-svg');
      if (ytBtn) ytBtn.click();
    }

    function openKeyboard() {
      if (document.getElementById('hw-keyboard-frame')) return;
      keyboardOpen = true;
      const f = document.createElement('iframe');
      f.id = 'hw-keyboard-frame';
      f.src = chrome.runtime.getURL('keyboard.html');
      f.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);width:880px;height:260px;border:2px solid #00ff00;border-radius:14px;background:#000;z-index:2147483644;box-shadow:0 0 40px rgba(0,255,0,0.35);pointer-events:auto;';
      document.body.appendChild(f);
    }
    function closeKeyboard() {
      keyboardOpen = false;
      const f = document.getElementById('hw-keyboard-frame');
      if (f) f.remove();
    }

    window.addEventListener('message', (e) => {
      if (e.source !== document.getElementById('hw-keyboard-frame')?.contentWindow) return;
      if (e.data && e.data.type === 'keyboard-type') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
          if (e.data.key === 'Backspace') active.value = (active.value || '').slice(0, -1);
          else if (e.data.key === 'Enter') active.value += '\n';
          else active.value += e.data.key;
          active.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });
  }
})();
