// firebase.js (обновлённый)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  // оставляем экспорт, но логин будем делать через popup
  signInWithRedirect,
  getRedirectResult,
  // добавляем popup и persistence
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot, doc, setDoc, getDoc,
  updateDoc, deleteDoc, serverTimestamp, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-cKsUyDM2H1Hs3ouKjRjO2Vxg9QvC880",
  // РЕКОМЕНДАЦИЯ: если игра хостится НЕ на *.firebaseapp.com / *.web.app,
  // поставь здесь свой домен (напр. game.example.com) и добавь его в Authorized domains.
  authDomain: "gamemap-84ae8.firebaseapp.com",
  projectId: "gamemap-84ae8",
  // Похоже, тут опечатка. Обычно storageBucket = "<project-id>.appspot.com"
  // Это не влияет на вход, но лучше исправить, если используешь Storage.
  storageBucket: "gamemap-84ae8.appspot.com",
  messagingSenderId: "198147414309",
  appId: "1:198147414309:web:33b340d6bf6dbd3d01a2cc",
  measurementId: "G-M2TKZCT4LT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// устойчивее к блокировке cookies/итогов редиректа
await setPersistence(auth, browserLocalPersistence);

// Провайдер Google (можно настроить подсказку аккаунта/язык)
const googleProvider = new GoogleAuthProvider();
// googleProvider.setCustomParameters({ prompt: "select_account" });
// auth.languageCode = "ru";

const db = getFirestore(app);

// Хелпер для входа через popup (используй его на кнопке "Войти с Google")
export async function signInWithGooglePopup() {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export {
  auth,
  db,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  // оставлены, если где-то уже используются
  signInWithRedirect,
  getRedirectResult,
  // новый экспорт — вдруг понадобится напрямую
  signInWithPopup,
  collection,
  addDoc,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  query,
  where
};
