# Hands-Free Edge Controller

> Browser-only, camera-driven gesture control for Microsoft Edge.  
> Zero cloud APIs. Zero subscription fees. 100 % local WASM inference.

![License](https://img.shields.io/badge/license-MIT-blue.svg)  
![Platform](https://img.shields.io/badge/platform-Edge%20Extension-green.svg)  
![Status](https://img.shields.io/badge/status-v4.0.0-stable)

**Control every tab and every website without touching your laptop.** This extension reads your hand movements through your webcam, runs a lightweight on-device AI model (`MediaPipe Hands`), and maps natural gestures to browser actions — scroll, click, play/pause, tab switching, and an on-screen keyboard.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Hand Tracking** | Real-time multi-hand landmark detection via `MediaPipe Tasks Vision` (local WASM). |
| **Universal** | Works on any HTTP/HTTPS site (`<all_urls>`). No per-site configuration needed. |
| **Pointer Hover** | One finger or pinky finger moves a visible on-page cursor. |
| **Click / Select** | Thumb + index pinch, or bent pinky close to palm. |
| **Video Control** | Fist → pause; open palm → play/unpause (works with YouTube and any `<video>`). |
| **Tab Switch** | Two fingers swipe left/right. |
| **Scroll** | Two fingers move vertically → smooth scroll. |
| **On-Screen Keyboard** | Both hands, all ten fingers → floating keyboard opens; release fingers → closes automatically. Types into any focused input. |
| **Force Start** | A visible "START HANDWAVE" button ensures you never miss activation. |
| **No API Keys** | Everything is bundled locally. No remote inference server, no account, no payment. |

---

## 📋 Supported Gestures

| Gesture | Action | Details |
|---|---|---|
| **Single / one finger** | Move pointer | Any extended finger controls the red on-page dot. |
| **Pinch (thumb + index)** | Click / select | Point first, then pinch. |
| **Pinky bent toward palm** | Click / select | Alternative click pose. |
| **Fist (≤1 finger)** | Pause video/audio | Short hold avoids accidental triggers. |
| **Open palm (≥4 fingers)** | Play / unpause | Works on any page video element. |
| **Two fingers horizontal** | Switch tabs | Left swipe → previous tab; right → next. |
| **Two fingers vertical** | Scroll page | Smooth scroll in either direction. |
| **10 fingers (both hands)** | Open keyboard | Auto-closes when fingers drop below 9. |

---

## 🚀 Installation (Edge)

1. **Download or clone** this repository.
2. Open Microsoft Edge → `edge://extensions/`
3. Enable **Developer mode** (toggle top-right).
4. Click **Load unpacked** and select the folder containing `manifest.json` (this repo root / `hands-free-edge-controller`).
5. Open any `https://` page, click the green **START HANDWAVE** button, and allow camera access.

> ⚠️ **First start** needs an internet connection to fetch the pinned `MediaPipe Tasks Vision` package (`v0.10.14`) and its WASM runtime from `cdn.jsdelivr.net`. After caching, the model runs entirely offline.

---

## 🏗 Architecture

```
Extension
├── manifest.json          # Manifest v3, content script, web_accessible_resources
├── background.js           # Tab-switch messaging service worker
├── content.js              # Main controller: camera, MediaPipe, gestures, keyboard
├── controller.css / .html / .js  # Side-panel UI and gesture display
├── keyboard.html / .css / .js    # Floating on-screen keyboard
├── lib/
│   ├── hands.js                    # MediaPipe Hand Landmark bundle
│   ├── camera_utils.js             # Camera feed wrapper
│   ├── hands_solution_*            # WASM / binary assets
│   └── hands.binarypb             # Graph definition
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── tests/
    ├── controller-flow.test.js
    ├── extension-routing.test.js
    ├── gesture-core.test.js
    └── page-content.test.js
```

---

## 🧪 Automated Tests

Requires Node.js (tests use deterministic mocks, no physical camera needed):

```bash
node tests/gesture-core.test.js
node tests/page-content.test.js
node tests/extension-routing.test.js
node tests/controller-flow.test.js
```

---

## 🔒 Privacy & Security

- **Camera access only starts after explicit user click** (`START HANDWAVE`).
- **Frames are processed locally** inside a sandboxed browser context (`OffscreenCanvas` + WASM). No frames are uploaded to any server.
- **MediaPipe privacy disclosure**: The `tasks-vision` runtime may collect anonymous performance/utilization metrics per its [official privacy notice](https://developers.google.com/mediapipe/solutions/tasks#mediapipe_tasks_privacy_notice). Input media never leaves the device.
- **Permissions**: `tabs`, `activeTab`, `<all_urls>` (required to inject pointer and keyboard into any site). Review carefully before public distribution.

---

## ⚠️ Scope & Limitations

- Controls ordinary webpages (`http` / `https`). Does **not** control the Windows desktop, OS menus, or other native apps.
- The red pointer is a **page overlay**, not the real Windows hardware cursor. Websites may ignore synthetic events.
- Edge protected surfaces (`edge://`, Add-ons store, DevTools, some PDF viewers) are inaccessible.
- Strict CSP or anti-automation sites may block scripted interactions.
- `file://` pages are out of scope.

---

## 📖 Legacy Notes

`localremover.bat` is provided for **old v2.0 / v2.1** installations only. It safely removes cached WASM/model folders from previous `setup.bat` runs without touching v4 files or browser settings.

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for full text.

---

## 🤝 Contributing

Pull requests are welcome. Please run the automated tests and include a brief gesture-test description for UI changes.

---

*Built with MediaPipe, powered by your hands.*
