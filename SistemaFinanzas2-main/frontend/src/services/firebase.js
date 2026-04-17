// src/firebase.js (CRA)
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCS_iCxJiLHo618fTHVTqbhA7GeWc2cgjE",
  authDomain: "vp-adin.firebaseapp.com",
  projectId: "vp-adin",
  storageBucket: "vp-adin.firebasestorage.app",
  messagingSenderId: "199001819611",
  appId: "1:199001819611:web:48bfb3146a0c42aab47ffe"
};

const app = initializeApp(firebaseConfig); 
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { signInWithEmailAndPassword, sendPasswordResetEmail };
export { firebaseConfig };
