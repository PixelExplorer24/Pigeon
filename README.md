# Digital Pigeon — Mobile Messenger/Profile Update

This build keeps the existing Digital Pigeon features and adds:
- Rich editable user profile with stats and activity hub
- One-click Activity & Notifications view
- Smart permission/consent notices at the top of the main page
- Messenger chat-room list loaded on entry
- Full-screen mobile chat sublink experience
- ImgBB image sending inside direct Messenger chats
- Existing pigeon-letter ImgBB attachments, tracking, inbox and speed controls preserved

## Firebase / ImgBB
The project continues using the existing Firebase project and ImgBB upload flow already configured in the app. Firestore security rules must allow the existing user/message collections and the new `activities` collection for persistent activity history.


## v10 mobile content-safe update
- Adds bottom clearance so normal mobile content cannot be hidden behind fixed navigation.
- Fullscreen Messenger hides bottom navigation while a chat is open, keeping the composer visible.
- Map and telemetry are raised above the navigation safe area.


## v14 tracking behavior
- The Cine_Pigeon_fly.glb model is used as the live tracking pigeon.
- Flight position is always a direct sender-to-receiver line; no road routing is used.
- Tracking camera is locked to the pigeon, directly overhead (pitch 0).
- Sender/outgoing view keeps the flight direction at the top of the screen.
- Receiver/incoming view reverses the map bearing so the pigeon visually approaches the receiver.
