// Importar jsPDF desde el objeto global
const { jsPDF } = window.jspdf;

let db;
let sucursales = [];
let selectedSucursal = null;
let receiptId = null;

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBNalkMiZuqQ-APbvRQC2MmF_hACQR0F3M",
  authDomain: "logisticdb-2e63c.firebaseapp.com",
  projectId: "logisticdb-2e63c",
  storageBucket: "logisticdb-2e63c.appspot.com",
  messagingSenderId: "917523682093",
  appId: "1:917523682093:web:6b03fcce4dd509ecbe79a4"
};
firebase.initializeApp(firebaseConfig);
db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('receiptCreationContainer').style.display = 'none';
  document.getElementById('savedReceiptsContainer').style.display = 'none';
  loadSavedReceipts();
});

/* Inicializar un nuevo recibo */
async function initNewReceipt() {
  document.getElementById('receiptCreationContainer').style.display = 'block';
  document.getElementById('savedReceiptsContainer').style.display = 'none';
  resetReceiptForm();
  await loadSucursales();
  await generateReceiptId();
}

/* Cargar sucursales desde Firebase */
async function loadSucursales() {
  try {
    const snap = await db.collection('sucursales').get();
    sucursales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `Error al cargar sucursales: ${error.message}`
    });
  }
}

/* Seleccionar una sucursal usando SweetAlert2 */
async function selectSucursal() {
  if (sucursales.length === 0) {
    await loadSucursales();
  }

  const sucursalOptions = sucursales.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

  const { value: sucursalId } = await Swal.fire({
    title: 'Seleccionar Sucursal',
    html: `
      <select id="swal-sucursal-select" class="swal2-select">
        <option value="" disabled selected>-- Selecciona una Sucursal --</option>
        ${sucursalOptions}
      </select>
    `,
    focusConfirm: false,
    preConfirm: () => {
      const select = document.getElementById('swal-sucursal-select');
      return select.value;
    }
  });

  if (sucursalId) {
    selectedSucursal = sucursales.find(s => s.id === sucursalId);
    document.getElementById('selectedSucursal').textContent = selectedSucursal.name;
  }
}

/* Generar un ID de recibo incremental */
async function generateReceiptId() {
  try {
    const counterRef = db.collection('config').doc('counters');
    await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      if (!counterDoc.exists) {
        transaction.set(counterRef, { lastReceiptId: 1 });
        receiptId = 1;
      } else {
        const currentId = counterDoc.data().lastReceiptId || 0;
        receiptId = currentId + 1;
        transaction.update(counterRef, { lastReceiptId: receiptId });
      }
    });
    document.getElementById('receiptId').textContent = receiptId;
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `Error al generar el ID del recibo: ${error.message}`
    });
  }
}

/* Reiniciar el formulario de recibo */
function resetReceiptForm() {
  selectedSucursal = null;
  document.getElementById('selectedSucursal').textContent = '';
  document.getElementById('receiptId').textContent = 'Generando...';
  document.getElementById('receiptTable').querySelector('tbody').innerHTML = '';
  document.getElementById('total').textContent = '0.00';
}

/* Agregar un producto usando SweetAlert2 */
async function addProduct() {
  const { value: formValues } = await Swal.fire({
    title: 'Agregar Producto',
    html:
      '<input id="swal-prod-name" class="swal2-input" placeholder="Nombre del Producto">' +
      '<input id="swal-prod-unit" class="swal2-input" placeholder="Medida (e.g., Unidad, Libra)">' +
      '<input id="swal-prod-price" type="number" min="0" step="0.01" class="swal2-input" placeholder="Precio Unitario (Q)">' +
      '<input id="swal-prod-quantity" type="number" min="1" class="swal2-input" placeholder="Cantidad">',
    focusConfirm: false,
    preConfirm: () => {
      const name = document.getElementById('swal-prod-name').value.trim();
      const unit = document.getElementById('swal-prod-unit').value.trim();
      const price = parseFloat(document.getElementById('swal-prod-price').value);
      const quantity = parseInt(document.getElementById('swal-prod-quantity').value);
      if (!name || !unit || isNaN(price) || isNaN(quantity) || price < 0 || quantity < 1) {
        Swal.showValidationMessage('Por favor, completa todos los campos correctamente.');
        return false;
      }
      return { name, unit, price, quantity };
    }
  });

  if (formValues) {
    const { name, unit, price, quantity } = formValues;
    const tbody = document.getElementById('receiptTable').querySelector('tbody');
    const row = tbody.insertRow();

    // Producto
    const cell1 = row.insertCell(0);
    cell1.textContent = name;

    // Medida
    const cell2 = row.insertCell(1);
    cell2.textContent = unit;

    // Precio Unitario
    const cell3 = row.insertCell(2);
    cell3.textContent = price.toFixed(2);

    // Cantidad
    const cell4 = row.insertCell(3);
    cell4.style.textAlign = 'center';
    cell4.textContent = quantity;

    // Total
    const total = price * quantity;
    const cell5 = row.insertCell(4);
    cell5.style.textAlign = 'right';
    cell5.textContent = total.toFixed(2);

    // Acciones
    const cell6 = row.insertCell(5);
    cell6.innerHTML = `
      <button class="action-button edit-button" onclick="editProduct(this)">
        <i class="fas fa-edit"></i>
      </button>
      <button class="action-button delete-button" onclick="deleteProductRow(this)">
        <i class="fas fa-trash-alt"></i>
      </button>
    `;

    updateTotal();
  }
}

