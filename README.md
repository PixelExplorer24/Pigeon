# Fast Messenger Pro v3

This build is based on the latest friend-request-fixed v2 package.

Added:
- Premium glassmorphism bottom navigation
- Center floating New Chat FAB
- Filled/outline active navigation icons with animated dot
- Three-dot menu: Profile, Settings, Share App, Support/Feedback, Logout
- Google account profile presentation
- Settings page: Delete Account, Theme, Notifications, Privacy Policy, Clear Cache
- Dark/light mode persistence
- Notification preference + simple in-app notification sound
- Share App using Web Share API with clipboard fallback
- Privacy Policy starter page
- Reciprocal friend records when accepting requests
- Keeps ImgBB image sending and GoFile file sending
- Keeps the latest outgoing friend-request Pending fix

IMPORTANT:
1. Set SUPPORT_EMAIL in assets/js/app.js before publishing.
2. The Privacy Policy is a starter template and should be finalized with the real developer/company identity, retention policy, support email, and legal requirements.
3. Firebase rules should be configured securely for production.


## v4 Offline-first architecture

- IndexedDB local message cache
- PWA manifest + Service Worker app-shell caching
- Offline indicator and offline chat reading
- Timestamp-based delta sync for messages newer than the local last-sync timestamp
- 25-message lazy loading from IndexedDB when scrolling upward
- Pull-to-refresh gesture

### Important Firestore note
This static Firebase client implements timestamp-based delta sync with `createdAt > lastSyncTimestamp`. Firestore still evaluates the queries server-side; it is not a custom REST delta endpoint. For very large scale, a server-side sync endpoint/Cloud Function with per-user cursors and deletion tombstones would be the stronger architecture.

### Deployment note
Service Workers require HTTPS (or localhost). Opening index.html directly with `file://` will not provide PWA/offline Service Worker functionality.
