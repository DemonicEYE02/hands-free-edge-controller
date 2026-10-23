// All remotely loaded vision code runs in this manifest-declared sandbox page,
// which has no chrome.* extension API access. Only image frames and hand landmarks
// are exchanged with the parent page; no camera frame is sent over the network.
const VERSION = '0.10.14';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const WASM_BASE = `${CDN_BASE}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
let landmarker = null;
let busy = false;
let lastTimestamp = 0;
const send = data => window.parent.postMessage(data, '*');

async function initialize() {
  send({type:'ENGINE_STATUS', state:'library', message:'Downloading online tracking engine…'});
  try {
    const {FilesetResolver, HandLandmarker} = await import(`${CDN_BASE}/vision_bundle.mjs`);
    send({type:'ENGINE_STATUS', state:'model', message:'Loading hand model into browser memory…'});
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const common = {
      runningMode:'VIDEO',
      numHands:2,
      minHandDetectionConfidence:0.55,
      minHandPresenceConfidence:0.5,
      minTrackingConfidence:0.5
    };
    // Prefer GPU to reduce CPU load when this Edge/GPU combination supports it.
    try {
      landmarker = await HandLandmarker.createFromOptions(vision, {
        ...common,
        baseOptions:{modelAssetPath:MODEL_URL, delegate:'GPU'}
      });
      send({type:'ENGINE_STATUS', state:'ready', message:'Online engine ready · GPU accelerated'});
    } catch (gpuError) {
      send({type:'ENGINE_STATUS', state:'cpu', message:'GPU unavailable; starting low-power CPU mode…'});
      landmarker = await HandLandmarker.createFromOptions(vision, {
        ...common,
        baseOptions:{modelAssetPath:MODEL_URL, delegate:'CPU'}
      });
      send({type:'ENGINE_STATUS', state:'ready', message:'Online engine ready · low-power CPU mode'});
    }
  } catch (error) {
    send({type:'ENGINE_STATUS', state:'error', message:`Online engine failed: ${error?.message || String(error)}`});
  }
}

window.addEventListener('message', event => {
  const data = event.data;
  if (!data || data.type !== 'FRAME') return;
  const bitmap = data.bitmap;
  if (!bitmap) return;
  if (!landmarker || busy) {
    bitmap.close?.();
    if (data.requestId) send({type:'FRAME_RESULT', requestId:data.requestId, error:!landmarker ? 'Tracker is not ready yet' : '', skipped:busy});
    return;
  }
  busy = true;
  try {
    const now = performance.now();
    lastTimestamp = Math.max(now, lastTimestamp + 1);
    const result = landmarker.detectForVideo(bitmap, lastTimestamp);
    const hands = (result.landmarks || []).map((landmarks, index) => ({
      landmarks: landmarks.map(p => ({x:p.x, y:p.y, z:p.z || 0})),
      handedness: result.handedness?.[index]?.[0]?.categoryName || 'Unknown'
    }));
    send({type:'FRAME_RESULT', requestId:data.requestId, hands});
  } catch (error) {
    send({type:'FRAME_RESULT', requestId:data.requestId, error:error?.message || String(error)});
  } finally {
    bitmap.close?.();
    busy = false;
  }
});

initialize();
