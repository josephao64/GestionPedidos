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

function showAddEmpresaForm() {
    document.getElementById('addEmpresaForm').style.display = 'block';
    document.getElementById('addSucursalForm').style.display = 'none';
    document.getElementById('empresasContainer').style.display = 'none';
    document.getElementById('sucursalesContainer').style.display = 'none';
}

function showAddSucursalForm() {
    document.getElementById('addEmpresaForm').style.display = 'none';
    document.getElementById('addSucursalForm').style.display = 'block';
    document.getElementById('empresasContainer').style.display = 'none';
    document.getElementById('sucursalesContainer').style.display = 'none';
    loadEmpresas();
}

async function addEmpresa() {
    try {
        var empresaName = document.getElementById('empresaName').value;
        if (!empresaName) throw new Error('El nombre de la empresa no puede estar vacío');

        await db.collection('empresas').add({
            name: empresaName
        });
        document.getElementById('empresaName').value = '';
        alert('Empresa agregada con éxito');
    } catch (error) {
        console.error('Error al agregar empresa:', error);
        alert('Error al agregar empresa: ' + error.message);
    }
}

async function addSucursal() {
    try {
        var sucursalName = document.getElementById('sucursalName').value;
        var empresaId = document.getElementById('empresaSelect').value;

        if (!sucursalName) throw new Error('El nombre de la sucursal no puede estar vacío');
        if (!empresaId) throw new Error('Debes seleccionar una empresa');

        await db.collection('sucursales').add({
            name: sucursalName,
            empresaId: empresaId
        });
        document.getElementById('sucursalName').value = '';
        alert('Sucursal agregada con éxito');
        loadSucursales();
    } catch (error) {
        console.error('Error al agregar sucursal:', error);
        alert('Error al agregar sucursal: ' + error.message);
    }
}

async function loadEmpresas() {
    try {
        var empresasSnapshot = await db.collection('empresas').get();
        var empresaSelect = document.getElementById('empresaSelect');
        var empresaFilterSelect = document.getElementById('empresaFilterSelect');
        empresaSelect.innerHTML = '';
        empresaFilterSelect.innerHTML = '<option value="">Todas las empresas</option>';

        empresasSnapshot.forEach(function(doc) {
            var empresa = doc.data();
            var option = document.createElement('option');
            option.value = doc.id;
            option.textContent = empresa.name;
            empresaSelect.appendChild(option);
            empresaFilterSelect.appendChild(option.cloneNode(true));
        });
    } catch (error) {
        console.error('Error al cargar empresas:', error);
        alert('Error al cargar empresas: ' + error.message);
    }
}

async function showEmpresas() {
    document.getElementById('addEmpresaForm').style.display = 'none';
    document.getElementById('addSucursalForm').style.display = 'none';
    document.getElementById('empresasContainer').style.display = 'block';
    document.getElementById('sucursalesContainer').style.display = 'none';
    await loadEmpresas();
    displayEmpresas();
}

async function displayEmpresas() {
    try {
        var empresasSnapshot = await db.collection('empresas').get();
        var empresasTableBody = document.getElementById('empresasTable').getElementsByTagName('tbody')[0];
        empresasTableBody.innerHTML = '';

        empresasSnapshot.forEach(function(doc) {
            var empresa = doc.data();
            var row = empresasTableBody.insertRow();
            var cell1 = row.insertCell(0);
            var cell2 = row.insertCell(1);
            cell1.textContent = empresa.name;
            cell2.innerHTML = `<button onclick="editEmpresa('${doc.id}', '${empresa.name}')">Editar</button>
                               <button onclick="deleteEmpresa('${doc.id}')">Eliminar</button>`;
        });
    } catch (error) {
        console.error('Error al mostrar empresas:', error);
        alert('Error al mostrar empresas: ' + error.message);
    }
}

async function showSucursales() {
    document.getElementById('addEmpresaForm').style.display = 'none';
    document.getElementById('addSucursalForm').style.display = 'none';
    document.getElementById('empresasContainer').style.display = 'none';
    document.getElementById('sucursalesContainer').style.display = 'block';
    loadSucursales();
}

async function loadSucursales() {
    try {
        var empresaFilter = document.getElementById('empresaFilterSelect').value;
        var sucursalesQuery = empresaFilter ? db.collection('sucursales').where('empresaId', '==', empresaFilter) : db.collection('sucursales');
        var sucursalesSnapshot = await sucursalesQuery.get();
        var sucursalesTableBody = document.getElementById('sucursalesTable').getElementsByTagName('tbody')[0];
        sucursalesTableBody.innerHTML = '';

        var empresasSnapshot = await db.collection('empresas').get();
        var empresas = {};
        empresasSnapshot.forEach(function(doc) {
            empresas[doc.id] = doc.data().name;
        });

        sucursalesSnapshot.forEach(function(doc) {
            var sucursal = doc.data();
            var row = sucursalesTableBody.insertRow();
            var cell1 = row.insertCell(0);
            var cell2 = row.insertCell(1);
            var cell3 = row.insertCell(2);
            cell1.textContent = sucursal.name;
            cell2.textContent = empresas[sucursal.empresaId] || 'N/A';
            cell3.innerHTML = `<button onclick="editSucursal('${doc.id}', '${sucursal.name}', '${sucursal.empresaId}')">Editar</button>
                               <button onclick="deleteSucursal('${doc.id}')">Eliminar</button>`;
        });
    } catch (error) {
        console.error('Error al cargar sucursales:', error);
        alert('Error al cargar sucursales: ' + error.message);
    }
}

async function editSucursal(id, name, empresaId) {
    var newName = prompt('Editar nombre de la sucursal:', name);
    var newEmpresaId = prompt('Editar ID de la empresa:', empresaId);
    if (newName && newName !== name) {
        try {
            await db.collection('sucursales').doc(id).update({
                name: newName,
                empresaId: newEmpresaId
            });
            loadSucursales();
        } catch (error) {
            console.error('Error al editar sucursal:', error);
            alert('Error al editar sucursal: ' + error.message);
        }
    }
}

async function deleteSucursal(id) {
    if (confirm('¿Estás seguro de que deseas eliminar esta sucursal?')) {
        try {
            await db.collection('sucursales').doc(id).delete();
            loadSucursales();
        } catch (error) {
            console.error('Error al eliminar sucursal:', error);
            alert('Error al eliminar sucursal: ' + error.message);
        }
    }
}

async function editEmpresa(id, name) {
    var newName = prompt('Editar nombre de la empresa:', name);
    if (newName && newName !== name) {
        try {
            await db.collection('empresas').doc(id).update({
                name: newName
            });
            loadEmpresas();
            displayEmpresas();
        } catch (error) {
            console.error('Error al editar empresa:', error);
            alert('Error al editar empresa: ' + error.message);
        }
    }
}

async function deleteEmpresa(id) {
    if (confirm('¿Estás seguro de que deseas eliminar esta empresa?')) {
        try {
            await db.collection('empresas').doc(id).delete();
            loadEmpresas();
            displayEmpresas();
        } catch (error) {
            console.error('Error al eliminar empresa:', error);
            alert('Error al eliminar empresa: ' + error.message);
        }
    }
}
