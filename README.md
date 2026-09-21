# Fast Messenger Pro v11 — Clean Stable Build

This build is based on the previous stable version and focuses on startup/offline stability and UI consistency.

Key fixes:
- Startup no longer flashes the login screen when a cached local session exists.
- Cached shell is shown immediately; Firebase Auth restores the real session in the background.
- Firestore offline persistence is enabled.
- Local cached profile, friends, groups, requests and messages are hydrated before realtime listeners update them.
- Stale DOM references to `chatMessages` / `chatView` were removed; the current chat DOM uses `messages` / `chatPanel`.
- Multiple attachment composer remains responsive.
- Groups remain available in navigation and chat list.
- Dark-mode text overrides remain applied.
- Support email: hkshahadot24@gmail.com
- Navigation + floating action button is not present.


## Agora Audio/Video Calling
- Added Agora Web SDK 4.24.0 for friend and group audio/video calls.
- Agora App ID configured: `addaf4af54e845beb818de869a7de813`.
- Calls use Firestore `calls` documents for incoming-call invitations and group membership targeting.
- The calling profile is optimized for constrained networks: Full-HD-capable 1920×1080 video at up to 30 FPS with adaptive network-quality monitoring; the browser/device may negotiate a lower effective quality on constrained networks, and network-quality feedback.
- If Agora App Certificate/token authentication is enabled in the Agora Console, a secure token backend is required. Do not put an App Certificate in this client-side file.
- Deploy the updated `firestore.rules` together with the app.

- Stability fixes: avoids a Firestore composite-index dependency for incoming calls, prevents overlapping calls, preserves preview microphone state when switching cameras, cleans up call listeners, and safely reinitializes Agora client state.


## Friend Request Permission Fix
- Added `firestore.rules` matching the app's `friendRequests` path and payload.
- Friend request creation requires the signed-in user's UID as `senderUid`, a different string `receiverUid`, and `status: "pending"`.
- Re-sending a previously rejected request is explicitly permitted for the original sender.
- IMPORTANT: deploy `firestore.rules` to the `pigeon-7a637` Firebase project. The client package alone cannot change Firebase Console security rules.
