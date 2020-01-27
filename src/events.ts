import * as firebase from "firebase/app";

import { Shape, eventHandlers } from './game';
// Events

export enum EventType {
  Rotate,
  Move,
  Drop,
  HardDrop,
  Boost,
  Unboost,
  Spawn,
  Fall,
  Init,
  Claim,
  ToggleEasy,
  Hold,
}

interface IEvent {
  t: EventType;
  user: string;
  time: number;
  localTime?: number;
  parent?: string;
  _k?: string;
}

export interface Rotate extends IEvent {
  t: EventType.Rotate;
  omino: number;
  player: number;
  direction: 1 | -1;
}

export interface Move extends IEvent {
  t: EventType.Move;
  omino: number;
  player: number;
  direction: 1 | -1;
}

export interface Drop extends IEvent {
  t: EventType.Drop;
  omino: number;
  player: number;
}

export interface HardDrop extends IEvent {
  t: EventType.HardDrop;
  omino: number;
  player: number;
}

export interface Boost extends IEvent {
  t: EventType.Drop;
  omino: number;
  player: number;
}

export interface Unboost extends IEvent {
  t: EventType.Drop;
  omino: number;
  player: number;
}

export interface Spawn extends IEvent {
  t: EventType.Spawn;
  player: number;
  shape: Shape;
}

export interface Fall extends IEvent {
  t: EventType.Fall;
  omino: number;
  player: number;
}

export interface Init extends IEvent {
  t: EventType.Init;
  easyMode: boolean;
  seed: string;
}

export interface Claim extends IEvent {
  t: EventType.Claim;
  player: number;
  both?: boolean;
}

export interface Claim extends IEvent {
  t: EventType.Claim;
  val: boolean,
  player: number;
  both?: boolean;
}

export interface Hold extends IEvent {
  t: EventType.Hold;
  player: number;
}

export type E = Rotate | Move | Drop | HardDrop | Spawn | Fall | Init | Claim | Hold;

export function tickEvent(o): Fall {
  return {
    omino: o.id,
    t: EventType.Fall,
    time: o.nextFall,
    player: o.player,
    user: '',
  };
}

export function processEvent(e: E, game) {
  if (!eventHandlers[e.t]) {
    console.warn(`Unsupported event: ${e.t}`);
    return game
  }
  return eventHandlers[e.t](e, game);
}

export function createEvent(e, session) {
  // no types
  if ([EventType.Rotate, EventType.Move, EventType.Drop, EventType.Fall, EventType.HardDrop, EventType.Boost, EventType.Unboost, EventType.Hold].includes(e.t)) {
    if (!session.game) {
      return null;
    }
    e.omino = session.game.activeOminos[e.player].id;
  }
  e.time = firebase.database.ServerValue.TIMESTAMP;
  e.localTime = Date.now();
  e.user = session.me;
  e.parent = session.firebase.lastEvent;
  session.firebase.eventsRef.push(e);
}

function prettyEvent(e, start = 0) {
  const pretty = `t ${(e.time - start) / 1000}`
  console.log(pretty);
}

export function prettyEvents(events: E[]) {
  let start;
  for (const e of events) {
    if (!start && e.time) {
      start = e.time;
    }
    prettyEvent(e, start);
  }
  console.log(`Current time is ${(Date.now() - start) / 1000}`);
}
