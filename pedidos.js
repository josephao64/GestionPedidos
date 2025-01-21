/********************************************************** 
 * CONFIGURACIÓN DE FIREBASE
 **********************************************************/
const firebaseConfig = {
  // Ajusta tus datos de configuración de Firebase
  apiKey: "AIzaSyBNalk...",
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

  // Si es administrador, se muestran y cargan filtros de sucursal/proveedor
  if (userRole === "administrador") {
    document.getElementById("adminFilterContainer").style.display = "block";
    loadSucursalesForAdmin();
    loadProvidersForAdmin();
  }

  // Cargar las secciones
  loadPendingOrdersAdmin();
  loadInProcessOrdersAdmin();
  loadCompletedOrdersAdmin();

  // Cargar el logo (opcional, si se usa en exportar PDF)
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
      text: "Redirigiendo a login..."
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
 * loadLogo (para PDF)
 **********************************************************/
function loadLogo() {
  const img = new Image();
  img.src = "logo.png"; // Ajusta la ruta a tu logo si lo deseas
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
 * loadPendingOrdersAdmin
 **********************************************************/
async function loadPendingOrdersAdmin() {
  try {
    const cont = document.getElementById("pendingOrdersAdminCards");
    cont.innerHTML = "";

    const idSearch = document.getElementById("idSearchInput")?.value?.trim();

    let query;
    if (idSearch) {
      query = db.collection("orders")
        .where("orderId", "==", idSearch)
        .where("status", "==", "pending");
    } else {
      query = db.collection("orders").where("status", "==", "pending");
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
      const card = createOrderCard(doc.id, order);
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
    const cont = document.getElementById("inProcessOrdersAdminCards");
    cont.innerHTML = "";

    const idSearch = document.getElementById("idSearchInput")?.value?.trim();
    const inProcessStatuses = [
      "pedidoTomado",
      "caminoABodega",
      "pedidoEnBodega",
      "caminoATienda",
      "enTiendaIncompleto"
    ];

    if (idSearch) {
      const snap = await db
        .collection("orders")
        .where("orderId", "==", idSearch)
        .get();
      snap.forEach(doc => {
        const order = doc.data();
        if (inProcessStatuses.includes(order.status)) {
          const card = createOrderCard(doc.id, order);
          cont.appendChild(card);
        }
      });
      return;
    }

    let query = db.collection("orders").where("status", "in", inProcessStatuses);

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
      const card = createOrderCard(doc.id, order);
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
    const cont = document.getElementById("completedOrdersAdminCards");
    cont.innerHTML = "";

    const idSearch = document.getElementById("idSearchInput")?.value?.trim();
    if (idSearch) {
      const snap = await db
        .collection("orders")
        .where("orderId", "==", idSearch)
        .where("status", "==", "completed")
        .get();
      snap.forEach(doc => {
        const order = doc.data();
        const card = createOrderCard(doc.id, order);
        cont.appendChild(card);
      });
      return;
    }

    let query = db.collection("orders").where("status", "==", "completed");

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
      const card = createOrderCard(doc.id, order);
      cont.appendChild(card);
    });
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * createOrderCard
 * Se removió la condición para "completed" en el botón
 * "Mostrar Pedido Recibido" para que aparezca SIEMPRE.
 **********************************************************/
function createOrderCard(orderDocId, order) {
  const card = document.createElement("div");
  card.className = "order-card";

  // Texto si faltan cantidades
  let mismatchText = "";
  if (order.mismatchedQuantities === true) {
    mismatchText = `<p style="color: red; font-weight: bold;">No se recibió la misma cantidad pedida</p>`;
  }

  // Texto si no hay factura
  let pendingInvoiceText = "";
  if (order.pendingInvoice === true) {
    pendingInvoiceText = `<p style="color: orange; font-weight: bold;">Pendiente de Factura</p>`;
  }

  // Comentario del motivo (si lo hay)
  let mismatchCommentHtml = "";
  if (order.mismatchComment) {
    mismatchCommentHtml = `
      <p style="color: #d9534f;">
        <strong>Comentario:</strong> ${order.mismatchComment}
      </p>
    `;
  }

  let html = `
    <h3>Pedido ID: ${order.orderId}</h3>
    <p>Proveedor: ${order.providerName}</p>
    <p>Sucursal: ${order.sucursalName}</p>
    <p>Fecha: ${order.orderDate}</p>
    ${mismatchText}
    ${pendingInvoiceText}
    ${mismatchCommentHtml}
    <div class="order-status">
      ${generateProgressBar(order.status)}
    </div>
    <button onclick="showOrderDetails('${orderDocId}')">Mostrar Pedido</button>
  `;

  // Editar
  if (userRole === "administrador" || userPermissions.canEditOrder) {
    html += `<button onclick="editOrder('${orderDocId}')">Editar Pedido</button>`;
  }

  // Exportar
  html += `<button onclick="exportOrder('${orderDocId}')">Exportar Pedido</button>`;

  // Eliminar
  if (userRole === "administrador" || userPermissions.canDeleteOrder) {
    html += `<button onclick="deleteOrder('${orderDocId}')">Eliminar Pedido</button>`;
  }

  // Botón "Marcar como Tomado" solo admin y estado pendiente
  if (order.status === "pending" && userRole === "administrador") {
    html += `<button onclick="markOrderAsTaken('${orderDocId}')">Marcar como Tomado</button>`;
  }

  const inProcessArray = [
    "pedidoTomado","caminoABodega","pedidoEnBodega","caminoATienda","enTiendaIncompleto"
  ];
  if (inProcessArray.includes(order.status)) {
    if (userRole === "administrador" || userPermissions.canChangeStatus) {
      html += `<button onclick="openChangeStatusModal('${orderDocId}')">Cambiar Estado</button>`;
    }
    // Al llegar a tienda o estar incompleto, podemos ingresar cantidades
    if (order.status === "caminoATienda" || order.status === "enTiendaIncompleto") {
      html += `<button onclick="confirmOrder('${orderDocId}')">Ingresar Cantidades</button>`;
    }
  }

  // SIEMPRE mostramos el botón "Mostrar Pedido Recibido"
  html += `<button onclick="showReceivedOrder('${orderDocId}')">Mostrar Pedido Recibido</button>`;

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
    { key: "enTiendaIncompleto", label: "En Tienda (Incompleto)" },
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
        <div class="step-number">${idx + 1}</div>
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
        Swal.fire({ icon: "success", title: "Estado cambiado a 'Pedido Tomado'" });
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
  const row = document.querySelector(`#editOrderProducts tr:nth-child(${index + 1})`);
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
        text: `Revisa producto #${i + 1}`
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

/**********************************************************
 * Exportar como Imagen
 **********************************************************/
function exportAsImage(order, fileName) {
  // 1) Rellenar contenedor oculto
  const hiddenDiv = document.getElementById("exportHiddenContainer");
  
  document.getElementById("exportOrderIdHidden").textContent = order.orderId;
  document.getElementById("exportProviderHidden").textContent = order.providerName;
  document.getElementById("exportSucursalHidden").textContent = order.sucursalName;
  document.getElementById("exportFechaHidden").textContent = order.orderDate;

  const tBody = document.getElementById("exportProductsTableBody");
  tBody.innerHTML = "";

  order.products.forEach(prod => {
    const row = document.createElement("tr");
    const tdName = document.createElement("td");
    const tdPres = document.createElement("td");
    const tdQty = document.createElement("td");
    tdName.textContent = prod.name;
    tdPres.textContent = prod.presentation;
    tdQty.textContent = prod.quantity;
    row.appendChild(tdName);
    row.appendChild(tdPres);
    row.appendChild(tdQty);
    tBody.appendChild(row);
  });

  // 2) Mostrarlo brevemente para que html2canvas lo "vea"
  hiddenDiv.style.display = "block";
  hiddenDiv.style.left = "50%";
  hiddenDiv.style.top = "50%";
  hiddenDiv.style.transform = "translate(-50%, -50%)";

  // 3) Generar imagen
  html2canvas(hiddenDiv, { scale: 2 })
    .then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      // Descargar
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `${fileName}.png`;
      link.click();
    })
    .catch(err => {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo exportar la imagen" });
      console.error(err);
    })
    .finally(() => {
      // 4) Ocultar contenedor de nuevo
      hiddenDiv.style.display = "none";
      hiddenDiv.style.left = "-9999px";
      hiddenDiv.style.top = "-9999px";
      hiddenDiv.style.transform = "none";
    });
}

/**********************************************************
 * Exportar como PDF
 **********************************************************/
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

/**********************************************************
 * Exportar como Excel
 **********************************************************/
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
 * confirmOrder
 **********************************************************/
async function confirmOrder(orderId) {
  try {
    const snap = await db.collection("orders").doc(orderId).get();
    if (!snap.exists) {
      Swal.fire({ icon: "error", title: "Pedido no encontrado" });
      return;
    }
    const order = snap.data();

    // Factura previa
    const hasInvoiceNumber = (order.invoiceNumber !== undefined && order.invoiceNumber !== null);
    document.getElementById("invoiceNumber").value = hasInvoiceNumber ? order.invoiceNumber : "";
    document.getElementById("invoiceDate").value = order.invoiceDate || "";
    document.getElementById("noInvoiceCheckbox").checked = !!order.pendingInvoice;

    // Info general
    document.getElementById("confirmOrderId").value = orderId;
    document.getElementById("orderIdDisplay").textContent = order.orderId;
    document.getElementById("providerNameDisplay").textContent = order.providerName;
    document.getElementById("sucursalNameDisplay").textContent = order.sucursalName;
    document.getElementById("orderDateDisplay").textContent = order.orderDate;

    // Generar filas
    const tBody = document.getElementById("confirmOrderProducts");
    tBody.innerHTML = "";
    order.products.forEach((p, idx) => {
      let rp = { receivedQuantity: "", unitPrice: "", totalPerProduct: 0, comments: "" };
      if (order.receivedProducts && order.receivedProducts[idx]) {
        rp = order.receivedProducts[idx];
      }
      const totalValue = rp.totalPerProduct ? Number(rp.totalPerProduct).toFixed(2) : "0.00";
      const receivedQty = rp.receivedQuantity !== undefined ? rp.receivedQuantity : "";
      const priceVal = rp.unitPrice !== undefined ? rp.unitPrice : "";
      const commentsVal = rp.comments || "";

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
              value="${receivedQty}"
            >
          </td>
          <td>
            <input
              type="number"
              id="unitPrice${idx}"
              step="0.01"
              min="0"
              value="${priceVal}"
            >
          </td>
          <td>Q<span id="totalPerProduct${idx}">${totalValue}</span></td>
          <td><input type="text" id="productComments${idx}" value="${commentsVal}" placeholder="Comentarios"></td>
        </tr>
      `);
    });

    calculateInvoiceTotal(order.products.length);

    // Listeners
    order.products.forEach((p, idx) => {
      document.getElementById(`receivedQuantity${idx}`).addEventListener("input", () => updateTotalPerProduct(idx, p.quantity));
      document.getElementById(`unitPrice${idx}`).addEventListener("input", () => updateTotalPerProduct(idx, p.quantity));
    });

    // Mostrar modal
    document.getElementById("confirmOrderModal").style.display = "block";

  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

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

function closeConfirmOrderModal() {
  document.getElementById("invoiceNumber").value = "";
  document.getElementById("invoiceDate").value = "";
  document.getElementById("noInvoiceCheckbox").checked = false;
  document.getElementById("confirmOrderId").value = "";
  document.getElementById("orderIdDisplay").textContent = "";
  document.getElementById("providerNameDisplay").textContent = "";
  document.getElementById("sucursalNameDisplay").textContent = "";
  document.getElementById("orderDateDisplay").textContent = "";
  document.getElementById("confirmOrderProducts").innerHTML = "";
  document.getElementById("invoiceTotal").textContent = "0.00";
  document.getElementById("confirmOrderModal").style.display = "none";
}

/**********************************************************
 * saveConfirmedOrder
 * (Se mantiene la lógica previa)
 **********************************************************/
async function saveConfirmedOrder() {
  // ... (código de validación de factura y cantidades)
  // ... (código de mostrar SweetAlerts)
  // ... (código de actualizar Firestore)
  // Mantén tu lógica actual aquí
}

/**********************************************************
 * showReceivedOrder / closeReceivedOrderModal
 **********************************************************/
function showReceivedOrder(orderId) {
  db.collection("orders").doc(orderId).get()
    .then(docRef => {
      if (!docRef.exists) {
        Swal.fire({ icon: "error", title: "Pedido no encontrado" });
        return;
      }
      const order = docRef.data();
      let html = `
        <p><strong>ID Pedido:</strong> ${order.orderId}</p>
        <p><strong>Proveedor:</strong> ${order.providerName}</p>
        <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
        <p><strong>Fecha de Pedido:</strong> ${order.orderDate}</p>
        <p><strong>Número de Factura:</strong> ${order.invoiceNumber || "No ingresado"}</p>
        <p><strong>Fecha de Factura:</strong> ${order.invoiceDate || "No ingresada"}</p>
        <p><strong>Total de la Factura:</strong> Q${order.invoiceTotal || 0}</p>
      `;

      if (order.mismatchComment) {
        html += `<p style="color:#d9534f;"><strong>Comentario:</strong> ${order.mismatchComment}</p>`;
      }

      html += `
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Presentación</th>
              <th>Cant. Pedida</th>
              <th>Cant. Recibida</th>
              <th>Precio Unitario</th>
              <th>Total</th>
              <th>Comentarios</th>
            </tr>
          </thead>
          <tbody>
      `;
      if (order.receivedProducts) {
        order.receivedProducts.forEach((rp) => {
          html += `
            <tr>
              <td>${rp.name}</td>
              <td>${rp.presentation}</td>
              <td>${rp.quantity}</td>
              <td>${rp.receivedQuantity}</td>
              <td>Q${rp.unitPrice}</td>
              <td>Q${rp.totalPerProduct}</td>
              <td>${rp.comments || ""}</td>
            </tr>
          `;
        });
      }
      html += `</tbody></table>`;

      document.getElementById("receivedOrderDetails").innerHTML = html;
      document.getElementById("receivedOrderModal").style.display = "block";
    })
    .catch(err => {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    });
}

function closeReceivedOrderModal() {
  document.getElementById("receivedOrderDetails").innerHTML = "";
  document.getElementById("receivedOrderModal").style.display = "none";
}
