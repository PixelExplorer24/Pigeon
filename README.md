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
