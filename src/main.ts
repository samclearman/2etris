import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";


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
const app = initializeApp(config);
const db = getDatabase(app);

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
    makeSession(me, db, game);
    return;
  }

  let session = newSession(u.searchParams.get('session'), me, db);

  const gameCanvas = <HTMLCanvasElement>document.getElementById("game");
  const gameCtx = gameCanvas.getContext("2d");
  const previewCanvas = <HTMLCanvasElement>document.getElementById("preview");
  const previewCtx = previewCanvas.getContext("2d");
  const holdCanvas = <HTMLCanvasElement>document.getElementById("hold");
  const holdCtx = holdCanvas.getContext("2d");
  const overlay = document.getElementById("pregame");
  const blackButton = document.getElementById("black-button");
  const whiteButton = document.getElementById("white-button");
  const easyButton = document.getElementById("easy-button");
  const levelPicker = document.getElementById("level-picker");
  const scoreHeroOutput = document.getElementById("score-hero");
  const scoreVillianOutput = document.getElementById("score-villian");
  const levelOutput = document.getElementById("level");
  const link = document.getElementById("link");
  const code = document.getElementById("code");
  const resetButton = document.getElementById("reset-button");
  const copyButton = document.getElementById("copy-button");

  registerControls({blackButton, whiteButton, easyButton, levelPicker, session, resetButton, copyButton});

  // @ts-ignore
  if(self.DEBUG_SESSION) {
    // @ts-ignore
    self.DEBUG_SESSION = session;
    // @ts-ignore
    self.prettyEvents = prettyEvents;
  }

  const loop = () => {
    // @ts-ignore
    const t = self.DEBUG_TIME || Date.now() + session.firebase.timeOffset;

    computeSession(session, t);
    renderSession({blackButton, whiteButton, easyButton, levelPicker, link, code, scoreHeroOutput, scoreVillianOutput, levelOutput, overlay, gameCtx, previewCtx, holdCtx}, session)
    setTimeout(loop, 10);
  };
  loop();
}

game();