/* Editar un producto usando SweetAlert2 */
async function editProduct(button) {
  const row = button.parentNode.parentNode;
  const currentName = row.cells[0].textContent;
  const currentUnit = row.cells[1].textContent;
  const currentPrice = parseFloat(row.cells[2].textContent);
  const currentQuantity = parseInt(row.cells[3].textContent);

  const { value: formValues } = await Swal.fire({
    title: 'Editar Producto',
    html:
      `<input id="swal-prod-name" class="swal2-input" placeholder="Nombre del Producto" value="${escapeHtml(currentName)}">` +
      `<input id="swal-prod-unit" class="swal2-input" placeholder="Medida (e.g., Unidad, Libra)" value="${escapeHtml(currentUnit)}">` +
      `<input id="swal-prod-price" type="number" min="0" step="0.01" class="swal2-input" placeholder="Precio Unitario (Q)" value="${currentPrice}">` +
      `<input id="swal-prod-quantity" type="number" min="1" class="swal2-input" placeholder="Cantidad" value="${currentQuantity}">`,
    focusConfirm: false,
    preConfirm: () => {
      const name = document.getElementById('swal-prod-name').value.trim();
      const unit = document.getElementById('swal-prod-unit').value.trim();
      const price = parseFloat(document.getElementById('swal-prod-price').value);
      const quantity = parseInt(document.getElementById('swal-prod-quantity').value);
      if (!name || !unit || isNaN(price) || isNaN(quantity) || price < 0 || quantity < 1) {
        Swal.showValidationMessage('Por favor, completa todos los campos correctamente.');
        return false;
      }
      return { name, unit, price, quantity };
    }
  });

  if (formValues) {
    const { name, unit, price, quantity } = formValues;
    row.cells[0].textContent = name;
    row.cells[1].textContent = unit;
    row.cells[2].textContent = price.toFixed(2);
    row.cells[3].textContent = quantity;
    row.cells[4].textContent = (price * quantity).toFixed(2);
    updateTotal();
  }
}

/* Eliminar una fila de producto */
function deleteProductRow(button) {
  const row = button.parentNode.parentNode;
  row.parentNode.removeChild(row);
  updateTotal();
}

/* Actualizar el total */
function updateTotal() {
  const tbody = document.getElementById('receiptTable').querySelector('tbody');
  let totalAmount = 0;

  Array.from(tbody.rows).forEach(row => {
    const price = parseFloat(row.cells[2].textContent) || 0;
    const quantity = parseInt(row.cells[3].textContent) || 0;
    const total = price * quantity;
    row.cells[4].textContent = total.toFixed(2);
    totalAmount += total;
  });

  document.getElementById('total').textContent = totalAmount.toFixed(2);
}

/* Guardar el nuevo recibo en Firebase */
async function saveNewReceipt() {
  if (!selectedSucursal) {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'Por favor, selecciona una sucursal.'
    });
    return;
  }

  const receiptDate = new Date().toISOString().split('T')[0];
  const total = parseFloat(document.getElementById('total').textContent);

  const tbody = document.getElementById('receiptTable').querySelector('tbody');
  const rows = tbody.getElementsByTagName('tr');
  const products = [];

  for (let i = 0; i < rows.length; i++) {
    const productName = rows[i].cells[0].textContent.trim();
    const unit = rows[i].cells[1].textContent.trim();
    const price = parseFloat(rows[i].cells[2].textContent);
    const quantity = parseInt(rows[i].cells[3].textContent);
    const totalProduct = parseFloat(rows[i].cells[4].textContent);

    if (!productName || !unit || isNaN(price) || isNaN(quantity)) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'Por favor, completa todos los campos de los productos correctamente.'
      });
      return;
    }

    products.push({
      name: productName,
      unit: unit,
      price: price,
      quantity: quantity,
      total: totalProduct
    });
  }

  if (products.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'Por favor, agrega al menos un producto al recibo.'
    });
    return;
  }

  try {
    const receiptData = {
      receiptId: receiptId,
      sucursalId: selectedSucursal.id,
      sucursalName: selectedSucursal.name,
      receiptDate,
      products,
      total,
      saveDate: receiptDate,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('receipts').add(receiptData);

    Swal.fire({
      icon: 'success',
      title: 'Recibo Guardado',
      text: `El recibo ha sido guardado exitosamente con ID: ${docRef.id}`
    });
    resetReceiptForm();
    document.getElementById('receiptCreationContainer').style.display = 'none';
    loadSavedReceipts();
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `Error al guardar el recibo: ${error.message}`
    });
  }
}

