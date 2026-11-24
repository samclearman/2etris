// Test harness for the two-player engine. It drives the real src/session.ts
// computeSession() and the real key mapping in src/controls.ts registerControls().
// No browser, DOM, Firebase, or network is used. Time is a fake clock owned by
// the harness, so every replay is deterministic.
import { computeSession, SessionState } from "../src/session";
import { EventType } from "../src/events";
import { Player, level as levelOf } from "../src/game";

import { registerControls } from "../src/controls";

export interface Stroke {
  at: number; // fake clock (ms)
  user: string;
  code: string; // KeyboardEvent.code
}

// A script step is one user's keystrokes. Keys inside a step are KEY_GAP ms
// apart. The next step starts STEP_GAP ms after the previous step's last key.
export const KEY_GAP = 25;
export const STEP_GAP = 50;
export interface ScriptStep {
  user: string;
  keys: string; // space separated KeyboardEvent.code values, "Code*n" repeats
  wait?: number; // idle ms before this step's first key
}

export function expandScript(steps: ScriptStep[], start: number): Stroke[] {
  const out: Stroke[] = [];
  let t = start;
  for (const step of steps) {
    t += step.wait ?? 0;
    for (const tok of step.keys.split(/\s+/).filter(Boolean)) {
      const m = /^([A-Za-z]+)(?:\*(\d+))?$/.exec(tok);
      if (!m) throw new Error(`bad key token: ${tok}`);
      const n = m[2] ? parseInt(m[2], 10) : 1;
      for (let i = 0; i < n; i++) {
        out.push({ at: t, user: step.user, code: m[1] });
        t += KEY_GAP;
      }
    }
    t += STEP_GAP - KEY_GAP;
  }
  return out;
}

export function createHarness(opts: { seed: string; startingLevel?: number; easyMode?: boolean }) {
  let now = 0;
  const listeners: Record<string, Function[]> = { keydown: [], keyup: [] };
  (globalThis as any).window = {
    location: { href: "http://localhost/game?session=test" },
    addEventListener(name: string, fn: Function) {
      (listeners[name] ??= []).push(fn);
    },
  };
  // The current controls.ts reads document (new-game buttons) and Element
  // (Space guard). Neither is needed for keyboard behaviour, so stub them.
  (globalThis as any).document = { querySelectorAll: () => [], activeElement: null };
  if (typeof (globalThis as any).Element === "undefined") {
    (globalThis as any).Element = class {};
  }
  const session: any = {
    me: "p1",
    now: () => now,
    events: [] as any[],
    firebase: {
      lastEvent: null,
      timeOffset: 0,
      pushEvent: (e: any) => {
        session.events.push(e);
      },
      serverTime: () => now,
    },
    seed: null,
  };
  registerControls(session);

  // The Init event that the UI's makeSession() would normally write to Firebase.
  session.events.push({ t: EventType.Init, time: 0, user: "p1", seed: opts.seed });

  // Room settings, like the seed and claims, are replayed from the room log.
  session.events.push({ t: EventType.ToggleEasy, time: 0, user: 'p1', val: opts.easyMode ?? false });
  session.events.push({ t: EventType.SetLevel, time: 0, user: 'p1', val: opts.startingLevel ?? 1 });

  function advance(t: number) {
    computeSession(session, t);
    return session;
  }

  function press(s: Stroke) {
    keydown(s.at, s.user, s.code);
    keyup(s.at, s.user, s.code);
  }

  function keydown(at: number, user: string, code: string, repeat = false) {
    now = at;
    session.me = user;
    advance(at);
    const e = { code, repeat, preventDefault() {} };
    for (const fn of listeners.keydown) fn(e);
  }

  function keyup(at: number, user: string, code: string) {
    now = at;
    session.me = user;
    advance(at);
    const e = { code, repeat: false, preventDefault() {} };
    for (const fn of listeners.keyup) fn(e);
  }

  // Seat assignment event written on room creation or join.
  function claim(at: number, user: string, player: Player) {
    session.events.push({ t: EventType.Claim, time: at, user, player, localTime: at });
  }

  function replay(steps: ScriptStep[], start: number) {
    for (const s of expandScript(steps, start)) press(s);
  }

  return { session, advance, press, keydown, keyup, claim, replay };
}

export function createFixedRoom(seed: string) {
  const h = createHarness({ seed });
  h.session.fixedSeats = true;
  h.session.events = [
    { _k: '0', t: EventType.Init, user: 'black', seed, time: 10 },
    { _k: '1', t: EventType.Claim, user: 'black', player: Player.One, time: 10 },
    { _k: '2', t: EventType.Claim, user: 'white', player: Player.Two, time: 20 },
  ];
  return h;
}

// Plain-data view of the engine state, for deepEqual against captured values.
export function snapshot(session: any) {
  const g = session.game;
  return {
    state: session.state,
    scores: [g.scores[Player.One], g.scores[Player.Two]],
    lines: g.lines,
    level: levelOf(g),
    hold: [g.hold[Player.One], g.hold[Player.Two]],
    active: [Player.One, Player.Two].map((p) => {
      const o = g.activeOminos[p];
      return { id: o.id, shape: o.shape, rotation: o.rotation, x: o.x, y: o.y, held: o.held };
    }),
    over: g.over,
    gridRows: g.grid.map((r: number[]) => r.join("")),
  };
}

export { SessionState, Player };
