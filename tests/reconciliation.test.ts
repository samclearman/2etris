import { test } from 'node:test';
import assert = require('node:assert/strict');
import { E, EventType as T } from '../src/events';
import { processEvent, newGame, Shape, masks, globalCoordGhostPositions } from '../src/game';
import { confirmedEvents, previewInputs } from '../src/input-log';
import { createFixedRoom, createHarness, Player } from './harness';

// The two J pieces and the only mixed rows immediately before the two locks
// in the recorded level-5 match. No gravity tick fell between these inputs.
function contestedBoard() {
  const game = newGame({ t: T.Init, user: 'black', time: 0, seed: 'fixture', startingLevel: 5, easyMode: true });
  ['1111111100', '0001111000', '0010000000', '0100000000'].forEach((row, i) => {
    game.grid[17 + i] = Array.from(row, Number);
  });
  Object.assign(game.activeOminos[0], { id: 7, shape: Shape.J, rotation: 0, x: 3, y: 3, mask: masks[Shape.J] });
  Object.assign(game.activeOminos[1], { id: 4, shape: Shape.J, rotation: 3, x: 8, y: 5, mask: [[0,1,0],[0,1,0],[1,1,0]] });
  game.nextOminoId = { 0: 8, 1: 5 };
  return game;
}
const black: E = { t: T.HardDrop, user: 'black', player: 0, omino: 7, time: 100 };
const white: E = { t: T.HardDrop, user: 'white', player: 1, omino: 4, time: 137 };

test('the recorded 37 ms collision never presents the provisional 500-point clear', () => {
  const apply = (events: E[]) => {
    const g = contestedBoard();
    for (const e of events) processEvent(e, g);
    return g;
  };
  assert.equal(apply([white, black]).scores[1], 500, 'the local estimate used to show this result');
  const expected = apply([black, white]);
  assert.equal(expected.lines, 0);
  const pending = new Map([['w', white]]);
  const early = { ...white, time: 90 };
  for (const snapshot of [{ w: early }, { w: early, b: black }, { w: white, b: black }]) {
    const frame = apply(confirmedEvents(snapshot, pending));
    const board = frame.grid.map(row => row.slice());
    previewInputs(frame, pending.values(), 140);
    assert.deepEqual(frame.grid, board);
    assert.equal(frame.lines, 0);
    assert.equal(frame.scores[1], 0);
    assert.equal(frame.activeOminos[1].id, 4, 'preview is still the falling piece');
  }
  pending.delete('w'); // SDK has delivered the actual timestamp and acknowledged the write.
  for (const snapshot of [{ w: white, b: black }, { b: black, w: white }]) {
    const settled = apply(confirmedEvents(snapshot, pending));
    assert.deepEqual(settled.grid, expected.grid);
    assert.deepEqual(settled.scores, expected.scores);
    assert.equal(settled.activeOminos[1].id, 5);
  }
});

test('same-millisecond locks use the same key order on both clients', () => {
  const equal = { ...white, time: black.time };
  for (const snapshot of [{ w: equal, b: black }, { b: black, w: equal }]) {
    assert.deepEqual(confirmedEvents(snapshot, new Map()).map(e => e._k), ['b','w']);
  }
});

test('local movement and soft drop are responsive, but a pending soft drop cannot lock', () => {
  const g = contestedBoard(), o = g.activeOminos[0];
  const move: E = { t: T.Move, omino: o.id, player: 0, user: 'black', time: 0, direction: 1 };
  const down: E = { ...move, t: T.Fall };
  previewInputs(g, [move, down], 10);
  assert.equal(g.activeOminos[0].x, o.x + 1);
  assert.equal(g.activeOminos[0].y, o.y + 1);
  const atRest = g.activeOminos[0];
  const landing = globalCoordGhostPositions(g, atRest, { dx: 0, dy: 0 });
  previewInputs(g, Array.from({ length: 40 }, () => down), 20);
  assert.equal(g.activeOminos[0].id, o.id);
  assert.deepEqual(g.grid, contestedBoard().grid);
  assert.deepEqual(globalCoordGhostPositions(g, g.activeOminos[0], { dx: 0, dy: 0 }), landing);
});

test('a future confirmed drop waits for its timestamp instead of jumping ahead of gravity', () => {
  const h = createHarness({ seed: 'clock' });
  h.claim(10, 'black', Player.One); h.claim(20, 'white', Player.Two);
  h.session.events.push({ ...black, omino: 0, time: 1600 });
  assert.equal(h.advance(1200).game.activeOminos[0].id, 0);
  assert.equal(h.advance(1601).game.activeOminos[0].id, 1);
});

for (const player of [Player.One, Player.Two]) {
  test(`first hold and subsequent swaps both require a lock before another hold (player ${player})`, () => {
    const h = createFixedRoom('hold');
    const user = player === Player.One ? 'black' : 'white';
    const original = h.advance(100).game.activeOminos[player].shape;
    const key = (code: string, at: number) => {
      h.press({ code, at, user });
      const g = h.advance(at + 1).game, o = g.activeOminos[player];
      return [o.id, o.shape, g.hold[player], o.held];
    };
    const first = key('KeyC', 200);
    assert.equal(first[2], original);
    assert.equal(first[3], true);
    assert.deepEqual(key('ShiftLeft', 250), first);
    const locked = key('Space', 300);
    assert.equal(locked[3], false);
    const swap = key('ShiftLeft', 350);
    assert.deepEqual(swap, [Number(locked[0]) + 1, original, locked[1], true]);
    assert.deepEqual(key('KeyC', 400), swap);
  });
}

// The write stays pending across a render: its position may preview, but only
// the targeting simulation may advance the piece ID before acknowledgement.
test('fast inputs after an unacknowledged drop target the replacement piece', () => {
  const h = createFixedRoom('rapid-input');
  const pending = h.session.pending = new Map();
  h.session.firebase.pushEvent = e => pending.set(String(pending.size), e);
  h.press({ at: 100, user: 'black', code: 'Space' });
  const frame = h.advance(110).game;
  assert.equal(frame.activeOminos[0].id, 0);
  h.press({ at: 115, user: 'black', code: 'ArrowLeft' });
  h.press({ at: 116, user: 'black', code: 'KeyC' });
  h.press({ at: 117, user: 'black', code: 'ArrowRight' });
  assert.deepEqual([...pending.values()].map(e => e.omino), [0, 1, 1, 2]);
  h.session.events.push(...pending.values());
  pending.clear();
  assert.equal(h.advance(118).game.activeOminos[0].id, 2);
});

test('legacy history retains the two piece IDs consumed by the old empty-slot Hold', () => {
  const h = createHarness({ seed: 'old-room' });
  h.claim(10, 'black', Player.One); h.claim(20, 'white', Player.Two);
  const original = h.advance(30).game.activeOminos[0].shape;
  for (let id = 0; id < 2; id++) h.session.events.push({ t: T.Hold, time: 40 + id, user: 'black', player: 0, omino: id });
  const active = h.advance(50).game.activeOminos[0];
  assert.equal(active.id, 2);
  assert.equal(active.shape, original);
  assert.equal(active.held, true);
});
