// Inicializa Firebase
var firebaseConfig = {
    apiKey: "AIzaSyBNalkMiZuqQ-APbvRQC2MmF_hACQR0F3M",
    authDomain: "logisticdb-2e63c.firebaseapp.com",
    projectId: "logisticdb-2e63c",
    storageBucket: "logisticdb-2e63c.appspot.com",
    messagingSenderId: "917523682093",
    appId: "1:917523682093:web:6b03fcce4dd509ecbe79a4"
  };

firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

document.getElementById('loginForm').addEventListener('submit', login);

function toggleSucursalSelect() {
    var role = document.getElementById('usuarioRole').value;
    document.getElementById('sucursalSelect').style.display = (role === 'encargado') ? 'block' : 'none';
}

async function login(event) {
    event.preventDefault();
    var usuarioName = document.getElementById('usuarioName').value;
    var usuarioPassword = document.getElementById('usuarioPassword').value;
    var usuarioRole = document.getElementById('usuarioRole').value;
    var sucursalId = document.getElementById('sucursalSelect').value;

    try {
        var userCredential = await firebase.auth().signInWithEmailAndPassword(usuarioName, usuarioPassword);
        var user = userCredential.user;

        var userDoc = await db.collection('usuarios').doc(user.uid).get();
        if (!userDoc.exists) {
            throw new Error('Usuario no encontrado');
        }
        var userData = userDoc.data();

        if (userData.role !== usuarioRole) {
            throw new Error('Rol incorrecto');
        }

        if (usuarioRole === 'encargado' && userData.sucursalId !== sucursalId) {
            throw new Error('Sucursal incorrecta');
        }

        // Redireccionar según el rol
        if (usuarioRole === 'encargado') {
            window.location.href = `realizadPedido.html?sucursal=${sucursalId}`;
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        document.getElementById('error').textContent = error.message;
    }
}
