import * as seedrandom from 'seedrandom';
import { EventType, Init, Spawn, Move, Rotate, Drop, Fall, HardDrop, Boost, Unboost } from './events';

const LOCK_DELAY = 500;
const gridWidth = 10;
export const gridHeight = 30;
export const gridBuffer = 4;
export const gridOuterHeight = gridHeight + 2 * gridBuffer;

export enum Player {
  One,
  Two
}

type Vector = { dx: number, dy: number };

type Direction = 1 | -1;

export enum Shape {
  I,
  O,
  J,
  L,
  T,
  S,
  Z
}

type Mask = number[][];

const masks = {
  [Shape.I]: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  // [Shape.O]: [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  [Shape.O]: [[1, 1], [1, 1]],
  [Shape.J]: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  [Shape.L]: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  [Shape.T]: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  [Shape.S]: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  [Shape.Z]: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
};

const spawnOffsets = {
  [Shape.I]: { x: 0, y: -2},
  [Shape.O]: { x: 0, y: -2},
  [Shape.J]: { x: 0, y: -2},
  [Shape.L]: { x: 0, y: -2},
  [Shape.T]: { x: 0, y: -2},
  [Shape.S]: { x: 0, y: -2},
  [Shape.Z]: { x: 0, y: -2},  
};

function spawnOffset(shape: Shape) {
  if (shape in spawnOffsets) {
    return spawnOffsets[shape];
  }
  return { x: 0, y: 0 };
}

function kicks(omino, direction) {
  if ([Shape.J, Shape.L, Shape.S, Shape.T, Shape.Z].includes(omino.shape)) {
    if (omino.rotation === 1) {
      return [
        { dx: 0, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: -1, dy: 1 },
        { dx: 0, dy: -2 },
        { dx: -1, dy: -2 }
      ];
    } else if (omino.rotation - direction === 1) {
      return [
        { dx: 0, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 1, dy: -1 },
        { dx: 0, dy: 2 },
        { dx: 1, dy: 2 }
      ];
    } else if (omino.rotation === 3) {
      return [
        { dx: 0, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: 1, dy: 1 },
        { dx: 0, dy: -2 },
        { dx: 1, dy: -2 }
      ];
    } else if ((omino.rotation - direction + 4) % 4 === 3) {
      return [
        { dx: 0, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: -1, dy: -1 },
        { dx: 0, dy: 2 },
        { dx: -1, dy: 2 }
      ];
    } else {
      throw "that shouldn't happen";
    }
  } else if (omino.shape === Shape.I) {
    if (
      (omino.rotation === 1 && direction === 1) ||
      (omino.rotation === 2 && direction === -1)
    ) {
      return [
        { dx: 0, dy: 0 },
        { dx: -2, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: -2, dy: -1 },
        { dx: 1, dy: 2 }
      ];
    } else if (
      (omino.rotation === 0 && direction === -1) ||
      (omino.rotation === 3 && direction === 1)
    ) {
      return [
        { dx: 0, dy: 0 },
        { dx: 2, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 2, dy: 1 },
        { dx: -1, dy: -2 }
      ];
    } else if (
      (omino.rotation === 2 && direction === 1) ||
      (omino.rotation === 3 && direction === -1)
    ) {
      return [
        { dx: 0, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 2, dy: 0 },
        { dx: -1, dy: 2 },
        { dx: 2, dy: -1 }
      ];
    } else if (
      (omino.rotation === 1 && direction === -1) ||
      (omino.rotation === 0 && direction === 1)
    ) {
      return [
        { dx: 0, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: -2, dy: 0 },
        { dx: 1, dy: -2 },
        { dx: -2, dy: 1 }
      ];
    } else {
      throw "that shouldn't happen";
    }
  } else {
    // its a O
    return [];
  }
}

interface Omino {
  id: number;
  shape: Shape;
  rotation: 0 | 1 | 2 | 3;
  mask: Mask;
  player: Player;
  x: number;
  y: number;
  nextFall: number;
  speed: number;
  boosted: boolean;
}

