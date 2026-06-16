// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBJ6vgHCboEyeFh_YMohMhLk1fK4Wn8ZeY",
    authDomain: "sistema-vipizza.firebaseapp.com",
    projectId: "sistema-vipizza",
    storageBucket: "sistema-vipizza.firebasestorage.app",
    messagingSenderId: "923759550793",
    appId: "1:923759550793:web:39d49aeef741d8a74d7a98"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Exporta db para usarlo en otros scripts
export { db };
