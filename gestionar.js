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

function showProviders() {
  document.getElementById('providersContainer').style.display = 'block';
  document.getElementById('productsContainer').style.display = 'none';
  loadProviders();
}

function showProducts() {
  document.getElementById('providersContainer').style.display = 'none';
  document.getElementById('productsContainer').style.display = 'block';
  loadProviderOptions(); // Cargar proveedores para filtro en productos
  loadProducts(); // Cargar productos
}

function showAddProviderForm() {
  document.getElementById('addProviderModal').style.display = 'block';
}

function showAddProductForm() {
  document.getElementById('addProductModal').style.display = 'block';
  loadProviderOptions(); // Cargar proveedores en el dropdown
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

async function addProvider() {
  try {
      var providerName = document.getElementById('providerName').value;
      var providerAddress = document.getElementById('providerAddress').value;
      var providerPhone = document.getElementById('providerPhone').value;
      var providerEmail = document.getElementById('providerEmail').value;
      var providerPaymentTerms = document.getElementById('providerPaymentTerms').value;
      var sellerName = document.getElementById('sellerName').value;
      var sellerPhone = document.getElementById('sellerPhone').value;
      var chiefSellerName = document.getElementById('chiefSellerName').value;
      var chiefSellerPhone = document.getElementById('chiefSellerPhone').value;
      var creditPersonName = document.getElementById('creditPersonName').value;
      var creditPersonPhone = document.getElementById('creditPersonPhone').value;
      var providerType = document.getElementById('providerType').value;
      var preferredPaymentMethod = document.getElementById('preferredPaymentMethod').value;
      var additionalNotes = document.getElementById('additionalNotes').value;

      if (!providerName) throw new Error('El nombre del proveedor no puede estar vacío');

      await db.collection('providers').add({
          name: providerName,
          address: providerAddress,
          phone: providerPhone,
          email: providerEmail,
          paymentTerms: providerPaymentTerms,
          sellerName: sellerName,
          sellerPhone: sellerPhone,
          chiefSellerName: chiefSellerName,
          chiefSellerPhone: chiefSellerPhone,
          creditPersonName: creditPersonName,
          creditPersonPhone: creditPersonPhone,
          type: providerType,
          preferredPaymentMethod: preferredPaymentMethod,
          additionalNotes: additionalNotes
      });

      closeModal('addProviderModal');
      loadProviders();
  } catch (error) {
      console.error('Error al agregar proveedor:', error);
      alert('Error al agregar proveedor: ' + error.message);
  }
}

async function loadProviders() {
  try {
      var providersSnapshot = await db.collection('providers').get();
      var providersTableBody = document.getElementById('providersTable').getElementsByTagName('tbody')[0];

      providersTableBody.innerHTML = '';

      providersSnapshot.forEach(function(doc) {
          var provider = doc.data();
          var row = providersTableBody.insertRow();
          var cell1 = row.insertCell(0);
          var cell2 = row.insertCell(1);
          cell1.textContent = provider.name;
          cell2.innerHTML = `
              <button onclick="viewProviderDetails('${doc.id}')">Ver Detalles</button>
              <button onclick="showEditProviderForm('${doc.id}')">Editar</button>
              <button onclick="deleteProvider('${doc.id}')">Eliminar</button>`;
      });
  } catch (error) {
      console.error('Error al cargar proveedores:', error);
      alert('Error al cargar proveedores: ' + error.message);
  }
}

async function viewProviderDetails(id) {
  try {
      var doc = await db.collection('providers').doc(id).get();
      if (doc.exists) {
          var provider = doc.data();
          var details = `
              Nombre: ${provider.name}<br>
              Dirección: ${provider.address}<br>
              Teléfono: ${provider.phone}<br>
              Correo Electrónico: ${provider.email}<br>
              Términos de Pago: ${provider.paymentTerms}<br>
              Nombre del Vendedor: ${provider.sellerName}<br>
              Teléfono del Vendedor: ${provider.sellerPhone}<br>
              Nombre del Jefe del Vendedor: ${provider.chiefSellerName}<br>
              Teléfono del Jefe del Vendedor: ${provider.chiefSellerPhone}<br>
              Nombre de la Persona de Créditos: ${provider.creditPersonName}<br>
              Teléfono de la Persona de Créditos: ${provider.creditPersonPhone}<br>
              Tipo de Proveedor: ${provider.type}<br>
              Método de Pago Preferido: ${provider.preferredPaymentMethod}<br>
              Notas Adicionales: ${provider.additionalNotes}<br>
          `;
          document.getElementById('providerDetails').innerHTML = details;
          document.getElementById('providerDetailsModal').style.display = 'block';
      } else {
          alert('No se encontraron detalles del proveedor.');
      }
  } catch (error) {
      console.error('Error al obtener detalles del proveedor:', error);
      alert('Error al obtener detalles del proveedor: ' + error.message);
  }
}

async function showEditProviderForm(id) {
  try {
      var doc = await db.collection('providers').doc(id).get();
      if (doc.exists) {
          var provider = doc.data();
          document.getElementById('editProviderId').value = id;
          document.getElementById('editProviderName').value = provider.name;
          document.getElementById('editProviderAddress').value = provider.address;
          document.getElementById('editProviderPhone').value = provider.phone;
          document.getElementById('editProviderEmail').value = provider.email;
          document.getElementById('editProviderPaymentTerms').value = provider.paymentTerms;
          document.getElementById('editSellerName').value = provider.sellerName;
          document.getElementById('editSellerPhone').value = provider.sellerPhone;
          document.getElementById('editChiefSellerName').value = provider.chiefSellerName;
          document.getElementById('editChiefSellerPhone').value = provider.chiefSellerPhone;
          document.getElementById('editCreditPersonName').value = provider.creditPersonName;
          document.getElementById('editCreditPersonPhone').value = provider.creditPersonPhone;
          document.getElementById('editProviderType').value = provider.type;
          document.getElementById('editPreferredPaymentMethod').value = provider.preferredPaymentMethod;
          document.getElementById('editAdditionalNotes').value = provider.additionalNotes;
          document.getElementById('editProviderModal').style.display = 'block';
      } else {
          alert('Proveedor no encontrado.');
      }
  } catch (error) {
      console.error('Error al cargar datos del proveedor:', error);
      alert('Error al cargar datos del proveedor: ' + error.message);
  }
}

async function updateProvider() {
  try {
      var id = document.getElementById('editProviderId').value;
      var updatedProvider = {
          name: document.getElementById('editProviderName').value,
          address: document.getElementById('editProviderAddress').value,
          phone: document.getElementById('editProviderPhone').value,
          email: document.getElementById('editProviderEmail').value,
          paymentTerms: document.getElementById('editProviderPaymentTerms').value,
          sellerName: document.getElementById('editSellerName').value,
          sellerPhone: document.getElementById('editSellerPhone').value,
          chiefSellerName: document.getElementById('editChiefSellerName').value,
          chiefSellerPhone: document.getElementById('editChiefSellerPhone').value,
          creditPersonName: document.getElementById('editCreditPersonName').value,
          creditPersonPhone: document.getElementById('editCreditPersonPhone').value,
          type: document.getElementById('editProviderType').value,
          preferredPaymentMethod: document.getElementById('editPreferredPaymentMethod').value,
          additionalNotes: document.getElementById('editAdditionalNotes').value
      };

      await db.collection('providers').doc(id).update(updatedProvider);

      closeModal('editProviderModal');
      loadProviders();
  } catch (error) {
      console.error('Error al actualizar proveedor:', error);
      alert('Error al actualizar proveedor: ' + error.message);
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

async function loadProviderOptions() {
  try {
      var providerSelect = document.getElementById('providerSelect');
      var providerFilterSelect = document.getElementById('productProviderFilter');
      providerSelect.innerHTML = ''; // Limpiar el dropdown antes de cargar los proveedores
      providerFilterSelect.innerHTML = '<option value="">Todos los Proveedores</option>'; // Limpiar y resetear el filtro de proveedor

      var providersSnapshot = await db.collection('providers').get();
      providersSnapshot.forEach(function(doc) {
          var provider = doc.data();
          var option = document.createElement('option');
          option.value = doc.id;
          option.textContent = provider.name;
          providerSelect.appendChild(option);
          providerFilterSelect.appendChild(option.cloneNode(true));
      });
  } catch (error) {
      console.error('Error al cargar proveedores en el dropdown:', error);
      alert('Error al cargar proveedores en el dropdown: ' + error.message);
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

      closeModal('addProductModal');
      loadProducts(); // Cargar la lista de productos inmediatamente después de agregar uno nuevo
  } catch (error) {
      console.error('Error al agregar producto:', error);
      alert('Error al agregar producto: ' + error.message);
  }
}

async function loadProducts() {
  try {
      var productsSnapshot = await db.collection('products').get();
      var productsTableBody = document.getElementById('productsTable').getElementsByTagName('tbody')[0];

      productsTableBody.innerHTML = '';

      for (let doc of productsSnapshot.docs) {
          let product = doc.data();
          let providerDoc = await db.collection('providers').doc(product.providerId).get();
          let providerName = providerDoc.exists ? providerDoc.data().name : 'Proveedor no encontrado';

          let row = productsTableBody.insertRow();
          row.setAttribute('data-provider-id', product.providerId); // Añadir el ID del proveedor como atributo de la fila
          let cell1 = row.insertCell(0);
          let cell2 = row.insertCell(1);
          let cell3 = row.insertCell(2);
          let cell4 = row.insertCell(3);

          cell1.textContent = product.name;
          cell2.textContent = product.presentation;
          cell3.textContent = providerName;
          cell4.innerHTML = `
              <button onclick="viewProductDetails('${doc.id}')">Ver Detalles</button>
              <button onclick="showEditProductForm('${doc.id}')">Editar</button>
              <button onclick="deleteProduct('${doc.id}')">Eliminar</button>`;
      }
  } catch (error) {
      console.error('Error al cargar productos:', error);
      alert('Error al cargar productos: ' + error.message);
  }
}

async function viewProductDetails(id) {
  try {
      var doc = await db.collection('products').doc(id).get();
      if (doc.exists) {
          var product = doc.data();
          var providerDoc = await db.collection('providers').doc(product.providerId).get();
          var providerName = providerDoc.exists ? providerDoc.data().name : 'Proveedor no encontrado';

          var details = `
              Nombre: ${product.name}<br>
              Presentación: ${product.presentation}<br>
              Proveedor: ${providerName}<br>
          `;
          document.getElementById('productDetails').innerHTML = details;
          document.getElementById('productDetailsModal').style.display = 'block';
      } else {
          alert('No se encontraron detalles del producto.');
      }
  } catch (error) {
      console.error('Error al obtener detalles del producto:', error);
      alert('Error al obtener detalles del producto: ' + error.message);
  }
}

async function showEditProductForm(id) {
  try {
      var doc = await db.collection('products').doc(id).get();
      if (doc.exists) {
          var product = doc.data();
          document.getElementById('editProductId').value = id;
          document.getElementById('editProductName').value = product.name;
          document.getElementById('editProductPresentation').value = product.presentation;
          document.getElementById('editProductModal').style.display = 'block';
      } else {
          alert('Producto no encontrado.');
      }
  } catch (error) {
      console.error('Error al cargar datos del producto:', error);
      alert('Error al cargar datos del producto: ' + error.message);
  }
}

async function updateProduct() {
  try {
      var id = document.getElementById('editProductId').value;
      var updatedProduct = {
          name: document.getElementById('editProductName').value,
          presentation: document.getElementById('editProductPresentation').value
      };

      await db.collection('products').doc(id).update(updatedProduct);

      closeModal('editProductModal');
      loadProducts();
  } catch (error) {
      console.error('Error al actualizar producto:', error);
      alert('Error al actualizar producto: ' + error.message);
  }
}

async function deleteProduct(id) {
  if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      try {
          await db.collection('products').doc(id).delete();
          loadProducts();
      } catch (error) {
          console.error('Error al eliminar producto:', error);
          alert('Error al eliminar producto: ' + error.message);
      }
  }
}

function filterProviders() {
  var input, filter, table, tr, td, i, txtValue;
  input = document.getElementById('providerSearchInput');
  filter = input.value.toUpperCase();
  table = document.getElementById('providersTable');
  tr = table.getElementsByTagName('tr');

  for (i = 1; i < tr.length; i++) { // Empieza en 1 para omitir el encabezado
      td = tr[i].getElementsByTagName('td')[0];
      if (td) {
          txtValue = td.textContent || td.innerText;
          if (txtValue.toUpperCase().indexOf(filter) > -1) {
              tr[i].style.display = '';
          } else {
              tr[i].style.display = 'none';
          }
      }       
  }
}

function filterProductsByName() {
  var input, filter, table, tr, td, i, txtValue;
  input = document.getElementById('productSearchInput');
  filter = input.value.toUpperCase();
  table = document.getElementById('productsTable');
  tr = table.getElementsByTagName('tr');

  for (i = 1; i < tr.length; i++) { // Empieza en 1 para omitir el encabezado
      td = tr[i].getElementsByTagName('td')[0];
      if (td) {
          txtValue = td.textContent || td.innerText;
          if (txtValue.toUpperCase().indexOf(filter) > -1) {
              tr[i].style.display = '';
          } else {
              tr[i].style.display = 'none';
          }
      }       
  }
}

function filterProductsByProvider() {
  var select, filter, table, tr, i, txtValue;
  select = document.getElementById('productProviderFilter');
  filter = select.value;
  table = document.getElementById('productsTable');
  tr = table.getElementsByTagName('tr');

  for (i = 1; i < tr.length; i++) { // Empieza en 1 para omitir el encabezado
      txtValue = tr[i].getAttribute('data-provider-id');
      if (filter === '' || txtValue === filter) {
          tr[i].style.display = '';
      } else {
          tr[i].style.display = 'none';
      }
  }
}
