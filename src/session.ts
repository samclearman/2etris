import { Database, serverTimestamp, ref, onValue, push, set, get, update } from 'firebase/database';

import { processEvent, Player, newGame } from './game';
import { E, EventType, tickEvent, createEvent } from './events';
import { shortId } from './id';
import { confirmedEvents, previewInputs } from './input-log';

export enum SessionState {
  Claiming,
  Playing,
  Over,
}

function initialState() {
  return {
    state: SessionState.Claiming,
    claims: { [Player.One]: null, [Player.Two]: null },
    game: null, seed: null,
  };
}

export function newSession(id: string, me: string, db: Database, onError: (e: Error) => void) {
  let restarting = false;

  const eventsRef = ref(db, `sessions/${id}/events`);
  const pending = new Map<string, E>();
  let snapshot: Record<string, E> = {};
  const s = {
    ...initialState(),
    pending,
    now: () => Date.now() + s.firebase.timeOffset,
    fixedSeats: true,
    me,
    events: [] as E[],
    firebase: {
      lastEvent: null,
      timeOffset: 0,
      pushEvent: (e: E) => {
        const ref = push(eventsRef);
        // set() can synchronously fire onValue, so register the key first.
        pending.set(ref.key, e);
        set(ref, e).then(() => {
          pending.delete(ref.key);
          refresh(); // the authoritative value may equal the local estimate
        }, error => {
          pending.delete(ref.key);
          refresh();
          onError(error);
        });
      },
      serverTime: serverTimestamp,
    },
    async restart() {
      if (restarting) return;
      restarting = true;
      try {
        // The other player can join as soon as the redirect event is delivered.
        const nextId = await makeSession(me, db);
        createEvent({ t: EventType.NewSession, id: nextId }, s);
      } catch (error) { onError(error); }
    },
  };
  function refresh() {
    // Earlier rooms used push keys for manual seating and difficulty events.
    const hostSeat = snapshot['1'];
    s.fixedSeats = !!(snapshot['2'] || (hostSeat?.t === EventType.Claim && (!hostSeat.both || hostSeat.parent === '0')));
    s.events = confirmedEvents(snapshot, pending);
    s.firebase.lastEvent = s.events[s.events.length - 1]?._k ?? null;
  }
  onValue(eventsRef, data => {
    snapshot = data.val() ?? {};
    refresh();
  }, onError);
  onValue(ref(db, '.info/serverTimeOffset'), data => {
    s.firebase.timeOffset = data.val() ?? 0;
  });

  return s;
}

// Gravity ticks have no user; network actions carry the UID verified by RTDB.
function applyPlayerEvent(session, event) {
  if (session.state !== SessionState.Playing) return;
  if (event.user === '' || session.claims[event.player] === event.user) {
    processEvent(event, session.game);
  }
}

