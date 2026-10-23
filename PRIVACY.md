# Privacy summary — Hands-Free Edge Controller 4.1.0

- Camera use begins after the user presses **Start / restart camera**. Moving into compact mode or returning from it may restart the camera automatically because the user initiated that transition and already enabled camera access. Audio capture is not requested.
- Camera frames are processed in the browser by MediaPipe Tasks Vision inside a sandboxed extension page. This extension does not send those frames to its own server or to a cloud inference endpoint.
- The vision JavaScript/WASM runtime and hand model are fetched from jsDelivr and Google Storage. The runtime is pinned to version 0.10.14.
- The MediaPipe Tasks package documentation states that performance and utilization metrics may be sent to Google. This should be disclosed to end users; consult the current [official MediaPipe Tasks privacy notice](https://developers.google.com/edge/mediapipe/solutions/tasks#mediapipe_tasks_privacy_notice) before any commercial distribution.
- Extension local storage remembers the selected target tab/window IDs. A temporary local-storage flag coordinates the compact-window/side-panel transition and camera restart; it is removed when the controller page unloads during that transition. This is used to route gestures to the intended webpage.
- The extension requests tab, storage, side-panel, script-injection and broad HTTP/HTTPS page access. Page access is needed to display its overlay, synthesize events, scroll, and interact with eligible page elements. A commercial build should evaluate reducing this access or converting it to a clear, user-controlled optional permission flow.
- Page changes are performed by script-generated events; the extension does not move the operating-system mouse or control other desktop applications.

This is an implementation summary, not jurisdiction-specific legal advice or a complete substitute for a product privacy policy.
