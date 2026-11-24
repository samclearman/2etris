import { test, describe } from "node:test";
import assert = require("node:assert/strict");
import { createHarness, snapshot, ScriptStep, SessionState, Player } from "./harness";
import { level } from "../src/game";
import { EventType } from "../src/events";

// Deterministic two-player replays. Every number below was captured by running
// the engine as it was before the re-skin (src/game.ts, src/events.ts,
// src/session.ts), by replaying the keystroke script through the real key
// mapping in src/render.ts. alice is Player One (black), bob is Player Two.

const MAIN_SEED = "2etris-regression-v1";
const CLAIM_P1 = 100;
const CLAIM_P2 = 200;
// The game starts at the second claim + 1000 ms (newGame time); first key at 3300.
const FIRST_KEY = 3300;

// 40 steps, starting level 1. Covers spawn, Rotate (KeyX), Move (ArrowLeft/Right),
// soft drop (ArrowDown prefix), Hold (KeyC prefix), hard drop (Space), gravity,
// and single-line clears for both players.
const MAIN_SCRIPT: ScriptStep[] = [
  {user: "alice",keys: "Space",wait: 1100 },
  {user: "bob",keys: "Space",wait: 0 },
  {user: "alice",keys: "ArrowLeft*3 Space",wait: 0 },
  {user: "bob",keys: "KeyC ArrowLeft*3 Space",wait: 0 },
  {user: "alice",keys: "ArrowRight*2 Space",wait: 0 },
  {user: "bob",keys: "ArrowDown KeyX*1 ArrowRight*2 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 ArrowLeft*1 Space",wait: 0 },
  {user: "bob",keys: "ArrowLeft*1 Space",wait: 0 },
  {user: "alice",keys: "KeyC ArrowRight*4 Space",wait: 0 },
  {user: "bob",keys: "KeyX*1 ArrowRight*4 Space",wait: 0 },
  {user: "alice",keys: "KeyX*2 ArrowRight*3 Space",wait: 0 },
  {user: "bob",keys: "ArrowRight*2 Space",wait: 0 },
  {user: "alice",keys: "ArrowDown KeyX*1 ArrowLeft*2 Space",wait: 0 },
  {user: "bob",keys: "KeyX*1 ArrowLeft*4 Space",wait: 0 },
  {user: "alice",keys: "ArrowLeft*4 Space",wait: 0 },
  {user: "bob",keys: "KeyX*2 ArrowLeft*1 Space",wait: 0 },
  {user: "alice",keys: "ArrowRight*2 Space",wait: 0 },
  {user: "bob",keys: "ArrowRight*1 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 ArrowRight*3 Space",wait: 0 },
  {user: "bob",keys: "KeyX*3 ArrowRight*5 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 ArrowRight*4 Space",wait: 0 },
  {user: "bob",keys: "ArrowLeft*1 Space",wait: 0 },
  {user: "alice",keys: "KeyX*2 Space",wait: 0 },
  {user: "bob",keys: "ArrowRight*4 Space",wait: 0 },
  {user: "alice",keys: "ArrowLeft*3 Space",wait: 0 },
  {user: "bob",keys: "KeyX*1 ArrowLeft*4 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 ArrowRight*1 Space",wait: 0 },
  {user: "bob",keys: "Space",wait: 0 },
  {user: "alice",keys: "ArrowLeft*1 Space",wait: 0 },
  {user: "bob",keys: "ArrowRight*2 Space",wait: 0 },
  {user: "alice",keys: "KeyX*3 ArrowRight*4 Space",wait: 0 },
  {user: "bob",keys: "KeyX*2 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 ArrowLeft*4 Space",wait: 0 },
  {user: "bob",keys: "ArrowRight*3 Space",wait: 0 },
  {user: "alice",keys: "ArrowRight*2 Space",wait: 0 },
  {user: "bob",keys: "ArrowLeft*3 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 Space",wait: 0 },
  {user: "bob",keys: "KeyX*1 ArrowRight*4 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 ArrowLeft*4 Space",wait: 0 },
  {user: "bob",keys: "Space",wait: 0 },
];

