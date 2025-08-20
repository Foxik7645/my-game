import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { auth } from "./firebase.js";

function initAuthUI(){
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userName = document.getElementById('userName');

  loginBtn?.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  });

  logoutBtn?.addEventListener('click', () => signOut(auth));

  onAuthStateChanged(auth, user => {
    if(user){
      userName.textContent = user.displayName || user.email || 'Player';
      loginBtn.textContent = 'Сменить аккаунт';
      logoutBtn.style.display = 'inline-block';
    } else {
      userName.textContent = '';
      loginBtn.textContent = 'Войти с Google';
      logoutBtn.style.display = 'none';
    }
  }, error => {
    console.error('Auth error', error);
  });
}

export { initAuthUI };
