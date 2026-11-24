import { Player } from './game';
import { pieceForInput, SessionState } from './session';
import { EventType, createEvent } from './events';

const DAS = 133;
const ARR = 50;

function trigger(event, session) {
  const { me } = session;
  const player = session.claims[Player.One] === me ? Player.One : Player.Two
  const omino = pieceForInput(session, player);
  if (omino !== null) createEvent({ player, omino, ...event }, session);
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

function removeRepeater(e) {
  const code = e.code.toString()
  if (!repeaters[code]) {
    // this shouldn't happen
    return;
  }
  clearInterval(repeaters[code]);
  delete repeaters[code];
}


const controls = {
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
  },
};

export function registerControls(session) {
  for (const eventName of ['keydown', 'keyup']) {
    window.addEventListener(eventName, function(e: KeyboardEvent) {
      const binding = controls[eventName][e.code];
      if (!binding) return;
      if (eventName === 'keyup') {
        binding(e); // Always release a held key, even after game over.
        return;
      }
      if (session.state !== SessionState.Playing) return;
      // Keep native disclosure and button activation available to keyboard users.
      if (e.code === 'Space' && e.target instanceof Element && e.target.closest('button, summary, a')) return;
      e.preventDefault();
      if (e.repeat) return;
      if (typeof binding === 'function') binding(e, session);
      else trigger(binding, session);
    });
  }
  window.addEventListener('blur', () => {
    for (const code of Object.keys(repeaters)) removeRepeater({ code });
  });
  document.querySelectorAll('[data-new-game]').forEach(button => {
    button.addEventListener('click', () => {
      session.restart();
    });
  });
}