// Captured state at end time 9900 ms (after all keys and 500 ms of gravity).
const MAIN_EXPECTED_END = 9900;
const MAIN_EXPECTED = {
    "state": 1,
    "scores": [
      300,
      200
    ],
    "lines": 5,
    "level": 1,
    "hold": [
      5,
      4
    ],
    "active": [
      {
        "id": 21,
        "shape": 0,
        "rotation": 0,
        "x": 3,
        "y": 2,
        "held": false
      },
      {
        "id": 21,
        "shape": 0,
        "rotation": 0,
        "x": 3,
        "y": 2,
        "held": false
      }
    ],
    "over": false,
    "gridRows": [
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1011111111",
      "1011111111",
      "0011000011",
      "0000000001",
      "0010000000",
      "1000000000",
      "1111000011",
      "0111111101",
      "0111111111",
      "0111111011",
      "1110111111",
      "0101111111",
      "0101100010",
      "0000110010",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000"
    ]
  };

// 30 steps at starting level 3: single-line clears must score 100 * level.
const L3_SEED = "2etris-regression-v1";
const L3_SCRIPT: ScriptStep[] = [
  {user: "alice",keys: "Space",wait: 1100 },
  {user: "bob",keys: "Space",wait: 0 },
  {user: "alice",keys: "KeyC ArrowLeft*3 Space",wait: 0 },
  {user: "bob",keys: "KeyX*1 ArrowLeft*3 Space",wait: 0 },
  {user: "alice",keys: "ArrowDown ArrowRight*3 Space",wait: 0 },
  {user: "bob",keys: "ArrowRight*3 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 ArrowRight*3 Space",wait: 0 },
  {user: "bob",keys: "ArrowRight*4 Space",wait: 0 },
  {user: "alice",keys: "ArrowLeft*3 Space",wait: 0 },
  {user: "bob",keys: "ArrowLeft*2 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 ArrowRight*4 Space",wait: 0 },
  {user: "bob",keys: "KeyX*1 ArrowRight*4 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 Space",wait: 0 },
  {user: "bob",keys: "ArrowRight*1 Space",wait: 0 },
  {user: "alice",keys: "ArrowLeft*1 Space",wait: 0 },
  {user: "bob",keys: "KeyX*1 ArrowLeft*5 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 ArrowRight*2 Space",wait: 0 },
  {user: "bob",keys: "KeyX*3 ArrowRight*4 Space",wait: 0 },
  {user: "alice",keys: "ArrowLeft*3 Space",wait: 0 },
  {user: "bob",keys: "Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 ArrowRight*4 Space",wait: 0 },
  {user: "bob",keys: "KeyX*1 ArrowLeft*3 Space",wait: 0 },
  {user: "alice",keys: "ArrowRight*4 Space",wait: 0 },
  {user: "bob",keys: "KeyX*2 ArrowRight*4 Space",wait: 0 },
  {user: "alice",keys: "KeyX*2 ArrowLeft*3 Space",wait: 0 },
  {user: "bob",keys: "KeyX*1 ArrowLeft*2 Space",wait: 0 },
  {user: "alice",keys: "KeyX*1 Space",wait: 0 },
  {user: "bob",keys: "KeyX*1 ArrowRight*2 Space",wait: 0 },
  {user: "alice",keys: "ArrowRight*4 Space",wait: 0 },
  {user: "bob",keys: "Space",wait: 0 },
];

const L3_EXPECTED_END = 8725;
const L3_EXPECTED = {
    "state": 1,
    "scores": [
      300,
      300
    ],
    "lines": 2,
    "level": 3,
    "hold": [
      4,
      null
    ],
    "active": [
      {
        "id": 16,
        "shape": 4,
        "rotation": 0,
        "x": 3,
        "y": 2,
        "held": false
      },
      {
        "id": 15,
        "shape": 1,
        "rotation": 0,
        "x": 4,
        "y": 2,
        "held": false
      }
    ],
    "over": false,
    "gridRows": [
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111111111",
      "1111011001",
      "0001001000",
      "0010000000",
      "0000000010",
      "1001001110",
      "1111110110",
      "1111111110",
      "1111110111",
      "0010111100",
      "0001100100",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000",
      "0000000000"
    ]
  };

