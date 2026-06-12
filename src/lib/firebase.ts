import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey:            "AIzaSyCUlDYWJPE6T8qGqVEfkywRItXfJRQVQ2k",
  authDomain:        "laboratoire-f8e84.firebaseapp.com",
  projectId:         "laboratoire-f8e84",
  storageBucket:     "laboratoire-f8e84.firebasestorage.app",
  messagingSenderId: "34245919675",
  appId:             "1:34245919675:web:4c33e2427a979062da7a9e",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth    = getAuth(app);
export const storage = getStorage(app);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  // Ignore les champs `undefined` au lieu de lever une erreur (ex: email/
  // adresse non renseignés à la création d'un patient). Sinon addDoc échoue.
  ignoreUndefinedProperties: true,
});