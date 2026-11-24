import { Player, Shape, gridBuffer, gridHeight, gridOuterHeight, masks, globalCoordPositions, globalCoordGhostPositions } from './game';

const cell = 20;
const ink = ['#262348', '#e0ecfc'];
const face = ['#282245', '#ebf7ff'];
const edge = ['#ff82b1', '#73edf7'];
const ghost = ['#705178', '#96dbe2'];
const origin = { dx: 0, dy: 0 };

function pieceCell(ctx: CanvasRenderingContext2D, x: number, y: number, player: Player) {
  ctx.fillStyle = face[player];
  ctx.fillRect(x, y, cell, cell);
  ctx.strokeStyle = edge[player];
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, cell - 1, cell - 1);
}

/** Local display cache only. The engine owns every collision, position and ghost. */
export class FieldRenderer {
  private base = document.createElement('canvas');
  private rows = new Int16Array(gridHeight).fill(-1);
  private pieces = '';
  private queue = '';
  private reserve = '';

  constructor(private board: CanvasRenderingContext2D, private preview: CanvasRenderingContext2D, private hold: CanvasRenderingContext2D) {
    this.base.width = board.canvas.width;
    this.base.height = board.canvas.height;
  }

  // Cache the settled field across simulation replays (the engine reconstructs
  // grid arrays, so object identity isn't a reliable indication of a change).
  private updateBase(grid: number[][], flipped: boolean) {
    const cols = this.base.width / cell;
    let changed = false;
    for (let y = 0; y < gridHeight; y++) {
      const row = grid[gridBuffer + (flipped ? gridHeight - y - 1 : y)];
      let bits = 0;
      for (let x = 0; x < cols; x++) bits |= row[x] << x;
      if (this.rows[y] !== bits) changed = true;
      this.rows[y] = bits;
    }
    if (!changed) return false;

    const ctx = this.base.getContext('2d');
    const seam = new Path2D();
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < cols; x++) {
        const owner = (this.rows[y] >> x) & 1;
        const px = x * cell, py = y * cell;
        ctx.fillStyle = ink[owner];
        ctx.fillRect(px, py, cell, cell);
        ctx.fillStyle = owner === Player.One ? '#383354' : '#cad7e9';
        ctx.fillRect(px, py, cell, 1);
        ctx.fillRect(px, py, 1, cell);
        // Draw every ownership boundary, including vertical steps and islands.
        if (x && ((this.rows[y] >> (x - 1)) & 1) !== owner) {
          seam.moveTo(px, py); seam.lineTo(px, py + cell);
        }
        if (y && ((this.rows[y - 1] >> x) & 1) !== owner) {
          seam.moveTo(px, py); seam.lineTo(px + cell, py);
        }
      }
    }
    ctx.save();
    ctx.lineCap = 'square';
    ctx.lineWidth = 3; ctx.strokeStyle = '#39284f'; ctx.stroke(seam);
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffdb54'; ctx.stroke(seam);
    ctx.restore();
    return true;
  }

  draw(game, hero: Player) {
    const flipped = hero === Player.Two;
    const changed = this.updateBase(game.grid, flipped);
    const players = [Player.One, Player.Two];
    const signature = [hero, ...players.map(p => {
      const o = game.activeOminos[p];
      return o ? [o.shape, o.rotation, o.x, o.y].join(':') : '-';
    })].join('/');
    if (changed || signature !== this.pieces) {
      this.pieces = signature;
      const ctx = this.board;
      ctx.drawImage(this.base, 0, 0);
      const pixelY = (y: number) => ((flipped ? gridOuterHeight - 1 - y : y) - gridBuffer) * cell;
      for (const player of players) {
        const o = game.activeOminos[player];
        if (!o) continue;
        ctx.strokeStyle = ghost[player];
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        for (const { x, y } of globalCoordGhostPositions(game, o, origin)) {
          ctx.strokeRect(x * cell + 2, pixelY(y) + 2, cell - 4, cell - 4);
        }
        ctx.setLineDash([]);
        for (const { x, y } of globalCoordPositions(o, origin)) pieceCell(ctx, x * cell, pixelY(y), player);
      }
    }

    // The bag pops from its end: the next piece remains at the bottom of
    // the six-piece preview, just as in the original cabinet.
    const shapes = game.bag[hero].slice(-6) as Shape[];
    const queue = `${hero}/${shapes.join(',')}`;
    if (queue !== this.queue) {
      this.queue = queue;
      this.clear(this.preview);
      shapes.forEach((shape, i) => this.drawShape(this.preview, shape, hero, i * 3 * cell));
    }
    const held = game.hold[hero] as Shape | null;
    const reserve = `${hero}/${held}`;
    if (reserve !== this.reserve) {
      this.reserve = reserve;
      this.clear(this.hold);
      if (held !== null) this.drawShape(this.hold, held, hero, 0);
    }
  }

  private clear(ctx: CanvasRenderingContext2D) { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); }

  private drawShape(ctx: CanvasRenderingContext2D, shape: Shape, player: Player, offset: number) {
    masks[shape].slice(0, 2).forEach((row, y) => row.forEach((filled, x) => {
      if (filled) pieceCell(ctx, x * cell, offset + y * cell, player);
    }));
  }
}
