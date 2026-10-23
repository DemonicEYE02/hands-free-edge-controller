/* Hands-Free Edge Controller — deterministic gesture math (v4.0.0). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HFPGestureCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function distance(a, b) {
    return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
  }
  function straightness(mcp, pip, tip) {
    const ax = pip.x - mcp.x, ay = pip.y - mcp.y;
    const bx = tip.x - pip.x, by = tip.y - pip.y;
    const den = Math.hypot(ax, ay) * Math.hypot(bx, by);
    return den > 1e-6 ? (ax * bx + ay * by) / den : -1;
  }
  function fingerState(l) {
    if (!Array.isArray(l) || l.length < 21) return [false, false, false, false, false];
    const wrist = l[0];
    // A finger is extended when the tip is beyond its PIP joint relative to the wrist
    // and the MCP-PIP-tip chain is reasonably straight. This works better than testing Y
    // coordinates alone when hands are tilted or the camera is mounted at an angle.
    const finger = (mcp, pip, tip) => {
      const radial = distance(l[tip], wrist);
      const joint = distance(l[pip], wrist);
      return radial > joint * 1.075 && straightness(l[mcp], l[pip], l[tip]) > -0.05;
    };
    // The thumb crosses the palm in many poses, so use both radial extension and distance
    // from the index MCP instead of an up/down test.
    const thumb = distance(l[4], wrist) > distance(l[3], wrist) * 1.035 &&
      distance(l[4], l[5]) > distance(l[3], l[5]) * 1.045;
    return [thumb, finger(5, 6, 8), finger(9, 10, 12), finger(13, 14, 16), finger(17, 18, 20)];
  }
  function classifyPose(f, pinch = false) {
    if (pinch) return 'pinch';
    if (!Array.isArray(f) || f.length !== 5) return 'unknown';
    const raised = f.slice(1);
    if (raised.every(Boolean)) return 'open-palm';
    if (raised.every(v => !v)) return 'fist';
    if (f[1] && !f[2] && !f[3] && !f[4]) return 'pointer';
    if (f[1] && f[2] && !f[3] && !f[4]) return 'two-finger';
    if (f[1] && f[2] && f[3] && !f[4]) return 'pinky-click';
    return 'other';
  }
  function pointerFromIndex(indexTip, sensitivity = 5) {
    const gain = 0.76 + clamp(Number(sensitivity) || 5, 1, 10) * 0.048;
    return {
      x: clamp(0.5 + (0.5 - indexTip.x) * gain, 0, 1),
      y: clamp(0.5 + (indexTip.y - 0.5) * gain, 0, 1)
    };
  }
  return Object.freeze({ distance, fingerState, classifyPose, pointerFromIndex });
});
