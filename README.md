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




## Friend Request Permission Fix
- Added `firestore.rules` matching the app's `friendRequests` path and payload.
- Friend request creation requires the signed-in user's UID as `senderUid`, a different string `receiverUid`, and `status: "pending"`.
- Re-sending a previously rejected request is explicitly permitted for the original sender.
- IMPORTANT: deploy `firestore.rules` to the `pigeon-7a637` Firebase project. The client package alone cannot change Firebase Console security rules.
