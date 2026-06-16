// src/firebase.js (CRA)
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBJ6vgHCboEyeFh_YMohMhLk1fK4Wn8ZeY",
  authDomain: "sistema-vipizza.firebaseapp.com",
  projectId: "sistema-vipizza",
  storageBucket: "sistema-vipizza.firebasestorage.app",
  messagingSenderId: "923759550793",
  appId: "1:923759550793:web:39d49aeef741d8a74d7a98",
  measurementId: "G-V05VVF2XNL"
};

const app = initializeApp(firebaseConfig); 
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { signInWithEmailAndPassword, sendPasswordResetEmail };
export { firebaseConfig };
