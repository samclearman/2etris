import { db, playerId } from './firebase';
import { RoomError, SessionState, joinRoom, newSession, makeSession, computeSession } from './session';
import { Cabinet } from './render';
import { registerControls } from './controls';
import { prettyEvents } from './events';

let failed = false;
function showError(error: Error & { code?: string }) {
  failed = true;
  const code = error.code?.toLowerCase() ?? '';
  let message = 'Could not connect to this room. Check your connection and try again.';
  if (['auth/operation-not-allowed', 'auth/configuration-not-found', 'auth/admin-restricted-operation'].includes(code)) {
    message = 'Anonymous sign-in is not enabled for this game. Enable the Anonymous provider in Firebase Authentication and try again.';
  } else if (/permission.denied/i.test(`${code} ${error.message}`)) {
    message = 'The database denied access. Check the room code and that the game’s database rules have been published.';
  } else if (error instanceof RoomError) {
    message = error.message;
  }
  document.querySelectorAll<HTMLElement>('main > section').forEach(s => { s.hidden = s.id !== 'room-error'; });
  document.getElementById('room-error-message').textContent = message;
}

async function start() {
  const url = new URL(location.href);
  let id = url.searchParams.get('session');
  if (id !== null && !/^[a-z0-9]{8}$/.test(id)) throw new RoomError('Use the eight-character room code from your friend.');
  const me = await playerId();
  if (id === null) {
    id = await makeSession(me, db, url.searchParams.has('test'));
    url.searchParams.set('session', id);
    history.replaceState(null, '', url);
  } else {
    await joinRoom(me, db, id);
  }

  const session = newSession(id, me, db, showError);
  const cabinet = new Cabinet(id);
  registerControls(session);
  // @ts-ignore Optional local debugging interface.
  if (self.DEBUG_SESSION) Object.assign(self, { DEBUG_SESSION: session, prettyEvents });
  const loop = () => {
    if (failed) return;
    // @ts-ignore Optional replay clock.
    const t = self.DEBUG_TIME || session.now();
    computeSession(session, t);
    if (session.seed && !session.fixedSeats && session.state === SessionState.Claiming) {
      showError(new RoomError('This unfinished room used manual seat selection. Create a new game and share its link.'));
      return;
    }
    cabinet.draw(session);
    setTimeout(loop, 10);
  };
  loop();
}

start().catch(showError);
