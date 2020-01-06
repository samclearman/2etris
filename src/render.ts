import { Player, gridHeight, globalCoordPositions } from './game';
import { SessionState } from './session';
import { EventType } from './events';

const w = 20;

const playerColors = {
  [Player.One]: "black",
  [Player.Two]: "white"
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
  ArrowUp: {
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
    t: EventType.Drop,
  },
  Space: [
    {
      t: EventType.Drop,
    },
    {
      t: EventType.Fall,
    }
  ],
};

function identity({x,y}) {
  return {x,y}
}

function flip({x,y}) {
  return {x, y: gridHeight - 1 - y};
}

function render(ctx, game, transform) {
  for (let i = 0; i < game.grid.length; i++) {
    for (let j = 0; j < game.grid[i].length; j++) {
      ctx.fillStyle = playerColors[game.grid[i][j]];
      const { x, y } = transform({ x: j, y: i});
      ctx.fillRect(x * w, y * w, w, w);
    }
  }
  for (const p in Player) {
    ctx.fillStyle = playerColors[p];
    const o = game.activeOminos[p];
    if (!o) {
      continue;
    }
    const positions = globalCoordPositions(o, { dx: 0, dy: 0 }).map(p => transform(p));
    for (const { x, y } of positions) {
      ctx.fillRect(x * w, y * w, w, w);
    }
  }
}

export function renderClaimer({blackButton, whiteButton, overlay}, session) {
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
}

function renderScore({scoreOutput, linesOutput}, game) {
  scoreOutput.textContent = game.score;
  linesOutput.textContent = game.lines;
}

export function registerControls({blackButton, whiteButton, fbEvents, session}) {
  const { me } = session;
  window.addEventListener("keydown", function(e) {
    if (!(e.code.toString() in controls)) {
      return;
    }
    const player = session.claims[Player.One] === me ? Player.One : Player.Two
    let events = controls[e.code.toString()];
    if (!Array.isArray(events)) {
      events = [events];
    }
    for (event of events) {
      fbEvents.push(Object.assign({ time: Date.now(), player }, event));
    }
    e.preventDefault();
  });
  blackButton.addEventListener('change', function(e) {
    fbEvents.push({
      t: EventType.Claim,
      time: Date.now(),
      user: me,
      player: Player.One,
    });
  });
  whiteButton.addEventListener('change', function(e) {
    fbEvents.push({
      t: EventType.Claim,
      time: Date.now(),
      user: me,
      player: Player.Two,
    });
  })
}

export function renderSession({blackButton, whiteButton, scoreOutput, linesOutput, overlay, ctx}, session) {
  renderClaimer({blackButton, whiteButton, overlay}, session);
  if (session.state === SessionState.Playing || session.state === SessionState.Over) {
    render(ctx, session.game, session.claims[Player.One] === session.me ? identity : flip);
    renderScore({scoreOutput, linesOutput}, session.game);
  }
};