function start(seed: string, startingLevel: number) {
  const h = createHarness({ seed, startingLevel });
  h.claim(CLAIM_P1, "alice", Player.One);
  h.claim(CLAIM_P2, "bob", Player.Two);
  return h;
}

describe("two-player engine replay", () => {
  test("a fixed-seat room waits for its guest, then starts black vs white at level 1", () => {
    const h = createHarness({ seed: MAIN_SEED });
    h.session.fixedSeats = true;
    h.session.events = [
      { _k: '0', t: EventType.Init, user: 'creator', time: 10, seed: MAIN_SEED },
      { _k: '1', t: EventType.Claim, user: 'creator', player: Player.One, time: 10 },
      // Old clients' manual controls cannot change a fixed-seat room.
      { _k: 'old-choice', t: EventType.Claim, user: 'creator', player: Player.Two, time: 20 },
      { t: EventType.ToggleEasy, val: true, time: 21 },
      { t: EventType.SetLevel, val: 5, time: 22 },
      { _k: '2', t: EventType.Claim, user: 'guest', player: Player.Two, time: 2000 },
    ];
    assert.equal(h.advance(1999).state, SessionState.Claiming);
    assert.deepEqual(h.session.claims, { 0: 'creator', 1: null });
    for (const me of ['creator', 'guest']) {
      h.session.me = me;
      assert.equal(h.advance(2001).state, SessionState.Playing);
      assert.deepEqual(h.session.claims, { 0: 'creator', 1: 'guest' });
      assert.equal(h.session.game.easyMode, false);
      assert.equal(level(h.session.game), 1);
    }
  });

  test("legacy room replays its original manual seat choices", () => {
    const h = createHarness({ seed: MAIN_SEED });
    h.claim(CLAIM_P1, "alice", Player.One);
    h.advance(2000);
    assert.equal(h.session.state, SessionState.Claiming);
    assert.equal(h.session.game, null);
    h.claim(CLAIM_P2, "bob", Player.Two);
    h.advance(2000);
    assert.equal(h.session.state, SessionState.Playing);
    assert.ok(h.session.game);
  });

  test("gravity drops each spawned piece one row after 1000 ms with no input", () => {
    const h = start(MAIN_SEED, 1);
    h.advance(2199);
    const before = snapshot(h.session).active;
    h.advance(2300);
    const after = snapshot(h.session).active;
    assert.equal(before[0].y, 2);
    assert.equal(before[1].y, 2);
    assert.equal(after[0].y, 3);
    assert.equal(after[1].y, 3);
    assert.equal(after[0].shape, before[0].shape);
    assert.equal(after[0].x, before[0].x);
  });

  test("40-step two-player replay matches captured engine state", () => {
    const h = start(MAIN_SEED, 1);
    h.replay(MAIN_SCRIPT, FIRST_KEY);
    h.advance(MAIN_EXPECTED_END);
    assert.deepEqual(snapshot(h.session), MAIN_EXPECTED);
  });

  test("replay is deterministic across fresh harnesses", () => {
    const run = () => {
      const h = start(MAIN_SEED, 1);
      h.replay(MAIN_SCRIPT, FIRST_KEY);
      return snapshot(h.advance(MAIN_EXPECTED_END));
    };
    assert.deepEqual(run(), run());
  });

  test("starting level 3: 30-step replay scores single clears as 100 x level", () => {
    const h = start(L3_SEED, 3);
    h.replay(L3_SCRIPT, FIRST_KEY);
    h.advance(L3_EXPECTED_END);
    const s = snapshot(h.session);
    assert.deepEqual(s, L3_EXPECTED);
    assert.equal(s.scores[0] / 3, 100);
    assert.equal(s.scores[1] / 3, 100);
  });

  test("level is startingLevel + floor(lines / 10)", () => {
    const g = (startingLevel: number, lines: number) => level({ startingLevel, lines } as any);
    assert.equal(g(1, 0), 1);
    assert.equal(g(1, 9), 1);
    assert.equal(g(1, 10), 2);
    assert.equal(g(3, 25), 5);
  });
});