export function computeSession(session, end: number) {
  Object.assign(session, initialState());
  // Keep archived matches replayable with their original settings. New rooms
  // have fixed seats, standard clears, and no configurable starting level.
  let easyMode = !session.fixedSeats;
  let startingLevel = 1;
  const events = session.events;
  let i = 0;
  const nextEvent = function() {
    if (session.state !== SessionState.Playing) {
      return events [i++];
    }
    const game = session.game!;
    if (
      events[i] &&
      events[i].time < game.activeOminos[Player.One].nextFall &&
      events[i].time < game.activeOminos[Player.Two].nextFall
    ) {
      return events[i++];
    }
    const n =
      game.activeOminos[Player.One].nextFall <
      game.activeOminos[Player.Two].nextFall
        ? game.activeOminos[Player.One]
        : game.activeOminos[Player.Two];
    return tickEvent(n);
  };
  for (let next = nextEvent(); next && next.time < end; next = nextEvent()) {
    if (next.t === EventType.NewSession) {
      const u = new URL(window.location.href);
      u.searchParams.set('session', next.id);
      (window as Window).location = u.toString();
    }
    if (next.t === EventType.ToggleEasy || next.t === EventType.SetLevel) {
      if (!session.fixedSeats) {
        if (next.t === EventType.ToggleEasy) easyMode = next.val;
        else startingLevel = next.val;
      }
      continue;
    }
    if (next.t === EventType.Init || next.t === EventType.Claim) {
      if (session.state !== SessionState.Claiming) continue;
      if (next.t === EventType.Init) {
        session.seed = next.seed;
        if (session.fixedSeats) session.claims[Player.One] = next.user;
      } else if (session.fixedSeats) {
        if (next._k === '2' && next.user !== session.claims[Player.One]) {
          session.claims[Player.Two] = next.user;
        } else if (next._k === '1' && next.both) { // solo test room
          session.claims[Player.Two] = next.user;
        }
      } else {
        if (session.claims[next.player] && session.claims[next.player] !== next.user) continue;
        if (session.claims[1 - next.player] === next.user) session.claims[1 - next.player] = null;
        session.claims[next.player] = next.user;
        if (next.both) session.claims[1 - next.player] = next.user;
      }
      if (session.seed && session.claims[Player.One] && session.claims[Player.Two]) {
        session.game = newGame({ time: next.time + 1000, t: EventType.Init, seed: session.seed,
          user: session.me, easyMode, startingLevel }, !session.fixedSeats);
        session.state = SessionState.Playing;
      }
      continue;
    }

    applyPlayerEvent(session, next);
    if (session.game && session.game.over) session.state = SessionState.Over;
  }

  // Future confirmed actions wait for their place in the timeline. A pending
  // local input can move a piece on screen, but cannot settle it early.
  if (session.state === SessionState.Playing && session.pending?.size) {
    previewInputs(session.game, session.pending.values(), end);
  }

  return session;
}

// Input targeting and rendering have different jobs: a move immediately after
// Space belongs to the next piece, even while the screen awaits the lock ACK.
// Replay onto a disposable game so its provisional locks never reach the HUD.
export function pieceForInput(session, player: Player) {
  const end = session.now() + 1;
  const projected = computeSession({ ...session, pending: null }, end);
  if (projected.state !== SessionState.Playing) return null;
  for (const input of session.pending?.values() ?? []) {
    applyPlayerEvent(projected, { ...input, time: end });
    if (projected.game.over) return null;
  }
  return projected.game.activeOminos[player].id;
}

export class RoomError extends Error {}

export async function joinRoom(me: string, db: Database, id: string) {
  const members = ref(db, `sessions/${id}/members`);
  const seats = (await get(members)).val();
  if (!seats?.host) throw new RoomError('Room not found. Check the game code or create a new room.');
  if (seats.host === me || seats.guest === me) return;
  if (seats.guest) throw new RoomError('This room already has two players. Ask for a new game code.');
  // Rules let exactly one guest claim the empty seat, even on racing joins.
  // Commit membership and the timestamp that starts the match together.
  try {
    await update(ref(db, `sessions/${id}`), {
      'members/guest': me,
      'events/2': seatEvent(me, Player.Two),
    });
  } catch (error) {
    const guest = (await get(ref(db, `sessions/${id}/members/guest`))).val();
    if (guest === me) return; // another tab with the same anonymous identity joined first
    if (guest) throw new RoomError('This room already has two players. Ask for a new game code.');
    throw error;
  }
}

function seatEvent(user: string, player: Player) {
  return { t: EventType.Claim, player, user, time: serverTimestamp(), localTime: Date.now() };
}

export async function makeSession(me: string, db: Database, test = false): Promise<string> {
  const id = shortId();
  const fields = { time: serverTimestamp(), localTime: Date.now(), user: me };
  const initial: Record<string, unknown> = {
    'members/host': me,
    'events/0': { ...fields, t: EventType.Init, seed: Math.random().toString() },
    'events/1': { ...seatEvent(me, Player.One), parent: '0', ...(test ? { both: true } : {}) },
  };
  await update(ref(db, `sessions/${id}`), initial);
  return id;
}
