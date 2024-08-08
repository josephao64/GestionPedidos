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

function showEmpresas() {
    document.getElementById('empresasContainer').style.display = 'block';
    document.getElementById('sucursalesContainer').style.display = 'none';
    loadEmpresas();
}

function showSucursales() {
    document.getElementById('empresasContainer').style.display = 'none';
    document.getElementById('sucursalesContainer').style.display = 'block';
    loadEmpresasSelectOptions();
    loadSucursales();
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function addEmpresa() {
    try {
        var empresaName = document.getElementById('empresaName').value;
        var empresaAddress = document.getElementById('empresaAddress').value;
        var empresaPhone = document.getElementById('empresaPhone').value;
        var empresaEmail = document.getElementById('empresaEmail').value;
        var empresaCreationDate = document.getElementById('empresaCreationDate').value;
        var empresaDescription = document.getElementById('empresaDescription').value;
        var empresaStatus = document.getElementById('empresaStatus').value;

        if (!empresaName) throw new Error('El nombre de la empresa no puede estar vacío');

        await db.collection('empresas').add({
            name: empresaName,
            address: empresaAddress,
            phone: empresaPhone,
            email: empresaEmail,
            creationDate: empresaCreationDate,
            description: empresaDescription,
            status: empresaStatus
        });
        closeModal('addEmpresaModal');
        loadEmpresas();
        alert('Empresa agregada con éxito');
    } catch (error) {
        console.error('Error al agregar empresa:', error);
        alert('Error al agregar empresa: ' + error.message);
    }
}

async function updateEmpresa() {
    try {
        var id = document.getElementById('editEmpresaId').value;
        var empresaName = document.getElementById('editEmpresaName').value;
        var empresaAddress = document.getElementById('editEmpresaAddress').value;
        var empresaPhone = document.getElementById('editEmpresaPhone').value;
        var empresaEmail = document.getElementById('editEmpresaEmail').value;
        var empresaCreationDate = document.getElementById('editEmpresaCreationDate').value;
        var empresaDescription = document.getElementById('editEmpresaDescription').value;
        var empresaStatus = document.getElementById('editEmpresaStatus').value;

        if (!empresaName) throw new Error('El nombre de la empresa no puede estar vacío');

        await db.collection('empresas').doc(id).update({
            name: empresaName,
            address: empresaAddress,
            phone: empresaPhone,
            email: empresaEmail,
            creationDate: empresaCreationDate,
            description: empresaDescription,
            status: empresaStatus
        });
        closeModal('editEmpresaModal');
        loadEmpresas();
        alert('Empresa actualizada con éxito');
    } catch (error) {
        console.error('Error al actualizar empresa:', error);
        alert('Error al actualizar empresa: ' + error.message);
    }
}

async function addSucursal() {
    try {
        var sucursalName = document.getElementById('sucursalName').value;
        var sucursalAddress = document.getElementById('sucursalAddress').value;
        var sucursalPhone = document.getElementById('sucursalPhone').value;
        var sucursalEmail = document.getElementById('sucursalEmail').value;
        var sucursalCreationDate = document.getElementById('sucursalCreationDate').value;
        var sucursalEncargado = document.getElementById('sucursalEncargado').value;
        var sucursalDescription = document.getElementById('sucursalDescription').value;
        var sucursalStatus = document.getElementById('sucursalStatus').value;
        var empresaId = document.getElementById('empresaSelect').value;

        if (!sucursalName) throw new Error('El nombre de la sucursal no puede estar vacío');
        if (!empresaId) throw new Error('Debes seleccionar una empresa');

        await db.collection('sucursales').add({
            name: sucursalName,
            address: sucursalAddress,
            phone: sucursalPhone,
            email: sucursalEmail,
            creationDate: sucursalCreationDate,
            encargado: sucursalEncargado,
            description: sucursalDescription,
            status: sucursalStatus,
            empresaId: empresaId
        });
        closeModal('addSucursalModal');
        loadSucursales();
        alert('Sucursal agregada con éxito');
    } catch (error) {
        console.error('Error al agregar sucursal:', error);
        alert('Error al agregar sucursal: ' + error.message);
    }
}

async function updateSucursal() {
    try {
        var id = document.getElementById('editSucursalId').value;
        var sucursalName = document.getElementById('editSucursalName').value;
        var sucursalAddress = document.getElementById('editSucursalAddress').value;
        var sucursalPhone = document.getElementById('editSucursalPhone').value;
        var sucursalEmail = document.getElementById('editSucursalEmail').value;
        var sucursalCreationDate = document.getElementById('editSucursalCreationDate').value;
        var sucursalEncargado = document.getElementById('editSucursalEncargado').value;
        var sucursalDescription = document.getElementById('editSucursalDescription').value;
        var sucursalStatus = document.getElementById('editSucursalStatus').value;
        var empresaId = document.getElementById('editEmpresaSelect').value;

        if (!sucursalName) throw new Error('El nombre de la sucursal no puede estar vacío');

        await db.collection('sucursales').doc(id).update({
            name: sucursalName,
            address: sucursalAddress,
            phone: sucursalPhone,
            email: sucursalEmail,
            creationDate: sucursalCreationDate,
            encargado: sucursalEncargado,
            description: sucursalDescription,
            status: sucursalStatus,
            empresaId: empresaId
        });
        closeModal('editSucursalModal');
        loadSucursales();
        alert('Sucursal actualizada con éxito');
    } catch (error) {
        console.error('Error al actualizar sucursal:', error);
        alert('Error al actualizar sucursal: ' + error.message);
    }
}

async function loadEmpresas() {
    try {
        var empresasSnapshot = await db.collection('empresas').get();
        var empresasTableBody = document.getElementById('empresasTable').getElementsByTagName('tbody')[0];
        empresasTableBody.innerHTML = '';

        empresasSnapshot.forEach(function(doc) {
            var empresa = doc.data();
            var row = empresasTableBody.insertRow();
            var cell1 = row.insertCell(0);
            var cell2 = row.insertCell(1);
            var cell3 = row.insertCell(2);
            var cell4 = row.insertCell(3);
            var cell5 = row.insertCell(4);
            var cell6 = row.insertCell(5);
            var cell7 = row.insertCell(6);
            var cell8 = row.insertCell(7);
            cell1.textContent = empresa.name;
            cell2.textContent = empresa.address;
            cell3.textContent = empresa.phone;
            cell4.textContent = empresa.email;
            cell5.textContent = empresa.creationDate;
            cell6.textContent = empresa.description;
            cell7.textContent = empresa.status;
            cell8.innerHTML = `<button onclick="openEditEmpresaModal('${doc.id}', '${empresa.name}', '${empresa.address}', '${empresa.phone}', '${empresa.email}', '${empresa.creationDate}', '${empresa.description}', '${empresa.status}')">Editar</button>
                               <button onclick="deleteEmpresa('${doc.id}')">Eliminar</button>`;
        });

        var empresaFilterSelect = document.getElementById('empresaFilterSelect');
        empresaFilterSelect.innerHTML = '<option value="">Todas las empresas</option>';
        empresasSnapshot.forEach(function(doc) {
            var empresa = doc.data();
            var option = document.createElement('option');
            option.value = doc.id;
            option.textContent = empresa.name;
            empresaFilterSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error al cargar empresas:', error);
        alert('Error al cargar empresas: ' + error.message);
    }
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
            var cell4 = row.insertCell(3);
            var cell5 = row.insertCell(4);
            var cell6 = row.insertCell(5);
            var cell7 = row.insertCell(6);
            var cell8 = row.insertCell(7);
            var cell9 = row.insertCell(8);
            cell10 = row.insertCell(9);
            cell1.textContent = sucursal.name;
            cell2.textContent = sucursal.address;
            cell3.textContent = sucursal.phone;
            cell4.textContent = sucursal.email;
            cell5.textContent = sucursal.creationDate;
            cell6.textContent = sucursal.encargado;
            cell7.textContent = sucursal.description;
            cell8.textContent = sucursal.status;
            cell9.textContent = empresas[sucursal.empresaId] || 'N/A';
            cell10.innerHTML = `<button onclick="openEditSucursalModal('${doc.id}', '${sucursal.name}', '${sucursal.address}', '${sucursal.phone}', '${sucursal.email}', '${sucursal.creationDate}', '${sucursal.encargado}', '${sucursal.description}', '${sucursal.status}', '${sucursal.empresaId}')">Editar</button>
                                <button onclick="deleteSucursal('${doc.id}')">Eliminar</button>`;
        });
    } catch (error) {
        console.error('Error al cargar sucursales:', error);
        alert('Error al cargar sucursales: ' + error.message);
    }
}

