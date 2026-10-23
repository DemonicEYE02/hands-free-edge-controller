# Version 4.1.0 — release-candidate verification

## Completed in this workspace

- [x] Parsed `manifest.json` as valid JSON.
- [x] Checked JavaScript syntax for all shipped JavaScript files with `node --check`.
- [x] Gesture-core unit tests pass (18 assertions): index pointer, two fingers, pinky-click pose, palm/fist labels, pinch label, thumb extension, and pointer coordinate bounds.
- [x] Page-action tests pass (30 assertions): pointer overlay, click, page scroll, continuous scroll direction/start/stop, QWERTY keyboard rendering/positioning/typing and hide behavior.
- [x] Controller flow tests pass (9 assertions): simulated frames produce MOVE/CLICK, an upward two-finger move starts continuous scroll, the ten-finger pose opens the anchored keyboard, and panel controls are wired.
- [x] Background routing tests pass (12 assertions): stale-script injection after a silent no-response, versioned message channel, acknowledgement/error, tab switching and compact-window opening.
- [x] Versioned page message channel (`HFP41`) prevents old v3/v4 content-script listeners from consuming v4.1 gestures.
- [x] Target verification checks the page-script version; injection is retried when the receiver is missing, returns undefined, or belongs to a stale version.
- [x] Updated README and privacy/third-party disclosures.
- [x] Added a persistent, hand-positioned QWERTY keyboard with large keys, Caps/Shift/symbols/Backspace/Space/Tab/Enter/caret controls.
- [x] Added continuous two-finger scrolling with direction reversal and stop-on-pose-change/horizontal-swipe.
- [x] Added a compact separate controller window with close/reopen of Edge side panel.
- [x] Added extension/action icons in 16, 32, 48 and 128 px sizes.

## Not verified here

- [ ] Full Microsoft Edge run with a physical webcam and live MediaPipe assets.
- [ ] End-to-end gesture-by-gesture tests on supported websites and different hand sizes, skin tones, lighting and camera angles.
- [ ] Windows-specific tests for Edge camera permission UI, side-panel lifetime, GPU delegate fallback, sleep/resume and multi-monitor setups.
- [ ] Microsoft Edge Add-ons/Chrome Web Store submission and policy review.
- [ ] Commercial privacy policy, customer support channel, final brand assets, screenshots, version/update operations and license/legal review.

**Release status: release candidate, not yet certified as ready for sale.** The automated checks do not prove physical-camera accuracy or guarantee that every website accepts scripted input. Complete the outstanding manual and store-review checks before charging customers or promising compatibility.
