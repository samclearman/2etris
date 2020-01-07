import * as firebase from "firebase/app";

import "firebase/database";

import { newSession, makeSession, computeSession } from './session';
import { registerControls, renderSession } from './render';
import { E, prettyEvents } from './events';

// Initialize Firebase
var config = {
  apiKey: "AIzaSyD_jPrtfw6F6JmMxJxpnHJx43epldCWEr8",
  authDomain: "etris-ab596.firebaseapp.com",
  databaseURL: "https://etris-ab596.firebaseio.com",
  storageBucket: "etris-ab596.appspot.com",
  messagingSenderId: "996840504095"
};
firebase.initializeApp(config);
const db = firebase.database()

// const output = document.getElementById("fb_test");
// db.ref('text').on("value", snap => (output.innerText = snap.val()));

// stolen from https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function game() {
  if (!window.localStorage.getItem('me')) {
    window.localStorage.setItem('me', uuidv4());
  }
  const me = window.localStorage.getItem('me');
  const u = new URL(window.location.href);
  if (!u.searchParams.has('session')) {
    const s = makeSession(me, db, game);
    return;
  }

  let session = newSession(me);

  const canvas = <HTMLCanvasElement>document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const overlay = document.getElementById("pregame");
  const blackButton = document.getElementById("black-button");
  const whiteButton = document.getElementById("white-button");
  const scoreOutput = document.getElementById("score");
  const linesOutput = document.getElementById("lines");
  
  let events: E[] = [];
  // @ts-ignore
  if (self.DEBUG_EVENTS) {
    // @ts-ignore
    self.DEBUG_EVENTS = events;
    // @ts-ignore
    self.prettyEvents = prettyEvents;
  }
  const fbEvents = firebase.database().ref(`sessions/${u.searchParams.get('session')}`);
  // fbEvents.on("child_added", function(snapshot) {
  //   const e = snapshot.val();
  //   events.push(e);
  // });
  fbEvents.on('value', function (snapshot) {
    events = Object.values(snapshot.val());
    events.sort((e1, e2) => e1.time - e2.time);
  })
  registerControls({blackButton, whiteButton, fbEvents, session});

  // @ts-ignore
  if(self.DEBUG_SESSION) self.DEBUG_SESSION = session;
  const loop = () => {
    // @ts-ignore
    const t = self.DEBUG_TIME || Date.now();
    // @ts-ignore
    if (self.DEBUG_EVENTS) self.DEBUG_EVENTS = events;
    computeSession(session, events, t);
    renderSession({blackButton, whiteButton, scoreOutput, linesOutput, overlay, ctx}, session)
    setTimeout(loop, 10);
  };
  loop();
}

game();
