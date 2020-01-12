import { Player, gridHeight, gridBuffer, gridOuterHeight, globalCoordPositions, globalCoordGhostPositions } from './game';
import { SessionState } from './session';
import { EventType, createEvent } from './events';

const w = 20;

const playerColors = {
  [Player.One]: "black",
  [Player.Two]: "white"
};

const playerGhostColors = {
  [Player.One]: "#DDDDDD",
  [Player.Two]: "#333333"
};


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
    ArrowLeft: {
      t: EventType.Move,
      direction: -1
    },
    ArrowRight: {
      t: EventType.Move,
      direction: 1
    },
    ArrowDown: {
      // t: EventType.Boost,
      t: EventType.Drop,
    },
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
    Space: [
      {
        t: EventType.Drop,
      },
      {
        t: EventType.Fall,
      }
    ],
  },
  keyup: {
    // ArrowDown: {
    //   t: EventType.Unboost,
    // },
  },
};;

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
  const { me } = session;
  for (const eventName of ['keydown', 'keyup']) {
    window.addEventListener(eventName, function(e: KeyboardEvent) {
      if (e.repeat) {
        return;
      }
      if (!(e.code.toString() in controls[eventName])) {
        return;
      }
      const player = session.claims[Player.One] === me ? Player.One : Player.Two
      let events = controls[eventName][e.code.toString()];
      if (!Array.isArray(events)) {
        events = [events];
      }
      for (event of events) {
        const e = createEvent(Object.assign({ player }, event), session)
      }
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

export function renderSession({blackButton, whiteButton, easyButton, link, scoreOutput, linesOutput, overlay, ctx}, session) {
  renderClaimer({blackButton, whiteButton, easyButton, link, overlay}, session);
  if (session.state === SessionState.Playing || session.state === SessionState.Over) {
    render(ctx, session.game, session.claims[Player.One] === session.me ? identity : flip);
    renderScore({scoreOutput, linesOutput}, session.game);
  }
};
