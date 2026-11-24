# 2etris

A two-player falling-block game on one shared field. Create a room and send a friend its link or eight-character code. The creator plays black. When a friend opens the link or enters the code, they join as white and the match starts automatically at level 1. Only completed lines clear; disconnected blocks stay on the board. Each player sees their own pieces falling downward.

## Run locally

```sh
npm ci
npm run build
npm run preview
```

Open **http://localhost:8000**. The existing multiplayer client connects to its configured Firebase Realtime Database. To play both sides on one computer, open the second player in a separate browser profile or private window; tabs normally share a player ID.

Use `npm start` for the original watch workflow (requires `fswatch` and `rsync`). Vercel runs `npm run build` and serves `dist` with clean URLs, including `/game`.

## Firebase setup

The web configuration in `src/firebase.ts` is public. No service-account key is needed by the browser. In Firebase project `etris-ffea8`:

1. **Authentication → Sign-in method → Add new provider → Anonymous → Enable → Save**.
2. Use the **Realtime Database** (not Firestore). Review its current Rules before replacing them. For this dedicated game database, publish `database.rules.json` in the Rules tab, or use `firebase deploy --only database --project etris-ffea8` from a signed-in Firebase CLI. Don't enable public test-mode access.

The room code lets a signed-in visitor claim the open guest slot. Only the host and guest can read the event log; existing events cannot be rewritten or deleted by clients. Reloading in the same browser profile restores the anonymous UID. The match remains client-simulated, not server-authoritative.

### Test without cloud access

Run `firebase emulators:start --only auth,database --project demo-2etris`. In another terminal, `node --test tests/firebase-rules.cjs` exercises the rules against localhost. To play against the emulators, run `FIREBASE_EMULATORS=1 npm run build && npm run preview`; rebuild without the flag to return to the hosted project.

## Controls

| Action | Keys |
| --- | --- |
| Move | Left / Right |
| Soft drop | Down |
| Hard drop | Space |
| Rotate left | Ctrl or Z |
| Rotate right | Up or X |
| Hold | Shift or C |

`npm test` runs the offline keyboard and deterministic two-player replay tests. The Faultline artwork and stylesheet are local assets; rendering uses the same game state as the multiplayer simulation.
