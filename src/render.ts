import { Player, gridHeight, gridBuffer, gridOuterHeight, globalCoordPositions, globalCoordGhostPositions, masks } from './game';
import { SessionState } from './session';
import { EventType, createEvent } from './events';

const w = 20;
const DAS = 133;
const ARR = 50;

const playerColors = {
  [Player.One]: "black",
  [Player.Two]: "white"
};

const playerGhostColors = {
  [Player.One]: "#DDDDDD",
  [Player.Two]: "#333333"
};

function trigger(event, session) {
  const { me } = session;
  const player = session.claims[Player.One] === me ? Player.One : Player.Two
  const e = createEvent(Object.assign({ player }, event), session)
}

const repeaters = { }

function makeRepeater(event) {
  return function(e, session) {
    const code = e.code.toString()
    if (repeaters[code]) {
      // this shouldn't happen
      return;
    }
    const f = function() {
      trigger(event, session);
    }
    f();
    repeaters[code] = setTimeout(() => {
      repeaters[code] = setInterval(f, ARR);
    }, DAS);
  };
}

function removeRepeater(e, session) {
  const code = e.code.toString()
  if (!repeaters[code]) {
    // this shouldn't happen
    return;
  }
  clearInterval(repeaters[code]);
  delete repeaters[code];
}


const controls = {
  // Test controls
  // KeyS: {
  //   t: EventType.Rotate,
  //   player: Player.Two,
  //   direction: 1
  // },
  // KeyQ: {
  //   t: EventType.Move,
  //   player: Player.Two,
  //   direction: -1
  // },
  // KeyW: {
  //   t: EventType.Drop,
  //   player: Player.Two
  // },
  // KeyE: {
  //   t: EventType.Move,
  //   player: Player.Two,
  //   direction: 1
  // },
  keydown: {
    ArrowUp: {
      t: EventType.Rotate,
      direction: 1
    },
    KeyX: {
      t: EventType.Rotate,
      direction: 1
    },
    ArrowLeft: makeRepeater({
      t: EventType.Move,
      direction: -1
    }),
    ArrowRight: makeRepeater({
      t: EventType.Move,
      direction: 1
    }),
    ArrowDown: makeRepeater({
      t: EventType.Fall,
    }),
    KeyZ: {
      t: EventType.Rotate,
      direction: -1,
    },
    ControlLeft: {
      t: EventType.Rotate,
      direction: -1,
    },
    ControlRight: {
      t: EventType.Rotate,
      direction: -1,
    },
    Space: {
      t: EventType.HardDrop,
    },
    KeyC: {
      t: EventType.Hold,
    },
    ShiftLeft: {
      t: EventType.Hold,
    },
    ShiftRight: {
      t: EventType.Hold,
    }
  },
  keyup: {
    ArrowLeft: removeRepeater,
    ArrowRight: removeRepeater,
    ArrowDown: removeRepeater,
    // ArrowDown: {
    //   t: EventType.Unboost,
    // },
  },
};

function identity({x,y}) {
  return {x,y}
}

function flip({x,y}) {
  return {x, y: gridOuterHeight - 1 - y};
}

function render(ctx, game, transform) {
  const square = function(x,y) {
    ctx.fillRect(x * w, (y - gridBuffer) * w, w, w);
  }
  for (let i = gridBuffer; i < gridHeight + gridBuffer; i++) {
    for (let j = 0; j < game.grid[i].length; j++) {
      ctx.fillStyle = playerColors[game.grid[i][j]];
      const { x, y } = transform({ x: j, y: i});
      square(x, y);
    }
  }
  for (const p in Player) {
    const o = game.activeOminos[p];
    if (!o) {
      continue;
    }
    const ghostPositions = globalCoordGhostPositions(game, o, { dx: 0, dy: 0 }).map(p => transform(p));
    ctx.fillStyle = playerGhostColors[p];
    for (const { x, y } of ghostPositions) {
      square(x, y);
    }
    const positions = globalCoordPositions(o, { dx: 0, dy: 0 }).map(p => transform(p));
    ctx.fillStyle = playerColors[p];
    for (const { x, y } of positions) {
      square(x, y);
    }
  }
}

function renderPreview(ctx, game, player) {
  ctx.fillStyle = playerColors[player];
  for (let n = 0; n < 6; n++) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        const s = game.bag[player][game.bag[player].length - 1 - n]
        ctx.fillStyle = (masks[s][j][i]) ? playerColors[player] : "rgba(0,0,0,0)"; // playerColors[1 - player];
        const x = i * w;
        const y = ((5 - n) * 3 + j) * w;
        ctx.clearRect(x, y, w, w);
        ctx.fillRect(x, y, w, w);
      }
    }
  }
}

function renderHold(ctx, game, player) {
  const s = game.hold[player];
  if (s === null) {
    return;
  }
  ctx.fillStyle = playerColors[player];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (masks[s][j][i]) ? playerColors[player] : "rgba(0,0,0,0)"; // playerColors[1 - player];
      const x = i * w;
      const y = j * w;
      ctx.clearRect(x, y, w, w);
      ctx.fillRect(x, y, w, w);
    }
  }
}

export function renderClaimer({blackButton, whiteButton, easyButton, link, overlay}, session) {
  if (session.state !== SessionState.Claiming) {
    overlay.style.display = 'none';
  }
  for (const [player, button] of [[Player.One, blackButton], [Player.Two, whiteButton]]) {
    if (session.claims[player] === session.me) {
      button.checked = true;
      button.disabled = false;
    } else if (session.claims[player]) {
      button.checked = false;
      button.disabled = true;
    } else {
      button.checked = false;
      button.disabled = false;
    }
  }
  easyButton.checked = session.easyMode;
  link.textContent = window.location.href;
}

function renderScore({scoreOutput, linesOutput}, game) {
  scoreOutput.textContent = game.score;
  linesOutput.textContent = game.lines;
}



export function registerControls({blackButton, whiteButton, easyButton, session}) {
  for (const eventName of ['keydown', 'keyup']) {
    window.addEventListener(eventName, function(e: KeyboardEvent) {
      if (e.repeat) {
        return;
      }
      if (!(e.code.toString() in controls[eventName])) {
        return;
      }
      if (typeof controls[eventName][e.code.toString()] === 'function') {
        controls[eventName][e.code.toString()](e, session);
        return;
      }
      const event = controls[eventName][e.code.toString()];
      trigger(event, session);
      e.preventDefault();
    });
  }
  blackButton.addEventListener('change', function(e) {
    createEvent({
      t: EventType.Claim,
      player: Player.One,
    }, session)
  });
  whiteButton.addEventListener('change', function(e) {
    createEvent({
      t: EventType.Claim,
      player: Player.Two,
    }, session)
  });
  easyButton.addEventListener('change', function(e) {
    createEvent({
      t: EventType.ToggleEasy,
      val: e.target.checked,
    }, session)
  });
}

export function renderSession({blackButton, whiteButton, easyButton, link, scoreOutput, linesOutput, overlay, gameCtx, previewCtx, holdCtx}, session) {
  renderClaimer({blackButton, whiteButton, easyButton, link, overlay}, session);
  if (session.state === SessionState.Playing || session.state === SessionState.Over) {
    render(gameCtx, session.game, session.claims[Player.One] === session.me ? identity : flip);
    renderPreview(previewCtx, session.game, session.claims[Player.One] === session.me ? Player.One : Player.Two);
    renderHold(holdCtx, session.game, session.claims[Player.One] === session.me ? Player.One : Player.Two);
    renderScore({scoreOutput, linesOutput}, session.game);
  }
};
