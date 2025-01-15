/**********************************************************
 * CONFIGURACIÓN DE FIREBASE
 **********************************************************/
const firebaseConfig = {
  apiKey: "AIzaSyBNalkMiZuqQ-APbvRQC2MmF_hACQR0F3M",
  authDomain: "logisticdb-2e63c.firebaseapp.com",
  projectId: "logisticdb-2e63c",
  storageBucket: "logisticdb-2e63c.appspot.com",
  messagingSenderId: "917523682093",
  appId: "1:917523682093:web:6b03fcce4dd509ecbe79a4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/**********************************************************
 * VARIABLES GLOBALES
 **********************************************************/
let userSucursalId = null;
let loggedInUsername = null;
let userRole = null;
let userPermissions = {};
let logoBase64 = "";

/**********************************************************
 * DOMContentLoaded
 **********************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  await initUserAndSucursal();

  if (userRole === "administrador") {
    document.getElementById("adminFilterContainer").style.display = "block";
    loadSucursalesForAdmin();
    loadProvidersForAdmin();
  }

  loadPendingOrdersAdmin();
  loadInProcessOrdersAdmin();
  loadCompletedOrdersAdmin();

  loadLogo();
});

/**********************************************************
 * initUserAndSucursal
 **********************************************************/
async function initUserAndSucursal() {
  loggedInUsername = localStorage.getItem("usuarioLogueado");
  if (!loggedInUsername) {
    Swal.fire({
      icon: "warning",
      title: "No hay usuario logueado",
      text: "Redirigiendo a la pantalla de login..."
    }).then(() => {
      window.location.href = "login.html";
    });
    return;
  }

  const loggedInUserDiv = document.getElementById("loggedInUser");
  if (loggedInUserDiv) {
    loggedInUserDiv.textContent = "Usuario: " + loggedInUsername;
  }

  try {
    const snap = await db
      .collection("usuarios")
      .where("username", "==", loggedInUsername)
      .limit(1)
      .get();

    if (snap.empty) {
      Swal.fire({
        icon: "error",
        title: "Usuario no encontrado",
        text: "Inicia sesión nuevamente."
      }).then(() => {
        window.location.href = "login.html";
      });
      return;
    }
    const userData = snap.docs[0].data();
    userSucursalId = userData.sucursalId;
    userRole = userData.rol;
    userPermissions = userData.permisos || {};
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * loadSucursalesForAdmin
 **********************************************************/
async function loadSucursalesForAdmin() {
  const sel = document.getElementById("sucursalFilter");
  sel.innerHTML = `<option value="all">Todas las sucursales</option>`;
  try {
    const snap = await db.collection("sucursales").get();
    snap.forEach(doc => {
      const data = doc.data();
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.textContent = data.name;
      sel.appendChild(opt);
    });
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * loadProvidersForAdmin
 **********************************************************/
async function loadProvidersForAdmin() {
  const sel = document.getElementById("providerFilter");
  sel.innerHTML = `<option value="all">Todos los Proveedores</option>`;
  try {
    const ordersSnap = await db.collection("orders").get();
    const uniqueProviders = new Set();
    ordersSnap.forEach(doc => {
      const data = doc.data();
      if (data.providerName) {
        uniqueProviders.add(data.providerName);
      }
    });
    uniqueProviders.forEach(provider => {
      const opt = document.createElement("option");
      opt.value = provider;
      opt.textContent = provider;
      sel.appendChild(opt);
    });
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * reloadOrders
 **********************************************************/
function reloadOrders() {
  loadPendingOrdersAdmin();
  loadInProcessOrdersAdmin();
  loadCompletedOrdersAdmin();
}

/**********************************************************
 * loadLogo (si usas PDF)
 **********************************************************/
function loadLogo() {
  const img = new Image();
  img.src = "logo.png";
  img.crossOrigin = "Anonymous";
  img.onload = function () {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    logoBase64 = canvas.toDataURL("image/png");
  };
}

/**********************************************************
 * openTab / goToMainMenu
 **********************************************************/
function openTab(evt, tabName) {
  const tabcontent = document.getElementsByClassName("container");
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  const tablinks = document.getElementsByClassName("tab-button");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.className += " active";
}

function goToMainMenu() {
  window.location.href = "INDEX.html";
}

/**********************************************************
 * buildOrderQuery(estado)
 * -> (Sigue tu lógica de buscar ID, filtrar sucursal, etc.)
 **********************************************************/
function buildOrderQuery(estado) {
  const idSearch = document.getElementById("idSearchInput")?.value?.trim();
  if (idSearch) {
    // Búsqueda EXACT MATCH con orderId como string
    return db
      .collection("orders")
      .where("orderId", "==", idSearch)
      .where("status", "==", estado);
  }

  let query = db.collection("orders").where("status", "==", estado);

  if (userRole === "administrador") {
    const selSuc = document.getElementById("sucursalFilter").value;
    if (selSuc !== "all") {
      query = query.where("sucursalId", "==", selSuc);
    }
    const selProv = document.getElementById("providerFilter").value;
    if (selProv !== "all") {
      query = query.where("providerName", "==", selProv);
    }
  } else {
    query = query.where("sucursalId", "==", userSucursalId);
  }

  const sortValue = document.getElementById("sortOrder")?.value || "masReciente";
  if (sortValue === "masReciente") {
    query = query.orderBy("timestamp", "desc");
  } else {
    query = query.orderBy("timestamp", "asc");
  }

  return query;
}

/**********************************************************
 * loadPendingOrdersAdmin
 **********************************************************/
async function loadPendingOrdersAdmin() {
  try {
    const query = buildOrderQuery("pending");
    const snap = await query.get();

    const cont = document.getElementById("pendingOrdersAdminCards");
    cont.innerHTML = "";

    snap.forEach(doc => {
      const order = doc.data();
      const card = createOrderCard(doc.id, order, "pending");
      cont.appendChild(card);
    });
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * loadInProcessOrdersAdmin
 **********************************************************/
async function loadInProcessOrdersAdmin() {
  try {
    const idSearch = document.getElementById("idSearchInput")?.value?.trim();
    const cont = document.getElementById("inProcessOrdersAdminCards");
    cont.innerHTML = "";

    const inProcessStatuses = ["pedidoTomado","caminoABodega","pedidoEnBodega","caminoATienda"];

    if (idSearch) {
      const snap = await db
        .collection("orders")
        .where("orderId", "==", idSearch)
        .get();
      snap.forEach(doc => {
        const o = doc.data();
        if (inProcessStatuses.includes(o.status)) {
          const card = createOrderCard(doc.id, o, "inProcess");
          cont.appendChild(card);
        }
      });
      return;
    }

    let query = db.collection("orders")
      .where("status", "in", inProcessStatuses);

    if (userRole === "administrador") {
      const selSuc = document.getElementById("sucursalFilter").value;
      if (selSuc !== "all") {
        query = query.where("sucursalId", "==", selSuc);
      }
      const selProv = document.getElementById("providerFilter").value;
      if (selProv !== "all") {
        query = query.where("providerName", "==", selProv);
      }
    } else {
      query = query.where("sucursalId", "==", userSucursalId);
    }

    const sortValue = document.getElementById("sortOrder")?.value || "masReciente";
    if (sortValue === "masReciente") {
      query = query.orderBy("timestamp", "desc");
    } else {
      query = query.orderBy("timestamp", "asc");
    }

    const snap = await query.get();
    snap.forEach(doc => {
      const order = doc.data();
      const card = createOrderCard(doc.id, order, "inProcess");
      cont.appendChild(card);
    });

  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * loadCompletedOrdersAdmin
 **********************************************************/
async function loadCompletedOrdersAdmin() {
  try {
    const query = buildOrderQuery("completed");
    const snap = await query.get();

    const cont = document.getElementById("completedOrdersAdminCards");
    cont.innerHTML = "";

    snap.forEach(doc => {
      const order = doc.data();
      const card = createOrderCard(doc.id, order, "completed");
      cont.appendChild(card);
    });
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * createOrderCard
 **********************************************************/
function createOrderCard(orderDocId, order, status) {
  const card = document.createElement("div");
  card.className = "order-card";

  let html = `
    <h3>Pedido ID: ${order.orderId}</h3>
    <p>Proveedor: ${order.providerName}</p>
    <p>Sucursal: ${order.sucursalName}</p>
    <p>Fecha: ${order.orderDate}</p>
    <div class="order-status">
      ${generateProgressBar(order.status)}
    </div>
    <button onclick="showOrderDetails('${orderDocId}')">Mostrar Pedido</button>
  `;

  // Pending => no "Cambiar Estado", solo "Pedido Tomado"
  if (status === "pending") {
    html += `<button onclick="markOrderAsTaken('${orderDocId}')">Pedido Tomado</button>`;
    if (userRole === "administrador" || userPermissions.canEditOrder) {
      html += `<button onclick="editOrder('${orderDocId}')">Editar Pedido</button>`;
    }
  } else {
    // No pending => Cambiar Estado
    if (userRole === "administrador" || userPermissions.canChangeStatus) {
      html += `<button onclick="openChangeStatusModal('${orderDocId}')">Cambiar Estado</button>`;
    }
    if (status === "inProcess") {
      html += `<button onclick="markOrderAsCompleted('${orderDocId}')">Marcar como Completado</button>`;
    }
  }

  if (status === "completed") {
    html += `<button onclick="showReceivedOrder('${orderDocId}')">Mostrar Pedido Recibido</button>`;
  }

  // Exportar
  html += `<button onclick="exportOrder('${orderDocId}')">Exportar Pedido</button>`;

  // Eliminar
  if (userRole === "administrador" || userPermissions.canDeleteOrder) {
    html += `<button onclick="deleteOrder('${orderDocId}')">Eliminar Pedido</button>`;
  }

  // Ingresar Cantidades => en proceso
  const inProcessArray = ["pedidoTomado","caminoABodega","pedidoEnBodega","caminoATienda"];
  if (inProcessArray.includes(order.status)) {
    html += `<button onclick="confirmOrder('${orderDocId}')">Ingresar Cantidades Recibidas</button>`;
  }

  card.innerHTML = html;
  return card;
}

/**********************************************************
 * generateProgressBar
 **********************************************************/
function generateProgressBar(currentStatus) {
  const statuses = [
    { key: "pending", label: "Pendiente" },
    { key: "pedidoTomado", label: "Pedido Tomado" },
    { key: "caminoABodega", label: "Camino a Bodega" },
    { key: "pedidoEnBodega", label: "Pedido en Bodega" },
    { key: "caminoATienda", label: "Camino a Tienda" },
    { key: "completed", label: "Completado" }
  ];
  const currentIndex = statuses.findIndex(s => s.key === currentStatus);

  let progressHTML = `<div class="progress-container">`;
  statuses.forEach((st, idx) => {
    let stepClass = "";
    if (idx < currentIndex) stepClass = "completed";
    else if (idx === currentIndex) stepClass = "current";

    progressHTML += `
      <div class="progress-step ${stepClass}">
        <div class="step-number">${idx+1}</div>
        <div class="step-label">${st.label}</div>
      </div>
    `;
    if (idx < statuses.length - 1) {
      progressHTML += `<div class="progress-line ${idx < currentIndex ? "completed" : ""}"></div>`;
    }
  });
  progressHTML += `</div>`;
  return progressHTML;
}

/**********************************************************
 * markOrderAsTaken
 **********************************************************/
async function markOrderAsTaken(orderId) {
  Swal.fire({
    title: "¿Marcar como 'Pedido Tomado'?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "Cancelar"
  }).then(async res => {
    if (res.isConfirmed) {
      try {
        await db.collection("orders").doc(orderId).update({ status: "pedidoTomado" });
        Swal.fire({ icon: "success", title: "Estado cambiado" });
        reloadOrders();
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}

/**********************************************************
 * markOrderAsCompleted
 **********************************************************/
async function markOrderAsCompleted(orderId) {
  Swal.fire({
    title: "¿Marcar como completado?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "Cancelar"
  }).then(async res => {
    if (res.isConfirmed) {
      try {
        await db.collection("orders").doc(orderId).update({ status: "completed" });
        Swal.fire({ icon: "success", title: "Pedido completado" });
        reloadOrders();
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}

/**********************************************************
 * openChangeStatusModal / closeChangeStatusModal
 **********************************************************/
function openChangeStatusModal(orderId) {
  if (!(userRole === "administrador" || userPermissions.canChangeStatus)) {
    Swal.fire({ icon: "warning", title: "Sin Permiso" });
    return;
  }
  const modal = document.getElementById("changeStatusModal");
  modal.style.display = "block";
  modal.dataset.orderId = orderId;
}

function closeChangeStatusModal() {
  const modal = document.getElementById("changeStatusModal");
  modal.style.display = "none";
  modal.dataset.orderId = "";
}

async function changeOrderStatusManually(newStatus) {
  const modal = document.getElementById("changeStatusModal");
  const orderId = modal.dataset.orderId;
  if (!orderId) {
    Swal.fire({ icon: "error", title: "Error", text: "Pedido no identificado." });
    return;
  }
  try {
    await db.collection("orders").doc(orderId).update({ status: newStatus });
    Swal.fire({ icon: "success", title: "Estado cambiado" });
    closeChangeStatusModal();
    reloadOrders();
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * deleteOrder
 **********************************************************/
async function deleteOrder(orderId) {
  Swal.fire({
    title: "¿Eliminar Pedido?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "Cancelar"
  }).then(async res => {
    if (res.isConfirmed) {
      try {
        await db.collection("orders").doc(orderId).delete();
        Swal.fire({ icon: "success", title: "Pedido eliminado" });
        reloadOrders();
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}

/**********************************************************
 * showOrderDetails / closeOrderDetailsModal
 **********************************************************/
function showOrderDetails(orderId) {
  db.collection("orders").doc(orderId).get()
    .then(docRef => {
      if (!docRef.exists) {
        Swal.fire({ icon: "error", title: "No encontrado" });
        return;
      }
      const order = docRef.data();
      let html = `
        <p><strong>ID Pedido:</strong> ${order.orderId}</p>
        <p><strong>Proveedor:</strong> ${order.providerName}</p>
        <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
        <p><strong>Fecha de Pedido:</strong> ${order.orderDate}</p>
        <table>
          <thead>
            <tr><th>Producto</th><th>Presentación</th><th>Cantidad</th></tr>
          </thead>
          <tbody>
      `;
      order.products.forEach(p => {
        html += `
          <tr>
            <td>${p.name}</td>
            <td>${p.presentation}</td>
            <td>${p.quantity}</td>
          </tr>
        `;
      });
      html += `</tbody></table>`;

      document.getElementById("orderDetails").innerHTML = html;
      document.getElementById("orderDetailsModal").style.display = "block";
      document.getElementById("exportOrderId").value = orderId;
    })
    .catch(err => {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    });
}

function closeOrderDetailsModal() {
  document.getElementById("orderDetails").innerHTML = "";
  document.getElementById("orderDetailsModal").style.display = "none";
}

/**********************************************************
 * editOrder / closeEditOrderModal / addProductRow / saveEditedOrder
 **********************************************************/
function editOrder(orderId) {
  db.collection("orders").doc(orderId).get()
    .then(doc => {
      if (!doc.exists) {
        Swal.fire({ icon: "error", title: "Pedido no encontrado" });
        return;
      }
      const order = doc.data();
      let formHTML = `
        <input type="hidden" id="editOrderId" value="${orderId}">
        <p><strong>ID Pedido:</strong> ${order.orderId}</p>
        <p><strong>Proveedor:</strong> ${order.providerName}</p>
        <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
        <p><strong>Fecha de Pedido:</strong> 
          <input type="date" id="editOrderDate" value="${order.orderDate}">
        </p>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Presentación</th>
              <th>Cantidad</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody id="editOrderProducts">
      `;
      order.products.forEach((prod, idx) => {
        formHTML += `
          <tr>
            <td><input type="text" id="editProductName${idx}" value="${prod.name}"></td>
            <td><input type="text" id="editProductPresentation${idx}" value="${prod.presentation}"></td>
            <td><input type="number" id="editProductQuantity${idx}" value="${prod.quantity}" min="1"></td>
            <td><button onclick="deleteProductRow(${idx})">Eliminar</button></td>
          </tr>
        `;
      });
      formHTML += `
          </tbody>
        </table>
        <button onclick="addProductRow()">Agregar Producto</button><br><br>
        <button onclick="saveEditedOrder()">Guardar Cambios</button>
      `;

      document.getElementById("editOrderDetails").innerHTML = formHTML;
      document.getElementById("editOrderModal").style.display = "block";
    })
    .catch(error => {
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    });
}

function closeEditOrderModal() {
  document.getElementById("editOrderDetails").innerHTML = "";
  document.getElementById("editOrderModal").style.display = "none";
}

function addProductRow() {
  const index = document.querySelectorAll("#editOrderProducts tr").length;
  const row = `
    <tr>
      <td><input type="text" id="editProductName${index}"></td>
      <td><input type="text" id="editProductPresentation${index}"></td>
      <td><input type="number" id="editProductQuantity${index}" min="1"></td>
      <td><button onclick="deleteProductRow(${index})">Eliminar</button></td>
    </tr>
  `;
  document.getElementById("editOrderProducts").insertAdjacentHTML("beforeend", row);
}

function deleteProductRow(index) {
  const row = document.querySelector(`#editOrderProducts tr:nth-child(${index+1})`);
  if (row) {
    row.remove();
  }
}

async function saveEditedOrder() {
  const orderId = document.getElementById("editOrderId").value;
  const orderDate = document.getElementById("editOrderDate").value;
  const rows = document.querySelectorAll("#editOrderProducts tr");
  const products = [];

  rows.forEach((tr, idx) => {
    const n = document.getElementById(`editProductName${idx}`)?.value?.trim();
    const pr = document.getElementById(`editProductPresentation${idx}`)?.value?.trim();
    const q = parseInt(document.getElementById(`editProductQuantity${idx}`)?.value, 10);

    products.push({
      name: n,
      presentation: pr,
      quantity: isNaN(q) ? 0 : q
    });
  });

  // Validar
  for (let i = 0; i < products.length; i++) {
    if (!products[i].name || !products[i].presentation || products[i].quantity <= 0) {
      Swal.fire({
        icon: "error",
        title: "Campos Inválidos",
        text: `Revisa producto #${i+1}`
      });
      return;
    }
  }

  try {
    await db.collection("orders").doc(orderId).update({
      orderDate,
      products
    });
    Swal.fire({ icon: "success", title: "Pedido actualizado" });
    closeEditOrderModal();
    reloadOrders();
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * EXPORTAR (Imagen, PDF, Excel)
 **********************************************************/
function exportOrder(orderId) {
  document.getElementById("exportModal").style.display = "block";
  document.getElementById("exportModal").dataset.orderId = orderId;
}

function closeExportModal() {
  document.getElementById("exportModal").style.display = "none";
}

async function exportAs(format) {
  const modal = document.getElementById("exportModal");
  const orderId = modal.dataset.orderId;
  try {
    const doc = await db.collection("orders").doc(orderId).get();
    if (!doc.exists) {
      Swal.fire({ icon: "error", title: "Pedido no encontrado" });
      return;
    }
    const order = doc.data();
    const fileName = `Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;
    if (format === "image") {
      exportAsImage(order, fileName);
    } else if (format === "pdf") {
      exportAsPDF(order, fileName);
    } else if (format === "excel") {
      exportAsExcel(order, fileName);
    }
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error al exportar", text: error.message });
  }
  closeExportModal();
}

// Exportar como Imagen
function exportAsImage(order, fileName) {
  const div = document.createElement("div");
  div.style.padding = "20px";
  div.style.backgroundColor = "#fff";
  div.innerHTML = `
    <h2>Detalles del Pedido</h2>
    <p><strong>ID Pedido:</strong> ${order.orderId}</p>
    <p><strong>Proveedor:</strong> ${order.providerName}</p>
    <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
    <p><strong>Fecha:</strong> ${order.orderDate}</p>
    <table border="1" style="width:100%;">
      <thead>
        <tr><th>Producto</th><th>Presentación</th><th>Cantidad</th></tr>
      </thead>
      <tbody>
        ${order.products
          .map(
            (p) => `
          <tr>
            <td>${p.name}</td>
            <td>${p.presentation}</td>
            <td>${p.quantity}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
  document.body.appendChild(div);

  html2canvas(div).then(canvas => {
    const imgData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imgData;
    link.download = `${fileName}.png`;
    link.click();
    document.body.removeChild(div);
  });
}

// Exportar como PDF
function exportAsPDF(order, fileName) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 10, 10, 66, 20);
  }

  doc.setFontSize(16);
  doc.text(`Recibo de Pedido ID: ${order.orderId}`, 105, 35, { align: "center" });
  doc.setFontSize(12);
  doc.text(`Fecha: ${order.orderDate}`, 10, 55);
  doc.text(`Proveedor: ${order.providerName}`, 10, 65);
  doc.text(`Sucursal: ${order.sucursalName}`, 10, 75);

  const tableColumn = ["Producto", "Presentación", "Cantidad"];
  const tableRows = [];
  order.products.forEach((prod) => {
    tableRows.push([prod.name, prod.presentation, prod.quantity]);
  });

  doc.autoTable({
    startY: 85,
    head: [tableColumn],
    body: tableRows,
    theme: "striped",
    styles: { cellPadding: 3, fontSize: 10 },
    headStyles: { fillColor: [60, 141, 188] }
  });

  doc.save(`${fileName}.pdf`);
}

// Exportar como Excel
function exportAsExcel(order, fileName) {
  const wb = XLSX.utils.book_new();
  const ws_data = [
    ["ID Pedido", order.orderId],
    ["Proveedor", order.providerName],
    ["Sucursal", order.sucursalName],
    ["Fecha", order.orderDate],
    [],
    ["Producto", "Presentación", "Cantidad"]
  ];
  order.products.forEach((prod) => {
    ws_data.push([prod.name, prod.presentation, prod.quantity]);
  });
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Pedido");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**********************************************************
 * CONFIRMAR PEDIDO (INGRESAR CANTIDADES RECIBIDAS)
 **********************************************************/
async function confirmOrder(orderId) {
  try {
    const snap = await db.collection("orders").doc(orderId).get();
    if (!snap.exists) {
      Swal.fire({ icon: "error", title: "Pedido no encontrado" });
      return;
    }
    const order = snap.data();

    // 1) Rellenar info de Factura (si existe)
    const hasInvoiceNumber = order.invoiceNumber !== undefined && order.invoiceNumber !== null;
    document.getElementById("invoiceNumber").value = hasInvoiceNumber ? order.invoiceNumber : "";
    document.getElementById("invoiceDate").value = order.invoiceDate || "";

    // 2) Info general del pedido
    document.getElementById("confirmOrderId").value = orderId;
    document.getElementById("orderIdDisplay").textContent = order.orderId;
    document.getElementById("providerNameDisplay").textContent = order.providerName;
    document.getElementById("sucursalNameDisplay").textContent = order.sucursalName;
    document.getElementById("orderDateDisplay").textContent = order.orderDate;

    // 3) Generar filas en la tabla
    const tBody = document.getElementById("confirmOrderProducts");
    tBody.innerHTML = "";
    order.products.forEach((p, idx) => {
      // Buscar si hay un 'receivedProduct' guardado
      let rp = {};
      if (order.receivedProducts && order.receivedProducts[idx]) {
        rp = order.receivedProducts[idx];
      }
      // Rellenar inputs con los valores guardados, o vacío si no existen
      const receivedQty = rp.receivedQuantity !== undefined ? rp.receivedQuantity : "";
      const unitPrice = rp.unitPrice !== undefined ? rp.unitPrice : "";
      const totalProd = rp.totalPerProduct !== undefined ? rp.totalPerProduct.toFixed(2) : "0.00";
      const comments = rp.comments || "";

      tBody.insertAdjacentHTML("beforeend", `
        <tr>
          <td>${p.name}</td>
          <td>${p.presentation}</td>
          <td>${p.quantity}</td>
          <td>
            <input 
              type="number" 
              id="receivedQuantity${idx}" 
              min="0" 
              max="${p.quantity}" 
              placeholder="" 
              value="${receivedQty}"
            >
          </td>
          <td>
            <input 
              type="number" 
              id="unitPrice${idx}" 
              step="0.01" 
              min="0" 
              placeholder="" 
              value="${unitPrice}"
            >
          </td>
          <td>Q<span id="totalPerProduct${idx}">${totalProd}</span></td>
          <td><input type="text" id="productComments${idx}" value="${comments}" placeholder="Comentarios"></td>
        </tr>
      `);
    });

    // 4) Calcular total
    calculateInvoiceTotal(order.products.length);

    // 5) Agregar listeners para recalcular totales
    order.products.forEach((p, idx) => {
      const qInp = document.getElementById(`receivedQuantity${idx}`);
      const prInp = document.getElementById(`unitPrice${idx}`);

      qInp.addEventListener("input", () => {
        updateTotalPerProduct(idx, p.quantity);
      });
      prInp.addEventListener("input", () => {
        updateTotalPerProduct(idx, p.quantity);
      });
    });

    // 6) Mostrar modal
    document.getElementById("confirmOrderModal").style.display = "block";

  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

// Actualiza el total por producto
function updateTotalPerProduct(idx, maxQty) {
  const qInput = document.getElementById(`receivedQuantity${idx}`);
  const pInput = document.getElementById(`unitPrice${idx}`);
  const span = document.getElementById(`totalPerProduct${idx}`);

  let q = parseInt(qInput.value, 10);
  let price = parseFloat(pInput.value);

  if (isNaN(q) || q < 0) {
    q = 0;
    qInput.value = "";
  }
  if (q > maxQty) {
    q = maxQty;
    qInput.value = maxQty;
  }
  if (isNaN(price) || price < 0) {
    price = 0;
    pInput.value = "";
  }

  const total = q * price;
  span.textContent = total.toFixed(2);

  calculateInvoiceTotal(document.querySelectorAll("#confirmOrderProducts tr").length);
}

// Calcula total de la factura
function calculateInvoiceTotal(numRows) {
  let tot = 0;
  for (let i = 0; i < numRows; i++) {
    const val = parseFloat(document.getElementById(`totalPerProduct${i}`).textContent || "0");
    if (!isNaN(val)) {
      tot += val;
    }
  }
  document.getElementById("invoiceTotal").textContent = tot.toFixed(2);
}

/**********************************************************
 * saveConfirmedOrder
 * -> Este método ya guarda en doc: invoiceNumber, invoiceDate,
 *    receivedProducts[], invoiceTotal
 * -> Así la próxima vez, se mostrará al abrir confirmOrder()
 **********************************************************/
async function saveConfirmedOrder() {
  const orderId = document.getElementById("confirmOrderId").value;
  const invoiceNumberStr = document.getElementById("invoiceNumber").value.trim();
  const invoiceDate = document.getElementById("invoiceDate").value;

  if (!invoiceNumberStr) {
    Swal.fire({ icon: "error", title: "Número de Factura Vacío" });
    return;
  }
  const invoiceNumber = parseInt(invoiceNumberStr, 10);
  if (isNaN(invoiceNumber) || invoiceNumber <= 0) {
    Swal.fire({ icon: "error", title: "Número de Factura Inválido" });
    return;
  }
  if (!invoiceDate) {
    Swal.fire({ icon: "error", title: "Fecha de Factura Vacía" });
    return;
  }

  const rows = document.querySelectorAll("#confirmOrderProducts tr");
  const receivedProducts = [];
  for (let i = 0; i < rows.length; i++) {
    const tds = rows[i].getElementsByTagName("td");
    const maxQty = parseInt(tds[2].textContent, 10);

    const recvQty = parseInt(document.getElementById(`receivedQuantity${i}`).value || "0", 10);
    const price = parseFloat(document.getElementById(`unitPrice${i}`).value || "0");
    const subTotal = parseFloat(document.getElementById(`totalPerProduct${i}`).textContent || "0");
    const comments = document.getElementById(`productComments${i}`).value.trim();

    if (recvQty < 0 || recvQty > maxQty) {
      Swal.fire({
        icon: "error",
        title: "Cantidad Recibida Inválida",
        text: `La cantidad recibida para "${tds[0].textContent}" debe ser 0 - ${maxQty}`
      });
      return;
    }
    if (price < 0) {
      Swal.fire({
        icon: "error",
        title: "Precio Inválido",
        text: `El precio para "${tds[0].textContent}" debe ser >= 0.`
      });
      return;
    }

    receivedProducts.push({
      name: tds[0].textContent,
      presentation: tds[1].textContent,
      quantity: maxQty,
      receivedQuantity: isNaN(recvQty) ? 0 : recvQty,
      unitPrice: isNaN(price) ? 0 : price,
      totalPerProduct: isNaN(subTotal) ? 0 : subTotal,
      comments
    });
  }

  const invoiceTotal = parseFloat(document.getElementById("invoiceTotal").textContent || "0");

  try {
    await db.collection("orders").doc(orderId).update({
      invoiceNumber,
      invoiceDate,
      receivedProducts,
      invoiceTotal
    });
    Swal.fire({
      icon: "success",
      title: "Recepción Guardada",
      text: "Los datos se han guardado correctamente."
    });
    closeConfirmOrderModal();
    reloadOrders();
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

window.closeConfirmOrderModal = function() {
  document.getElementById("invoiceNumber").value = "";
  document.getElementById("invoiceDate").value = "";
  document.getElementById("confirmOrderId").value = "";
  document.getElementById("orderIdDisplay").textContent = "";
  document.getElementById("providerNameDisplay").textContent = "";
  document.getElementById("sucursalNameDisplay").textContent = "";
  document.getElementById("orderDateDisplay").textContent = "";
  document.getElementById("confirmOrderProducts").innerHTML = "";
  document.getElementById("invoiceTotal").textContent = "0.00";
  document.getElementById("confirmOrderModal").style.display = "none";
};
