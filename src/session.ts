import * as firebase from "firebase/app";

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

export function newSession(id, me) {
  let timeOffset = 0;

  const eventsRef = firebase.database().ref(`sessions/${id}`);
  const s = Object.assign({
    me,
    events: [] as E[],
    easyMode: true,
    firebase: {
      lastEvent: null,
      eventsRef,
      timeOffset: 0
    }
  }, blankSession);
  
  eventsRef.on('value', function (snapshot) {
    const v = snapshot.val();
    for (const k in v) {
      const e = v[k];
      e._k = k;
      if (v[e.parent]) {
        // Flicker fix
        e.time = Math.max(e.time, v[e.parent].time + 1);
      }
    }
    s.events = Object.values(v);
    s.events.sort((e1, e2) => e1.time - e2.time);
    const lastTen = []
    for (let i = s.events.length - 1; i >= 0 && lastTen.length < 10; i--) {
      if (s.events[i].user === me && s.events[i].localTime) {
        lastTen.push(s.events[i]);
      }
    }
    s.firebase.lastEvent = s.events.slice(-1)[0]._k;
    s.firebase.timeOffset = lastTen.length > 0 ? lastTen.map(e => e.time - e.localTime).reduce((x, y) => x + y) / lastTen.length: 0;
  })

  return s;
}

export function computeSession(session, end: number) {
  Object.assign(session, blankSession);
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
          easyMode: session.easyMode,
        })
        session.state = SessionState.Playing;
      }
      continue;
    }
    if (next.t === EventType.ToggleEasy) {
      session.easyMode = next.val;
      continue;
    }
    if (session.state === SessionState.Playing) processEvent(next, session.game);
    if (session.game && session.game.over) session.state = SessionState.Over;
  }

  // Jitter mitigation - note that this doesn't actually seem to work :(
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
  const initialEvents: any = [{
    time: firebase.database.ServerValue.TIMESTAMP,
    localTime: Date.now(),
    user: me,
    t: EventType.Init,
    seed: Math.random().toString(),
  }]
  const u = new URL(window.location.href);
  if (u.searchParams.has('test')) {
    initialEvents.push({
      time: firebase.database.ServerValue.TIMESTAMP,
      localTime: Date.now(),
      user: me,
      t: EventType.Claim,
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
