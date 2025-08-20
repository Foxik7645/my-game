import { auth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, doc, db } from './firebase.js';
import { setPlayerContext, ensurePlayerDoc } from './state.js';
import { showToast } from './ui.js';
import { startRealtime, resetGame } from './game.js';

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');

loginBtn.onclick = async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { showToast('Ошибка входа: ' + (e?.message||e), [], 2500); }
};
logoutBtn.onclick = async () => { try{ await signOut(auth); }catch(e){} };

onAuthStateChanged(auth, async user => {
  if(user){
    setPlayerContext(user.uid, doc(db, 'players', user.uid));
    userName.textContent = user.displayName || user.email || 'Player';
    loginBtn.style.display='inline-block';
    loginBtn.textContent = 'Сменить аккаунт';
    logoutBtn.style.display='inline-block';
    await ensurePlayerDoc();
    startRealtime();
  } else {
    setPlayerContext(null, null);
    userName.textContent = '';
    loginBtn.textContent = 'Войти с Google';
    logoutBtn.style.display='none';
    resetGame();
  }
}, error => {
  showToast('Ошибка аутентификации: ' + error.message, [], 2500);
});