function openEditEmpresaModal(id, name, address, phone, email, creationDate, description, status) {
    document.getElementById('editEmpresaId').value = id;
    document.getElementById('editEmpresaName').value = name;
    document.getElementById('editEmpresaAddress').value = address;
    document.getElementById('editEmpresaPhone').value = phone;
    document.getElementById('editEmpresaEmail').value = email;
    document.getElementById('editEmpresaCreationDate').value = creationDate;
    document.getElementById('editEmpresaDescription').value = description;
    document.getElementById('editEmpresaStatus').value = status;
    openModal('editEmpresaModal');
}

function openEditSucursalModal(id, name, address, phone, email, creationDate, encargado, description, status, empresaId) {
    document.getElementById('editSucursalId').value = id;
    document.getElementById('editSucursalName').value = name;
    document.getElementById('editSucursalAddress').value = address;
    document.getElementById('editSucursalPhone').value = phone;
    document.getElementById('editSucursalEmail').value = email;
    document.getElementById('editSucursalCreationDate').value = creationDate;
    document.getElementById('editSucursalEncargado').value = encargado;
    document.getElementById('editSucursalDescription').value = description;
    document.getElementById('editSucursalStatus').value = status;
    document.getElementById('editEmpresaSelect').value = empresaId;
    openModal('editSucursalModal');
}

async function deleteEmpresa(id) {
    if (confirm('¿Estás seguro de que deseas eliminar esta empresa?')) {
        try {
            await db.collection('empresas').doc(id).delete();
            loadEmpresas();
        } catch (error) {
            console.error('Error al eliminar empresa:', error);
            alert('Error al eliminar empresa: ' + error.message);
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

function openAddSucursalModal() {
    loadEmpresasSelectOptions();
    openModal('addSucursalModal');
}

async function loadEmpresasSelectOptions() {
    try {
        var empresasSnapshot = await db.collection('empresas').get();
        var empresaSelect = document.getElementById('empresaSelect');
        var editEmpresaSelect = document.getElementById('editEmpresaSelect');
        empresaSelect.innerHTML = '';
        editEmpresaSelect.innerHTML = '';

        empresasSnapshot.forEach(function(doc) {
            var empresa = doc.data();
            var option = document.createElement('option');
            option.value = doc.id;
            option.textContent = empresa.name;
            empresaSelect.appendChild(option);
            editEmpresaSelect.appendChild(option.cloneNode(true));
        });
    } catch (error) {
        console.error('Error al cargar opciones de empresas:', error);
        alert('Error al cargar opciones de empresas: ' + error.message);
    }
}