/* Cargar recibos guardados desde Firebase */
async function loadSavedReceipts() {
  try {
    const snap = await db.collection('receipts').orderBy('timestamp', 'desc').get();
    const tbody = document.getElementById('savedReceiptsTable').querySelector('tbody');
    tbody.innerHTML = '';

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5">No hay recibos guardados.</td></tr>';
      return;
    }

    snap.forEach(doc => {
      const data = doc.data();
      const row = tbody.insertRow();
      row.setAttribute('data-id', doc.id);

      const c1 = row.insertCell(0);
      const c2 = row.insertCell(1);
      const c3 = row.insertCell(2);
      const c4 = row.insertCell(3);
      const c5 = row.insertCell(4);

      c1.textContent = data.receiptId;
      c2.textContent = data.sucursalName;
      c3.textContent = data.receiptDate;
      c4.textContent = data.total.toFixed(2);
      c5.innerHTML = `
        <button class="action-button view-button" onclick="viewReceipt('${doc.id}')">
          <i class="fas fa-eye"></i>
        </button>
        <button class="action-button delete-button" onclick="deleteReceipt('${doc.id}')">
          <i class="fas fa-trash-alt"></i>
        </button>
      `;
    });
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `Error al cargar los recibos: ${error.message}`
    });
  }
}

/* Ver un recibo específico */
async function viewReceipt(docId) {
  try {
    const docRef = await db.collection('receipts').doc(docId).get();
    if (!docRef.exists) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El recibo no existe.'
      });
      return;
    }

    const data = docRef.data();

    // Mostrar los detalles del recibo en un modal
    Swal.fire({
      title: `Recibo ID: ${data.receiptId}`,
      html: `
        <p><strong>Sucursal:</strong> ${escapeHtml(data.sucursalName)}</p>
        <p><strong>Fecha:</strong> ${data.receiptDate}</p>
        <h3>Productos:</h3>
        <table border="1" style="width: 100%; text-align: left;">
          <tr>
            <th>Producto</th>
            <th>Medida</th>
            <th>Precio Unitario (Q)</th>
            <th style="text-align: center;">Cantidad</th>
            <th style="text-align: right;">Total (Q)</th>
          </tr>
          ${data.products.map(p => `
            <tr>
              <td>${escapeHtml(p.name)}</td>
              <td>${escapeHtml(p.unit)}</td>
              <td>Q${p.price.toFixed(2)}</td>
              <td style="text-align: center;">${p.quantity}</td>
              <td style="text-align: right;">Q${p.total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>
        <p style="text-align: right;"><strong>Total:</strong> Q${data.total.toFixed(2)}</p>
      `,
      icon: 'info',
      showCloseButton: true,
      focusConfirm: false,
      confirmButtonText: 'Cerrar'
    });
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `Error al obtener el recibo: ${error.message}`
    });
  }
}

/* Eliminar un recibo */
async function deleteReceipt(docId) {
  Swal.fire({
    title: '¿Estás seguro?',
    text: 'Esto eliminará el recibo permanentemente.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await db.collection('receipts').doc(docId).delete();
        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'El recibo ha sido eliminado.'
        });
        loadSavedReceipts();
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Error al eliminar el recibo: ${error.message}`
        });
      }
    }
  });
}

