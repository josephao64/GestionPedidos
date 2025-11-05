// Archivo: database/connection.js
const firebaseConfig = {
    apiKey: "AIzaSyBNalkMiZuqQ-APbvRQC2MmF_hACQR0F3M",
    authDomain: "logisticdb-2e63c.firebaseapp.com",
    projectId: "logisticdb-2e63c",
    storageBucket: "logisticdb-2e63c.appspot.com", // Asegúrate que sea .appspot.com
    messagingSenderId: "917523682093",
    appId: "1:917523682093:web:6b03fcce4dd509ecbe79a4"
  };
  
  // Inicializar Firebase solo si no está inicializado
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  const db = firebase.firestore();
  
  // Configurar Firestore
  try {
    db.settings({
      cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
      ignoreUndefinedProperties: true
    });
  } catch (e) {
    console.warn('No se pudieron aplicar settings a Firestore:', e.message || e);
  }

  // Inicializar Storage (proteger si no se cargó el SDK de storage)
  let storage = null;
  try {
    storage = firebase.storage && firebase.storage();
  } catch (e) {
    console.warn('Firebase Storage no está disponible en este contexto:', e.message || e);
  }

  // Exponer variables globales para scripts no modulares
  window.firebase = window.firebase || firebase;
  window.db = window.db || db;
  window.storage = window.storage || storage;
