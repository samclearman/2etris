import { Player, level } from './game';
import { SessionState } from './session';
import { FieldRenderer } from './field';

function el<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}
function text(node: HTMLElement, value: string) {
  if (node.textContent !== value) node.textContent = value;
}

// Original 3×5 cabinet numerals. The adjacent <output> holds the real score
// for assistive technology; the six-digit treatment is purely visual.
const numerals = [
  '111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111',
];
class ScoreMeter {
  private output: HTMLOutputElement;
  private name: HTMLElement;
  private meter: HTMLElement;
  private display: SVGSVGElement;
  private path: SVGPathElement;
  private last: number;

  constructor(prefix: string, outputId: string) {
    this.output = el(outputId);
    this.name = el(`${prefix}-color`);
    this.meter = el(`${prefix}-meter`);
    this.display = document.querySelector(`#${prefix}-display`);
    this.path = this.display.querySelector('path');
  }

  update(score: number, side: string) {
    text(this.name, side);
    if (this.meter.dataset.side !== side) this.meter.dataset.side = side;
    if (score === this.last) return;
    this.last = score;
    this.output.value = String(score);
    const digits = String(score).padStart(6, '0');
    let d = '';
    Array.from(digits).forEach((digit, i) => {
      Array.from(numerals[Number(digit)] ?? '').forEach((pixel, j) => {
        if (pixel === '1') d += `M${i * 4 + j % 3} ${Math.floor(j / 3)}h1v1h-1z`;
      });
    });
    this.display.setAttribute('viewBox', `0 0 ${digits.length * 4 - 1} 5`);
    this.path.setAttribute('d', d);
  }
}

export class Cabinet {
  private lobby = el('pregame');
  private match = el('match');
  private result = el('result');
  private hero = new ScoreMeter('hero', 'score-hero');
  private rival = new ScoreMeter('rival', 'score-villian');
  private level = el('level');
  private board = el<HTMLCanvasElement>('game');
  private field = new FieldRenderer(this.board.getContext('2d'), el<HTMLCanvasElement>('preview').getContext('2d'), el<HTMLCanvasElement>('hold').getContext('2d'));
  private finalHero = el('final-hero');
  private finalRival = el('final-rival');
  private finalHeroColor = el('final-hero-color');
  private finalRivalColor = el('final-rival-color');
  private finalLevel = el('final-level');
  private showResult = el('show-result');
  private finalField = false;
  private screen: HTMLElement;

  constructor(roomCode: string) {
    text(el('room-code'), roomCode);
    const invite = new URL(window.location.pathname, window.location.origin);
    invite.searchParams.set('session', roomCode);
    const status = el('copy-status');
    const bindCopy = (id: string, value: string, confirmation: string) => {
      const button = el<HTMLButtonElement>(id);
      button.disabled = false;
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(value);
          text(status, confirmation);
        } catch {
          window.getSelection()?.selectAllChildren(el('room-code'));
          text(status, 'Room code selected. Use your device’s Copy command.');
        }
      });
    };
    bindCopy('copy-code', roomCode, 'Room code copied.');
    bindCopy('copy-button', invite.href, 'Game link copied.');
    el('view-field').addEventListener('click', () => { this.finalField = true; });
    this.showResult.addEventListener('click', () => { this.finalField = false; });
  }

  private show(screen: HTMLElement) {
    if (screen === this.screen) return;
    this.screen = screen;
    this.lobby.hidden = screen !== this.lobby;
    this.match.hidden = screen !== this.match;
    this.result.hidden = screen !== this.result;
    if (screen === this.match) this.board.focus({ preventScroll: true });
    if (screen === this.result) el('result-title').focus({ preventScroll: true });
  }

  draw(session) {
    if (session.state === SessionState.Claiming) {
      this.finalField = false;
      this.show(this.lobby);
      return;
    }

    const { game } = session;
    const hero = session.claims[Player.One] === session.me ? Player.One : Player.Two;
    const rival = 1 - hero;
    const heroColor = hero === Player.One ? 'black' : 'white';
    const rivalColor = hero === Player.One ? 'white' : 'black';
    const currentLevel = String(level(game));
    const over = session.state === SessionState.Over;
    if (!over) this.finalField = false;
    if (over && !this.finalField) {
      this.show(this.result);
      text(this.finalHeroColor, heroColor);
      text(this.finalRivalColor, rivalColor);
      text(this.finalHero, String(game.scores[hero]));
      text(this.finalRival, String(game.scores[rival]));
      text(this.finalLevel, currentLevel);
    } else {
      this.show(this.match);
      if (this.showResult.hidden === over) this.showResult.hidden = !over;
      this.field.draw(game, hero);
      this.hero.update(game.scores[hero], heroColor);
      this.rival.update(game.scores[rival], rivalColor);
      text(this.level, currentLevel);
    }
  }
}
