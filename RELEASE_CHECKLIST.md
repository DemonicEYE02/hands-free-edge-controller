# Version 4.0.0 — release-candidate verification

## Completed in this workspace

- [x] Parsed `manifest.json` as valid JSON.
- [x] Checked JavaScript syntax for all shipped JavaScript files with `node --check`.
- [x] Gesture-core unit tests pass (13 assertions): index pointer, two fingers, pinky-click pose, palm/fist labels, pinch label, thumb extension, and pointer coordinate bounds.
- [x] Page-action tests pass (19 assertions): pointer overlay, click, scroll, media, virtual keyboard and hide behavior.
- [x] Controller flow tests pass (4 assertions): simulated frames produce MOVE and CLICK, and the recognized gesture appears in the panel.
- [x] Background routing tests pass (10 assertions): target check, injection fallback, versioned message channel, action acknowledgement/error, and tab switching.
- [x] Versioned page message channel (`HFP4`) prevents old v3 content-script listeners from consuming v4 gestures.
- [x] Target verification checks the page-script version; injection is retried when the receiver is missing or stale.
- [x] Updated README and privacy/third-party disclosures.
- [x] Added extension/action icons in 16, 32, 48 and 128 px sizes.

## Not verified here

- [ ] Full Microsoft Edge run with a physical webcam and live MediaPipe assets.
- [ ] End-to-end gesture-by-gesture tests on supported websites and different hand sizes, skin tones, lighting and camera angles.
- [ ] Windows-specific tests for Edge camera permission UI, side-panel lifetime, GPU delegate fallback, sleep/resume and multi-monitor setups.
- [ ] Microsoft Edge Add-ons/Chrome Web Store submission and policy review.
- [ ] Commercial privacy policy, customer support channel, final brand assets, screenshots, version/update operations and license/legal review.

**Release status: release candidate, not yet certified as ready for sale.** The automated checks do not prove physical-camera accuracy or guarantee that every website accepts scripted input. Complete the outstanding manual and store-review checks before charging customers or promising compatibility.