function copyMask(m: Mask) {
  return m.map(r => r.map(b => b));
}

function rotatedMask(mask: Mask, d: 1 | -1): Mask {
  const rotated = [];
  if (d === -1) {
    for (let i = 0; i < mask.length; i++) {
      rotated.push([]);
      for (let j = 0; j < mask.length; j++) {
        rotated[i][j] = mask[j][mask.length - 1 - i];
      }
    }
  } else {
    for (let i = 0; i < mask.length; i++) {
      rotated.push([]);
      for (let j = 0; j < mask.length; j++) {
        rotated[i][j] = mask[mask.length - 1 - j][i];
      }
    }
  }
  return rotated;
}

function playerMaskTransform(player: Player, mask: Mask): Mask {
  if (player === Player.Two) {
    const n = mask.length;
    const transformed = [];
    for (let i = 0; i < n; i++) {
      transformed.push([]);
      for (let j = 0; j < n; j++) {
        transformed[i][j] = mask[n - 1 - i][n - 1 - j];
      }
    }
    return transformed;
  }
  return copyMask(mask);
}

export function globalCoordPositions(omino: Omino, { dx, dy }: Vector) {
  const { mask, player } = omino;
  const positions = [];
  for (let i = 0; i < mask.length; i++) {
    for (let j = 0; j < mask[i].length; j++) {
      if (mask[i][j]) {
        const x = j + omino.x + dx;
        let y = i + omino.y + dy;
        if (player === Player.Two) {
          y = gridOuterHeight - 1 - y;
        }
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

export function globalCoordGhostPositions(game, omino: Omino, { dx, dy }: Vector) {
  const positions = [];

  const o = copyOmino(omino);
  while (!checkCollision(game, o, { dx, dy })) {
    dy += 1;
  }
  dy -= 1;
  const { mask, player } = o;
  for (let i = 0; i < mask.length; i++) {
    for (let j = 0; j < mask[i].length; j++) {
      if (mask[i][j]) {
        const x = j + omino.x + dx;
        let y = i + omino.y + dy;
        if (player === Player.Two) {
          y = gridOuterHeight - 1 - y;
        }
        positions.push({ x, y });
      }
    }
  }
  return positions;
}


function copyOmino(o: Omino): Omino {
  return {
    id: o.id,
    shape: o.shape,
    player: o.player,
    rotation: o.rotation,
    mask: copyMask(o.mask),
    x: o.x,
    y: o.y,
    nextFall: o.nextFall,
    speed: o.speed,
    boosted: o.boosted,
  };
}

function newOmino(
  game,
  player: Player,
  createdAt: number,
) {
  const shape = game.bag[player].pop();
  if (game.bag[player].length < 7) {
    game.bag[player] = randomBag(game.rng[player]).concat(game.bag[player]);
  }
  let v = speed(game);
  if (game.boosted[player]) {
    v /= 20;
  }
  const mask = masks[shape];
  const x = Math.floor((gridWidth - mask[0].length) / 2) + spawnOffset(shape).x;
  const y = spawnOffset(shape).y + gridBuffer;
  return {
    id: game.nextOminoId[player]++,
    shape,
    rotation: 0,
    mask,
    player,
    x,
    y,
    nextFall: createdAt + v,
    speed: v,
    boosted: game.boosted[player],
  };
}


function level(game) {
  return Math.floor(game.lines / 10) + 1;
}

function speed(game) {
  const l = level(game) - 1;
  return 1000 * ((0.8 - (l * 0.007)) ** l);
}

export function newGame(e: Init) {
  const rng1 = seedrandom(e.seed);
  const rng2 = seedrandom(e.seed.split('').reverse().join(''));
  const bag1 = randomBag(rng1);
  const bag2 = randomBag(rng2);
  const game = {
    lines: 0,
    score: 0,
    active: true,
    over: false,
    rng: {
      [Player.One]: rng1,
      [Player.Two]: rng2,
    },
    bag: {
      [Player.One]: bag1,
      [Player.Two]: bag2,
    },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ],
    nextOminoId: {
      [Player.One]: 0,
      [Player.Two]: 0,
    },
    activeOminos: {
      [Player.One]: null,
      [Player.Two]: null,
    },
    boosted: {
      [Player.One]: false,
      [Player.Two]: false,
    },
  };
  game.activeOminos = {
    [Player.One]: newOmino(game, Player.One, e.time),
    [Player.Two]: newOmino(game, Player.Two, e.time)
  };
  return game;
};


function checkCollision(game, omino, { dx, dy }) {
  for (const { x, y } of globalCoordPositions(omino, { dx, dy })) {
    if (game.grid[y] && game.grid[y][x] === omino.player) {
      return true;
    }
    if (x < 0 || x >= gridWidth) {
      return true;
    }
  }
  return false;
}

function checkLine(game, player, y) {
  for (let x = 0; x < gridWidth; x++) {
    if (game.grid[y][x] !== player) {
      return false;
    }
  }
  return true;
}

function clearLine(game, player, y) {
  if (player === 0) {
    game.grid = [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1]].concat(
      game.grid.slice(0, y),
      game.grid.slice(y + 1)
    );
  } else {
    game.grid = game.grid
      .slice(0, y)
      .concat(game.grid.slice(y + 1), [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]);
  }
}

function score(game, lines) {
  return [0,100,300,500,800][lines] * level(game);
}

function get(a, i, j, d = 0) {
  if (a[i]) {
    if (a[i].length > j) {
        return a[i][j];
      }
    }
  return d;
}

function fill(grid, color, start, directions) {
  const mask = grid.map(r => r.map(c => 0));
  const m = (i,j) => get(mask, i, j);
  const g = (i,j) => get(grid, i, j, -1);
  const queue = [start]
  let coords;
  while (coords = queue.pop()) {
    const [i, j] = coords;
    if (m(i,j)) {
      continue;
    }
    if (g(i, j) === color) {
      mask[i][j] = 1;
      for (const [di, dj] of directions) {
        queue.push([i + di, j + dj]);
      }
    }
  }
  
  return mask;
}

function checkConnectivity(game, omino) {
  const directions = [[0,1],[0,-1],[1,0],[-1,0]];
  const m = fill(game.grid, 1, [0, 0], directions);
  const m1 = fill(m, 0, [m.length - 1, m[0].length - 1], directions);
  const n = fill(game.grid, 0, [game.grid.length - 1, game.grid[0].length - 1], directions);
  const n1 = fill(n, 0, [0, 0], directions);
  for (let i = 0; i < m1.length; i++) {
    for (let j = 0; j < m1[i].length; j++) {
      if (m1[i][j] && n1[i][j]) {
        game.grid[i][j] = 1 - game.grid[i][j];
      }
    }
  }
  return game;
}

function lock(game, omino) {
  const yToCheck = new Set();
  for (const { x, y } of globalCoordPositions(omino, { dx: 0, dy: 0 })) {
    // Todo: the grid should extend beyond the visible area, this check should happen at the end of lock
    if (y < 0 || y >= gridHeight + (2 * gridBuffer)) {
      game.over = true;
      return game;
    }
    game.grid[y][x] = omino.player;
    yToCheck.add(y);
  }
  if (Array.from(yToCheck).filter(y => y >= gridBuffer && y < gridHeight + gridBuffer).length === 0) {
    game.over = true;
    return game;
  }
  let lines = 0;
  const order = omino.player === 0 ? (a, b) => a - b : (a, b) => b - a;
  for (const y of Array.from(yToCheck).sort(order)) {
    if (checkLine(game, omino.player, y)) {
      clearLine(game, omino.player, y);
      lines += 1;
    }
  }
  game.lines += lines;
  game.score += score(game, lines);
  game = checkConnectivity(game, omino);
  return game;
}

function randomShape(rng: () => number) {
  const x = rng();
  if (x < 0 || x >= 1) {
    throw "Random  number outside of the usual range";
  }
  return Math.floor(rng() * 7) as Shape;
}

function randomBag(rng: () => number) {
  const bag = [0,1,2,3,4,5,6];
  for (let i = 0; i < 7; i++) {
    const n = i +  Math.floor(rng() * (7 - i));
    const x = bag[n];
    bag[n] = bag[i];
    bag[i] = x;
  }
  return bag as Shape[];
}

const boostHandler = function(e: Boost, game) {
  const o = copyOmino(game.activeOminos[e.player]);
  // We don't need to check the omino here since boost is idempotent.
  game.boosted[e.player] = true;
  if (o.boosted) {
    return game;
  }
  o.speed /= 20;
  o.boosted = true;
  if (!checkCollision(game, o, { dx: 0, dy: 1 })) {
    o.y += 1;
    o.nextFall += checkCollision(game, o, { dx: 0, dy: 1 }) ? LOCK_DELAY : o.speed;
  }
  game.activeOminos[e.player] = o;
  return game;
}

const unboostHandler = function(e: Unboost, game) {
  const o = copyOmino(game.activeOminos[e.player]);
  // We don't need to check the omino here since unboost is idempotent.
  game.boosted[e.player] = false
  if (!o.boosted) {
    return game;
  }
  o.speed *= 20;
  o.boosted = false;
  game.activeOminos[e.player] = o;
  return game;
}

const dropHandler = function(e: Drop | HardDrop, game) {
  const o = copyOmino(game.activeOminos[e.player]);
  if (o.id !== e.omino) {
    // console.warn('Event targeted wrong omino');
    return game;
  }
  let drop = 0;
  while (!checkCollision(game, o, { dx: 0, dy: drop })) {
    drop += 1;
  }
  drop -= 1;
  o.y += drop;
  if (drop !== 0) {
    o.nextFall = e.time + LOCK_DELAY;
  }
  game.activeOminos[e.player] = o;
  return game;
};

const fallHandler = function(e: Fall | HardDrop, game) {
  const o = copyOmino(game.activeOminos[e.player]);
  if (o.id !== e.omino) {
    // console.warn('Event targeted wrong omino');
    return game;
  }
  if (!checkCollision(game, o, { dx: 0, dy: 1 })) {
    o.y += 1;
    o.nextFall += checkCollision(game, o, { dx: 0, dy: 1 }) ? LOCK_DELAY : o.speed;
    game.activeOminos[e.player] = o;
  } else {
    game = lock(game, o);
    game.activeOminos[e.player] = newOmino(
      game,
      e.player,
      e.time,
    );
  }
  return game;
};

const hardDropHandler = function(e: HardDrop, game) {
  return fallHandler(e, dropHandler(e, game));
}

export const eventHandlers = {
  [EventType.Spawn]: function(e: Spawn, game) {
    game.activeOminos[e.player] = newOmino(
      game,
      e.player,
      e.time,
    );
    return game;
  },
  [EventType.Move]: function(e: Move, game) {
    const o = copyOmino(game.activeOminos[e.player]);
    if (o.id !== e.omino) {
      // console.warn('Event targeted wrong omino');
      return game;
    }
    o.x += e.direction;
    if (!checkCollision(game, o, { dx: 0, dy: 0 })) {
      game.activeOminos[e.player] = o;
    }
    return game;
  },
  [EventType.Rotate]: function(e: Rotate, game) {
    const o = copyOmino(game.activeOminos[e.player]);
    if (o.id !== e.omino) {
      // console.warn('Event targeted wrong omino');
      return game;
    }
    o.rotation = (o.rotation + e.direction + 4) % 4 as 0 | 1 | 2 | 3;
    o.mask = rotatedMask(o.mask, e.direction);
    for (const { dx, dy } of kicks(o, e.direction)) {
      if (!checkCollision(game, o, { dx, dy })) {
        o.x += dx;
        o.y += dy;
        game.activeOminos[e.player] = o;
        return game;
      }
    }
    return game;
  },
  [EventType.Drop]: dropHandler,
  [EventType.Fall]: fallHandler,
  [EventType.HardDrop]: hardDropHandler,
  [EventType.Boost]: boostHandler,
  [EventType.Unboost]: unboostHandler,
};
