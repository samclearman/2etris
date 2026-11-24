import { E, EventType } from './events';
import { processEvent, canFall } from './game';

// onValue includes pending writes with an estimated server timestamp. Never
// feed those estimates into the simulation that owns locks, scores and clears.
export function confirmedEvents(snapshot: Record<string, E>, pending: ReadonlyMap<string, E>): E[] {
  return Object.keys(snapshot)
    .filter(key => !pending.has(key))
    .map(key => ({ ...snapshot[key], _k: key }))
    .sort((a, b) => a.time - b.time || (a._k < b._k ? -1 : a._k > b._k ? 1 : 0));
}

// Apply local feedback *after* replay and gravity. This projection is discarded
// next frame. It must never lock a piece, write a grid cell, or award points.
export function previewInputs(game, inputs: Iterable<E>, end: number) {
  for (const input of inputs) {
    if (!('omino' in input) || input.omino !== game.activeOminos[input.player].id) continue;
    const e = { ...input, time: end };
    switch (e.t) {
      case EventType.HardDrop:
        processEvent({ ...e, t: EventType.Drop }, game); // landing position only
        return;
      case EventType.Fall:
        if (!canFall(game, game.activeOminos[e.player])) return;
        processEvent(e, game);
        break;
      case EventType.Move:
      case EventType.Rotate:
      case EventType.Hold:
        processEvent(e, game);
        break;
    }
  }
}
