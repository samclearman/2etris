import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

declare const __LOCAL_FIREBASE__: boolean;

// Public web app configuration. Access is enforced by database.rules.json.
const app = initializeApp(__LOCAL_FIREBASE__ ? {
  projectId: 'demo-2etris', apiKey: 'demo-api-key',
  databaseURL: 'https://demo-2etris-default-rtdb.firebaseio.com',
} : {
  apiKey: 'AIzaSyAJxcYsk8hM-6_Bp4TJz1480_VUNjYs6mY',
  authDomain: 'etris-ffea8.firebaseapp.com',
  databaseURL: 'https://etris-ffea8-default-rtdb.firebaseio.com',
  projectId: 'etris-ffea8',
  storageBucket: 'etris-ffea8.firebasestorage.app',
  messagingSenderId: '843957374501',
  appId: '1:843957374501:web:70d9c071a949def13579cc',
});
const auth = getAuth(app);
export const db = getDatabase(app);
if (__LOCAL_FIREBASE__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
}

export async function playerId(): Promise<string> {
  await auth.authStateReady(); // Restore the same seat on reload.
  return auth.currentUser?.uid ?? (await signInAnonymously(auth)).user.uid;
}
