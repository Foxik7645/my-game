diff --git a//dev/null b/js/firebase.js
index 0000000000000000000000000000000000000000..e46913b5a2fe1d69445673fab6c373b81f7695d8 100644
--- a//dev/null
+++ b/js/firebase.js
@@ -0,0 +1,39 @@
+import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
+import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
+import { getFirestore, collection, addDoc, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
+
+const firebaseConfig = {
+  apiKey: "AIzaSyC-cKsUyDM2H1Hs3ouKjRjO2Vxg9QvC880",
+  authDomain: "gamemap-84ae8.firebaseapp.com",
+  projectId: "gamemap-84ae8",
+  storageBucket: "gamemap-84ae8.firebasestorage.app",
+  messagingSenderId: "198147414309",
+  appId: "1:198147414309:web:33b340d6bf6dbd3d01a2cc",
+  measurementId: "G-M2TKZCT4LT",
+};
+
+const app = initializeApp(firebaseConfig);
+const auth = getAuth(app);
+const db = getFirestore(app);
+
+export {
+  app,
+  auth,
+  db,
+  GoogleAuthProvider,
+  signInWithPopup,
+  onAuthStateChanged,
+  signOut,
+  collection,
+  addDoc,
+  onSnapshot,
+  doc,
+  setDoc,
+  getDoc,
+  updateDoc,
+  deleteDoc,
+  serverTimestamp,
+  getDocs,
+  query,
+  where,
+};
