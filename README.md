# Fast Messenger

A rebuilt, lightweight realtime messenger based on the uploaded Digital Pigeon app's Firebase project.

## Removed
- Letter / pigeon system
- Tracking / map
- Inbox / physical-distance delivery
- 3D pigeon model and related assets
- Flight telemetry and location logic

## Included
- Google authentication
- Realtime private 1-to-1 chat using the existing `messages` collection
- Friends / requests
- Online heartbeat and typing indicator
- Image sharing through the existing ImgBB upload flow
- Search, profile editing, chat list and mobile bottom navigation
- Existing Firebase project/config and collection namespace

## Run
Serve the folder from a web server (Firebase Hosting, GitHub Pages, Netlify, Vercel, or a local static server). Firebase Auth's Google provider and Firestore rules must allow the existing collections.
