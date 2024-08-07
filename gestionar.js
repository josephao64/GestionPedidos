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
  
  function showAddProviderForm() {
    document.getElementById('addProviderForm').style.display = 'block';
    document.getElementById('addProductForm').style.display = 'none';
    document.getElementById('providersContainer').style.display = 'none';
    document.getElementById('productsContainer').style.display = 'none';
  }
  
  function showAddProductForm() {
    document.getElementById('addProviderForm').style.display = 'none';
    document.getElementById('addProductForm').style.display = 'block';
    document.getElementById('providersContainer').style.display = 'none';
    document.getElementById('productsContainer').style.display = 'none';
    loadProviders();
  }
  
  async function addProvider() {
    try {
      var providerName = document.getElementById('providerName').value;
      if (!providerName) throw new Error('El nombre del proveedor no puede estar vacío');
  
      await db.collection('providers').add({
        name: providerName
      });
      document.getElementById('providerName').value = '';
      loadProviders();
    } catch (error) {
      console.error('Error al agregar proveedor:', error);
      alert('Error al agregar proveedor: ' + error.message);
    }
  }
  
  async function addProduct() {
    try {
      var productName = document.getElementById('productName').value;
      var productPresentation = document.getElementById('productPresentation').value;
      var providerSelect = document.getElementById('providerSelect');
      var providerId = providerSelect.value;
  
      if (!productName) throw new Error('El nombre del producto no puede estar vacío');
      if (!productPresentation) throw new Error('La presentación del producto no puede estar vacía');
      if (!providerId) throw new Error('Debes seleccionar un proveedor');
  
      await db.collection('products').add({
        name: productName,
        presentation: productPresentation,
        providerId: providerId
      });
      document.getElementById('productName').value = '';
      document.getElementById('productPresentation').value = '';
    } catch (error) {
      console.error('Error al agregar producto:', error);
      alert('Error al agregar producto: ' + error.message);
    }
  }
  
  async function loadProviders() {
    try {
      var providersSnapshot = await db.collection('providers').get();
      var providerSelect = document.getElementById('providerSelect');
      var providerProductsSelect = document.getElementById('providerProductsSelect');
      var providersTableBody = document.getElementById('providersTable').getElementsByTagName('tbody')[0];
  
      providerSelect.innerHTML = '';
      providerProductsSelect.innerHTML = '';
      providersTableBody.innerHTML = '';
  
      providersSnapshot.forEach(function(doc) {
        var provider = doc.data();
        var option = document.createElement('option');
        option.value = doc.id;
        option.textContent = provider.name;
        providerSelect.appendChild(option);
        providerProductsSelect.appendChild(option.cloneNode(true));
  
        var row = providersTableBody.insertRow();
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        cell1.textContent = provider.name;
        cell2.innerHTML = `<button onclick="editProvider('${doc.id}', '${provider.name}')">Editar</button>
                           <button onclick="deleteProvider('${doc.id}')">Eliminar</button>`;
      });
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      alert('Error al cargar proveedores: ' + error.message);
    }
  }
  
  async function showProviders() {
    document.getElementById('addProviderForm').style.display = 'none';
    document.getElementById('addProductForm').style.display = 'none';
    document.getElementById('providersContainer').style.display = 'block';
    document.getElementById('productsContainer').style.display = 'none';
    loadProviders();
  }
  
  async function showProducts() {
    document.getElementById('addProviderForm').style.display = 'none';
    document.getElementById('addProductForm').style.display = 'none';
    document.getElementById('providersContainer').style.display = 'none';
    document.getElementById('productsContainer').style.display = 'block';
    loadProviders();
    loadProducts();
  }
  
  async function loadProducts() {
    try {
      var providerId = document.getElementById('providerProductsSelect').value;
      var productsSnapshot = await db.collection('products').where('providerId', '==', providerId).get();
      var productsTableBody = document.getElementById('productsTable').getElementsByTagName('tbody')[0];
      productsTableBody.innerHTML = '';
  
      productsSnapshot.forEach(function(doc) {
        var product = doc.data();
        var row = productsTableBody.insertRow();
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        var cell3 = row.insertCell(2);
        cell1.textContent = product.name;
        cell2.textContent = product.presentation;
        cell3.innerHTML = `<button onclick="editProduct('${doc.id}', '${product.name}', '${product.presentation}')">Editar</button>
                           <button onclick="deleteProduct('${doc.id}')">Eliminar</button>`;
      });
    } catch (error) {
      console.error('Error al mostrar productos:', error);
      alert('Error al mostrar productos: ' + error.message);
    }
  }
  
  async function editProvider(id, name) {
    var newName = prompt('Editar nombre del proveedor:', name);
    if (newName && newName !== name) {
      try {
        await db.collection('providers').doc(id).update({ name: newName });
        loadProviders();
      } catch (error) {
        console.error('Error al editar proveedor:', error);
        alert('Error al editar proveedor: ' + error.message);
      }
    }
  }
  
  async function deleteProvider(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este proveedor?')) {
      try {
        await db.collection('providers').doc(id).delete();
        loadProviders();
      } catch (error) {
        console.error('Error al eliminar proveedor:', error);
        alert('Error al eliminar proveedor: ' + error.message);
      }
    }
  }
  
  async function editProduct(id, name, presentation) {
    var newName = prompt('Editar nombre del producto:', name);
    var newPresentation = prompt('Editar presentación del producto:', presentation);
    if ((newName && newName !== name) || (newPresentation && newPresentation !== presentation)) {
      try {
        await db.collection('products').doc(id).update({ name: newName, presentation: newPresentation });
        showProductsByProvider();
      } catch (error) {
        console.error('Error al editar producto:', error);
        alert('Error al editar producto: ' + error.message);
      }
    }
  }
  
  async function deleteProduct(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      try {
        await db.collection('products').doc(id).delete();
        showProductsByProvider();
      } catch (error) {
        console.error('Error al eliminar producto:', error);
        alert('Error al eliminar producto: ' + error.message);
      }
    }
  }
  