// firebase-config.js

// Tu configuración de Firebase (reemplaza estos valores con los de tu proyecto)
const firebaseConfig = {
    apiKey: "AIzaSyDJyExQ_7i0GIeBh-Xn_ptmMCFj7IIcgYI",
    authDomain: "cafeteriadb-a050e.firebaseapp.com",
    projectId: "cafeteriadb-a050e",
    storageBucket: "cafeteriadb-a050e.firebasestorage.app",
    messagingSenderId: "382231744255",
    appId: "1:382231744255:web:c5564466d0db7ac351c6ca"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar Firestore
const db = firebase.firestore();
