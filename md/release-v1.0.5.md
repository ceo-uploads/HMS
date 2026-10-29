# Version 1.0.5

## Highlights

- Added local-first room and floor management with monthly balances, partial or full payment posting, persistent room-payment history, live summaries and A5 receipts.
- Expanded reporting to include room collections, current room balances, cabin occupancy and configurable 3D views for revenue, room billing and activity. Added zoom, animation and rotation controls.
- Added profile-photo choices for referring doctors, marketing agents and special referrers in the new diagnostic bill workflow.
- Added a durable, retryable, append-only Firebase Realtime Database upload queue for new diagnostic bills, cabin admissions, room receipts, appointments and new referral directory entries. Desktop records continue to load only from local JSON.
- Added a Google-only, read-only Android-first Firebase monitoring website with search, sorting, scanning input and live views.
- Updated documentation and the local database format to include `Database/others.json`.

## Firebase setup

Before enabling remote sync and monitoring, enable Anonymous and Google sign-in in all four Firebase Authentication projects and apply `firebase/database.rules.json` to each Realtime Database. Authorize the hosted site domain in every project. The read rule is limited to the verified Google account `privatehospitalkabirhat@gmail.com`; anonymous desktop clients can append validated records but cannot read them. Firebase Console configuration and the deployed rules must be verified before storing live patient records.

The desktop uses Firebase Realtime Database for writes only. Google Analytics Reporting API access is not configured.
