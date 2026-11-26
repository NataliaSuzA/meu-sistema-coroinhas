/**
 * Configuração oficial do Firebase — Projeto: paroquia-santa-teresa-avila
 * Provisionado via Firebase CLI (Web App: gestao-pastoral-web)
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  setDoc,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyB0R_cusgBDd_GbX9huodo0hcHc8DPID1A',
  authDomain: 'paroquia-santa-teresa-avila.firebaseapp.com',
  projectId: 'paroquia-santa-teresa-avila',
  storageBucket: 'paroquia-santa-teresa-avila.firebasestorage.app',
  messagingSenderId: '175829776414',
  appId: '1:175829776414:web:3354361f4a4914631a960f',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

export {
  EmailAuthProvider,
  collection,
  createUserWithEmailAndPassword,
  deleteDoc,
  deleteUser,
  doc,
  getDoc,
  getDocs,
  limit,
  onAuthStateChanged,
  onSnapshot,
  query,
  reauthenticateWithCredential,
  setDoc,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  writeBatch,
};