/* Generar PDF del recibo */
function generatePDF() {
  if (!selectedSucursal || !receiptId) {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'Por favor, selecciona una sucursal y asegúrate de que el recibo esté correctamente configurado.'
    });
    return;
  }

  const sucursalName = document.getElementById('selectedSucursal').textContent;
  const receiptDate = new Date().toISOString().split('T')[0];
  const total = document.getElementById('total').textContent;

  const tbody = document.getElementById('receiptTable').querySelector('tbody');
  const rows = tbody.getElementsByTagName('tr');
  let productsHTML = '';

  for (let i = 0; i < rows.length; i++) {
    const productName = rows[i].cells[0].textContent.trim();
    const unit = rows[i].cells[1].textContent.trim();
    const price = parseFloat(rows[i].cells[2].textContent).toFixed(2);
    const quantity = parseInt(rows[i].cells[3].textContent);
    const totalProduct = parseFloat(rows[i].cells[4].textContent).toFixed(2);

    productsHTML += `
      <tr>
        <td>${escapeHtml(productName)}</td>
        <td>${escapeHtml(unit)}</td>
        <td>Q${price}</td>
        <td style="text-align: center;">${quantity}</td>
        <td style="text-align: right;">Q${totalProduct}</td>
      </tr>
    `;
  }

  const receiptHTML = `
    <div style="text-align: center;">
      <img src="logo.png" alt="Logo" style="width: 200px;" />
      <h1>Recibo</h1>
      <h2>No. Recibo: ${receiptId}</h2>
      <h3>Sucursal: ${escapeHtml(sucursalName)}</h3>
      <p>Fecha: ${receiptDate}</p>
      <table border="1" style="width: 100%; text-align: left;">
        <tr>
          <th>Producto</th>
          <th>Medida</th>
          <th>Precio Unitario (Q)</th>
          <th style="text-align: center;">Cantidad</th>
          <th style="text-align: right;">Total (Q)</th>
        </tr>
        ${productsHTML}
      </table>
      <p style="text-align: right;"><strong>Total:</strong> Q${total}</p>
    </div>
  `;

  const doc = new jsPDF();

  doc.html(receiptHTML, {
    callback: function (doc) {
      doc.save(`Recibo_${receiptId}_${sucursalName}_${receiptDate}.pdf`);
    },
    x: 10,
    y: 10
  });
}

/* Generar Imagen del recibo */
function generateImage() {
  if (!selectedSucursal || !receiptId) {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: 'Por favor, selecciona una sucursal y asegúrate de que el recibo esté correctamente configurado.'
    });
    return;
  }

  const sucursalName = document.getElementById('selectedSucursal').textContent;
  const receiptDate = new Date().toISOString().split('T')[0];
  const total = document.getElementById('total').textContent;

  const tbody = document.getElementById('receiptTable').querySelector('tbody');
  const rows = tbody.getElementsByTagName('tr');
  let productsHTML = '';

  for (let i = 0; i < rows.length; i++) {
    const productName = rows[i].cells[0].textContent.trim();
    const unit = rows[i].cells[1].textContent.trim();
    const price = parseFloat(rows[i].cells[2].textContent).toFixed(2);
    const quantity = parseInt(rows[i].cells[3].textContent);
    const totalProduct = parseFloat(rows[i].cells[4].textContent).toFixed(2);

    productsHTML += `
      <tr>
        <td>${escapeHtml(productName)}</td>
        <td>${escapeHtml(unit)}</td>
        <td>Q${price}</td>
        <td style="text-align: center;">${quantity}</td>
        <td style="text-align: right;">Q${totalProduct}</td>
      </tr>
    `;
  }

  // Llenar el ticket oculto
  document.getElementById('imgReceiptId').textContent = receiptId;
  document.getElementById('imgSucursalName').textContent = sucursalName;
  document.getElementById('imgReceiptDate').textContent = receiptDate;
  document.getElementById('imgProductsTableBody').innerHTML = productsHTML;
  document.getElementById('imgTotal').textContent = total;

  const ticket = document.getElementById('receiptDetailsForImage');
  ticket.style.display = 'block';
  ticket.style.left = '50%';
  ticket.style.transform = 'translateX(-50%)';

  html2canvas(ticket, { scale: 2 })
    .then(canvas => {
      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Recibo_${receiptId}_${sucursalName}_${receiptDate}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          Swal.fire({
            icon: 'success',
            title: 'Imagen Exportada',
            text: 'El recibo ha sido exportado como imagen exitosamente.'
          });

          setupReceiptAfterExport();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al generar la imagen.'
          });
        }
      }, 'image/jpeg', 0.95);

      ticket.style.display = 'none';
      ticket.style.left = '-9999px';
    })
    .catch(err => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al exportar la imagen.'
      });
      ticket.style.display = 'none';
      ticket.style.left = '-9999px';
    });
}

/* Configurar después de exportar */
function setupReceiptAfterExport() {
  resetReceiptForm();
  document.getElementById('receiptCreationContainer').style.display = 'none';
}

/* Mostrar la sección de recibos guardados */
function showSavedReceipts() {
  document.getElementById('receiptCreationContainer').style.display = 'none';
  document.getElementById('savedReceiptsContainer').style.display = 'block';
  loadSavedReceipts();
}

/* Función para escapar caracteres HTML */
function escapeHtml(str) {
  if (!str) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, m => map[m]);
}
