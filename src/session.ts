import { Player, newGame } from './game';
import { processEvent, E, EventType, tickEvent } from './events';
export enum SessionState {
  Claiming,
  Playing,
  Over,
}

export function newSession(me) {
  return {
    me,
    state: SessionState.Claiming,
    users: [] as string[],
    claims: {
      [Player.One]: null,
      [Player.Two]: null,
    },
    game: null,
  }
}

export function computeSession(session, events: E[], end: number) {
  let i = 0;
  const nextEvent = function() {
    if (session.state !== SessionState.Playing) {
      i++;
      return events [i - 1];
    }
    const game = session.game!;
    if (
      events[i] &&
      events[i].time < game.activeOminos[Player.One].nextFall &&
      events[i].time < game.activeOminos[Player.Two].nextFall
    ) {
      i++;
      return events[i - 1];
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
        })
        session.state = SessionState.Playing;
      }
      continue;
    }
    if (session.state === SessionState.Playing) processEvent(next, session.game);
    if (session.game.over) session.state = SessionState.Over;
  }
  return session;
}

export function makeSession(me, db, callback) {
  const initialEvents: E[] = [{
    time: Date.now(),
    t: EventType.Init,
    seed: Math.random().toString(),
  }]
  const u = new URL(window.location.href);
  if (u.searchParams.has('test')) {
    initialEvents.push({
      time: Date.now(),
      t: EventType.Claim,
      user: me,
      player: Player.One,
      both: true,
    });
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
