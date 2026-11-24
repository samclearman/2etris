import { test } from 'node:test';
import assert = require('node:assert/strict');
import { createHarness, Player } from './harness';
import { globalCoordPositions } from '../src/game';

// At the left wall, a Z overhang traps a single cell. An opposing L
// landing underneath cuts the Z off from its side. Neither fills a row.
// Reversing the seed exchanges the two players' piece sequences.
for (const landing of [Player.Two, Player.One]) {
  for (const easyMode of [false, true]) {
    test(`natural lock retains the L (player ${landing}, easy=${easyMode})`, () => {
      const first = 1 - landing;
      const users = ['black', 'white'];
      const h = createHarness({ seed: landing === Player.Two ? 'q19' : '91q', easyMode });
      h.claim(100, users[0], Player.One);
      h.claim(200, users[1], Player.Two);
      h.replay([
        { user: users[first], keys: 'KeyX*2 ArrowLeft*5' },
        { user: users[landing], keys: 'ArrowLeft*3' },
      ], 400);

      const before = h.advance(16699).game;
      const piece = before.activeOminos[landing];
      assert.equal(piece.nextFall, 16700);
      const expected = before.grid.map(row => row.slice());
      for (const { x, y } of globalCoordPositions(piece, { dx: 0, dy: 0 })) expected[y][x] = landing;
      if (easyMode) {
        const y = (blackView: number) => first === Player.One ? blackView : expected.length - 1 - blackView;
        for (const [x, row] of [[0, 17], [1, 17], [1, 18], [2, 18]]) expected[y(row)][x] = landing;
      }

      // No drop input. Both clients' gravity ticks run through computeSession.
      const after = h.advance(16701).game;
      assert.equal(after.activeOminos[landing].id, piece.id + 1);
      assert.equal(after.lines, 0);
      assert.deepEqual(after.grid.map(row => row.join('')), expected.map(row => row.join('')));
    });
  }
}
