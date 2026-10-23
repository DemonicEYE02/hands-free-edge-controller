# Hands-Free Edge Controller 4.0.0

Browser-only gesture control for Microsoft Edge. The side panel captures camera frames after an explicit user click, runs hand-landmark inference in the browser, then sends versioned gesture commands to the selected webpage.

## Installation

1. Extract this folder somewhere stable; don't load the ZIP directly.
2. Open `edge://extensions` in Microsoft Edge.
3. Remove/disable earlier Hands-Free Edge Controller copies so the old and new panels do not compete.
4. Enable **Developer mode** and select **Load unpacked**. Choose this folder (the one containing `manifest.json`).
5. Open a normal `https://` or `http://` webpage, click the extension icon, then **Open control panel**.
6. Click **Start / restart camera** and allow camera access. The status below the preview shows the detected gesture; the target badge reports whether commands reach the webpage.
7. If you installed over an old extension and an existing page is not responding, reload that webpage once. Version 4 also attempts to inject/update its page script and retry automatically.

First start needs an internet connection to obtain the pinned MediaPipe Tasks Vision package, its WebAssembly runtime, and the hand model. No `setup.bat` is used. The browser may cache these downloads. Live inference still uses CPU/GPU resources; the low-power target is about 12–13 frames per second, not zero resource use.

## Gestures

| Gesture | Action | Notes |
|---|---|---|
| Index finger extended by itself | Move the red on-page pointer | The pointer is a page overlay, not the Windows system cursor. |
| Thumb and index fingertips pinch | Click/select at the on-page pointer | Point first, then pinch. Some sites ignore scripted clicks. |
| Fist held briefly | Pause accessible page audio/video | A webpage must expose audio/video elements to the top document. |
| Open palm held briefly | Play accessible page audio/video | Browser autoplay policy may require a manual Play click first. |
| Index + middle fingers, swipe horizontally | Switch tabs | Requires at least two regular webpage tabs in the target window. |
| Index + middle fingers, move vertically | Scroll page/scrollable region | The controller scrolls the region under the on-page pointer when possible. |
| Index + middle + ring extended, pinky folded | Click/select | Separate pose to reduce accidental clicks during pointer movement. |
| Both hands, all ten fingers extended | Open on-page keyboard | Fold any finger briefly to close it. Type into a focused editable field on the webpage. |

Keep the palm facing the camera, fingers separated, and lighting reasonably bright. Use **Disable gestures** to stop actions without turning off the camera. The on-page status labels now distinguish hand detection from pose classification and show page-routing errors instead of silently claiming an action succeeded.

## Scope and limitations

- Controls ordinary webpages, not the Windows desktop, other applications, operating-system menus, or the real hardware mouse pointer.
- The red pointer is drawn in the webpage and the extension dispatches script-generated events. These events are untrusted by the browser; websites can ignore them. Scripted mousemove events can support JavaScript hover handlers but do not produce a real hardware pointer or guaranteed CSS `:hover` state.
- Edge settings pages (`edge://`), the add-ons store, DevTools, protected browser surfaces, and some built-in PDF viewers cannot be controlled.
- Cross-origin embedded media can be inaccessible to the top-page content script. Browser autoplay policies can block play requests. Websites built around canvas/WebGL, anti-automation measures, or strict input validation may not respond to synthetic events.
- A normal HTTP/HTTPS webpage and permission to access it are required. Broad HTTP/HTTPS host access is currently declared so the controller can follow gestures between tabs. Local `file://` pages are not in scope. Review this permission carefully before distribution.

## Privacy and online components

Camera access begins only after the user clicks **Start / restart camera**. Frames are drawn in the extension side panel and transferred to a manifest-declared sandboxed iframe for local inference; this project does not upload camera frames to an inference server. The MediaPipe runtime and model are fetched from public HTTPS hosts (`cdn.jsdelivr.net` and `storage.googleapis.com`) and the runtime is pinned to `@mediapipe/tasks-vision@0.10.14`.

Important disclosure for a public release: the MediaPipe Tasks package's current documentation says its APIs send performance/utilization metrics to Google even though input media is processed on-device and isn't sent to Google. Read the [official MediaPipe Tasks privacy notice](https://developers.google.com/edge/mediapipe/solutions/tasks#mediapipe_tasks_privacy_notice) and disclose this appropriately in the product privacy policy. A network/firewall that blocks the asset hosts prevents the first-time engine setup.

## Legacy local cleanup

`localremover.bat` is for the *old v2.0/v2.1 extracted folder only*. It removes only the known MediaPipe runtime/WASM/model files that the previous `setup.bat` downloaded into that old folder, and removes those folders only if empty. It does not remove v4 files or change Windows/Edge settings. Do not point it at a different folder unless you have checked the paths it targets.

## Automated checks

With Node.js installed, run from this folder:

```bat
node tests\gesture-core.test.js
node tests\page-content.test.js
node tests\extension-routing.test.js
node tests\controller-flow.test.js
```

These test gesture math/pose labels and the background's target, injection-retry, command acknowledgement, and tab-switch paths with deterministic mocks. They are not a substitute for a physical-camera test or a Microsoft Edge release-browser test.
