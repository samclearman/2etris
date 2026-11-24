import { test, describe } from "node:test";
import assert = require("node:assert/strict");
import { createHarness, Player } from "./harness";
import { EventType } from "../src/events";

// Real keydown/keyup dispatch through the current input hook. Each key must
// produce exactly one engine event for the pressing player, with the right
// type and direction. The test does not depend on any DOM layout.

function setup() {
  const h = createHarness({ seed: "keymap-test" });
  h.claim(100, "alice", Player.One);
  h.claim(200, "bob", Player.Two);
  h.advance(1300); // game is Playing at 1200
  return h;
}

const cases: { code: string; t: EventType; direction?: 1 | -1 }[] = [
  { code: "ArrowUp", t: EventType.Rotate, direction: 1 },
  { code: "KeyX", t: EventType.Rotate, direction: 1 },
  { code: "KeyZ", t: EventType.Rotate, direction: -1 },
  { code: "ControlLeft", t: EventType.Rotate, direction: -1 },
  { code: "ControlRight", t: EventType.Rotate, direction: -1 },
  { code: "ArrowLeft", t: EventType.Move, direction: -1 },
  { code: "ArrowRight", t: EventType.Move, direction: 1 },
  { code: "ArrowDown", t: EventType.Fall },
  { code: "KeyC", t: EventType.Hold },
  { code: "ShiftLeft", t: EventType.Hold },
  { code: "ShiftRight", t: EventType.Hold },
  { code: "Space", t: EventType.HardDrop },
];

describe("keyboard mapping", () => {
  for (const user of ["alice", "bob"]) {
    const player = user === "alice" ? Player.One : Player.Two;
    test(`each mapped key yields one event for ${user} (player ${player})`, () => {
      const h = setup();
      let at = 1400;
      for (const c of cases) {
        const before = h.session.events.length;
        h.keydown(at, user, c.code);
        h.keyup(at + 10, user, c.code);
        at += 100;
        // A key may be consumed by the state machine after the event is written
        // (e.g. a hard drop that spawns the next piece), so only the new event is checked.
        const added = h.session.events.slice(before);
        assert.equal(added.length, 1, `${c.code} should write exactly one event`);
        const e = added[0];
        assert.equal(e.t, c.t, `${c.code} event type`);
        assert.equal(e.user, user, `${c.code} user`);
        assert.equal(e.player, player, `${c.code} player`);
        if (c.direction !== undefined) assert.equal(e.direction, c.direction, `${c.code} direction`);
        h.advance(at); // keep the game in step, as the UI loop does
      }
    });
  }

  test("unmapped keys and auto-repeat keydowns write no events", () => {
    const h = setup();
    const before = h.session.events.length;
    h.keydown(1400, "alice", "KeyA");
    h.keyup(1410, "alice", "KeyA");
    h.keydown(1420, "alice", "ArrowLeft", true);
    h.keyup(1430, "alice", "ArrowLeft");
    assert.equal(h.session.events.length, before);
  });

  test("holding ArrowLeft repeats only until keyup", async () => {
    const h = setup();
    const before = h.session.events.length;
    h.keydown(1400, "alice", "ArrowLeft");
    h.keyup(1410, "alice", "ArrowLeft");
    assert.equal(h.session.events.length, before + 1, "one immediate move");
    // Real timers: DAS is 133 ms, so wait well past it. Nothing should repeat.
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(h.session.events.length, before + 1, "no auto-repeat after keyup");
  });
});
