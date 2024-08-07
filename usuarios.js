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

function showAddUsuarioForm() {
    document.getElementById('addUsuarioForm').style.display = 'block';
    document.getElementById('usuariosContainer').style.display = 'none';
    document.getElementById('sucursalesContainer').style.display = 'none';
    loadSucursales();
}

function showUsuarios() {
    document.getElementById('addUsuarioForm').style.display = 'none';
    document.getElementById('usuariosContainer').style.display = 'block';
    document.getElementById('sucursalesContainer').style.display = 'none';
    loadUsuarios();
}

function showSucursales() {
    document.getElementById('addUsuarioForm').style.display = 'none';
    document.getElementById('usuariosContainer').style.display = 'none';
    document.getElementById('sucursalesContainer').style.display = 'block';
    loadSucursalesList();
}

function toggleSucursalSelect() {
    var role = document.getElementById('usuarioRole').value;
    document.getElementById('sucursalSelect').style.display = (role === 'encargado') ? 'block' : 'none';
}

async function addUsuario() {
    try {
        var usuarioName = document.getElementById('usuarioName').value;
        var usuarioPassword = document.getElementById('usuarioPassword').value;
        var usuarioRole = document.getElementById('usuarioRole').value;
        var sucursalId = document.getElementById('sucursalSelect').value;

        if (!usuarioName || !usuarioPassword || (usuarioRole === 'encargado' && !sucursalId)) throw new Error('Todos los campos son obligatorios');

        var permisos = {
            crearProveedores: document.getElementById('permisoCrearProveedores').checked,
            editarProveedores: document.getElementById('permisoEditarProveedores').checked,
            eliminarProveedores: document.getElementById('permisoEliminarProveedores').checked,
            crearFacturas: document.getElementById('permisoCrearFacturas').checked,
            editarFacturas: document.getElementById('permisoEditarFacturas').checked,
            eliminarFacturas: document.getElementById('permisoEliminarFacturas').checked,
            crearPagos: document.getElementById('permisoCrearPagos').checked,
            editarPagos: document.getElementById('permisoEditarPagos').checked,
            eliminarPagos: document.getElementById('permisoEliminarPagos').checked,
            generarReportes: document.getElementById('permisoGenerarReportes').checked,
            exportarReportes: document.getElementById('permisoExportarReportes').checked
        };

        await db.collection('usuarios').add({
            name: usuarioName,
            password: usuarioPassword,
            role: usuarioRole,
            sucursalId: usuarioRole === 'encargado' ? sucursalId : null,
            permisos: permisos
        });
        document.getElementById('usuarioName').value = '';
        document.getElementById('usuarioPassword').value = '';
        showUsuarios();
    } catch (error) {
        console.error('Error al agregar usuario:', error);
        alert('Error al agregar usuario: ' + error.message);
    }
}

async function loadUsuarios() {
    try {
        var usuariosSnapshot = await db.collection('usuarios').get();
        var usuariosList = document.getElementById('usuariosList');
        usuariosList.innerHTML = '';

        usuariosSnapshot.forEach(function(doc) {
            var usuario = doc.data();
            var listItem = document.createElement('li');
            listItem.textContent = `Nombre: ${usuario.name}, Rol: ${usuario.role}, Sucursal: ${usuario.sucursalId ? usuario.sucursalId : 'N/A'}`;
            usuariosList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        alert('Error al cargar usuarios: ' + error.message);
    }
}

async function loadSucursalesList() {
    try {
        var sucursalesSnapshot = await db.collection('sucursales').get();
        var sucursalesList = document.getElementById('sucursalesList');
        sucursalesList.innerHTML = '';

        sucursalesSnapshot.forEach(function(doc) {
            var sucursal = doc.data();
            var listItem = document.createElement('li');
            listItem.textContent = `Nombre: ${sucursal.name}, Empresa ID: ${sucursal.empresaId}`;
            sucursalesList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error al cargar sucursales:', error);
        alert('Error al cargar sucursales: ' + error.message);
    }
}

async function loadSucursales() {
    try {
        var sucursalesSnapshot = await db.collection('sucursales').get();
        var sucursalSelect = document.getElementById('sucursalSelect');
        sucursalSelect.innerHTML = '';

        sucursalesSnapshot.forEach(function(doc) {
            var sucursal = doc.data();
            var option = document.createElement('option');
            option.value = doc.id;
            option.textContent = sucursal.name;
            sucursalSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar sucursales:', error);
        alert('Error al cargar sucursales: ' + error.message);
    }
}
