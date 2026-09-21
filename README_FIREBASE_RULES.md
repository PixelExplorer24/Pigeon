# Firebase Rules — Fast Messenger Pro v14

This build uses **Cloud Firestore** for Friend Requests, Friends, Messages, Groups and Call signalling. It does **not** use Firebase Realtime Database for these features.

## Required deployment

1. Firebase Console → project `pigeon-7a637`
2. Firestore Database → Rules
3. Replace the existing rules with `firestore.rules`
4. Publish

The rules are designed for the current app paths under:

`artifacts/pigeon-7a637/public/data/...`

Supported operations include:

- Friend request create / resend after rejection
- Friend request accept / decline
- Two-sided friend records created atomically on acceptance
- Direct messages only between friends
- Group messages only for group members
- Message deletion by the sender or recipient in a direct chat
- Audio/video call signalling between friends
- Group call signalling for group members
- User/profile ownership checks
- Group membership checks

Important: the browser app still needs a valid Agora configuration for actual audio/video media. Firestore rules only authorize the call signalling documents; they do not provide Agora media service or tokens.
