import { Player, newGame } from './game';
import { processEvent, E, EventType, tickEvent, createEvent } from './events';
export enum SessionState {
  Claiming,
  Playing,
  Over,
}

const blankSession = {
  state: SessionState.Claiming,
  users: [] as string[],
  claims: {
    [Player.One]: null,
    [Player.Two]: null,
  },
  game: null
};

export function newSession(me) {
  return Object.assign({
    me,
  }, blankSession);
}

export function computeSession(session, events: E[], end: number) {
  Object.assign(session, blankSession);
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
    if (next.t === EventType.Init) {
      session.seed = next.seed;
      continue;
    }
    if (next.t === EventType.Claim) {
      if (session.claims[next.player] && session.claims[next.player] !== next.user) {
        continue;
      }
      if (session.claims[1 - next.player] === next.user) {
        session.claims[1 - next.player] = null;
      }
      session.claims[next.player] = next.user;
      if (next.both) {
        session.claims[1 - next.player] = next.user;
      }
      if (session.claims[Player.One] && session.claims[Player.Two]) {
        session.game = newGame({
          time: next.time + 1000,
          t: EventType.Init,
          seed: session.seed,
          user: session.me,
        })
        session.state = SessionState.Playing;
      }
      continue;
    }
    if (session.state === SessionState.Playing) processEvent(next, session.game);
    if (session.game && session.game.over) session.state = SessionState.Over;
  }

  // Jitter mitigation
  for(i--; i < events.length && events[i].time < end + 1000; i++) {
    if (events[i].time < end) {
      // we already processed this event
      continue;
    }
    if (session.state === SessionState.Playing) processEvent(events[i], session.game);
  }

  return session;
}

export function makeSession(me, db, callback) {
  const initialEvents: E[] = [
    createEvent({
      t: EventType.Init,
      seed: Math.random().toString(),
    }, { me })]
  const u = new URL(window.location.href);
  if (u.searchParams.has('test')) {
    initialEvents.push(createEvent({
      t: EventType.Claim,
      player: Player.One,
      both: true,
    }, { me }));
  }
  db.ref('sessions').push(initialEvents).then(ref => {
    console.log(ref.key);
    const l = window.location
    const u = new URL(window.location.href)
    u.searchParams.set('session', ref.key)
    history.pushState(u.toString(), u.toString(), u.toString())
    callback();
  });
}
