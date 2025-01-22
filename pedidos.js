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

  // Mostrar filtros si es admin
  if (userRole === "administrador") {
    document.getElementById("adminFilterContainer").style.display = "block";
    loadSucursalesForAdmin();
    loadProvidersForAdmin();
  }

  // Cargar las listas
  loadPendingOrdersAdmin();
  loadInProcessOrdersAdmin();
  loadCompletedOrdersAdmin();

  // Cargar logo para exportar
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
    userRole = userData.rol;  // "administrador" o "usuario"
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
 * loadLogo
 **********************************************************/
function loadLogo() {
  const img = new Image();
  img.src = "logo.png"; // Ajusta la ruta a tu logo
  img.crossOrigin = "Anonymous";
  img.onload = function () {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    logoBase64 = canvas.toDataURL("image/png");
  };
  img.onerror = function () {
    console.error("No se pudo cargar el logo.png");
    Swal.fire({ icon: "error", title: "Error", text: "No se pudo cargar el logo para la exportación." });
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
    const contCards = document.getElementById("completedOrdersAdminCards");
    if (contCards) contCards.innerHTML = "";

    const idSearch = document.getElementById("idSearchInput")?.value?.trim();
    let query;

    if (idSearch) {
      query = db.collection("orders")
        .where("orderId", "==", idSearch)
        .where("status", "==", "completed");
    } else {
      query = db.collection("orders").where("status", "==", "completed");

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
      if (contCards) {
        contCards.appendChild(card);
      }
    });
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * createOrderCard
 **********************************************************/
function createOrderCard(orderDocId, order) {
  const card = document.createElement("div");
  card.className = "order-card";

  let html = `
    <h3>Pedido ID: ${order.orderId}</h3>
    <p>Proveedor: ${order.providerName}</p>
    <p>Sucursal: ${order.sucursalName}</p>
    <p>Fecha: ${order.orderDate}</p>
  `;

  // USUARIO NORMAL + PENDIENTE
  if (order.status === "pending" && userRole !== "administrador") {
    html += `
      <h2 style="color: red;">El pedido aún no ha sido tomado por el proveedor</h2>
      <div class="order-status">${generateProgressBar(order.status)}</div>
      <button onclick="showOrderDetails('${orderDocId}')">Mostrar Pedido</button>
    `;
    card.innerHTML = html;
    return card;
  }

  // ADMIN + PENDIENTE
  if (order.status === "pending" && userRole === "administrador") {
    let mismatchText = "";
    if (order.mismatchedQuantities) {
      mismatchText = `<p style="color: red; font-weight: bold;">No se recibió la misma cantidad pedida</p>`;
    }
    let pendingInvoiceText = "";
    if (order.pendingInvoice) {
      pendingInvoiceText = `<p style="color: orange; font-weight: bold;">Pendiente de Factura</p>`;
    }
    let mismatchCommentHtml = "";
    if (order.mismatchComment) {
      mismatchCommentHtml = `
        <p style="color: #d9534f;">
          <strong>Comentario:</strong> ${order.mismatchComment}
        </p>
      `;
    }

    html += `
      ${mismatchText}
      ${pendingInvoiceText}
      ${mismatchCommentHtml}
      <div class="order-status">${generateProgressBar(order.status)}</div>
      <button onclick="showOrderDetails('${orderDocId}')">Mostrar Pedido</button>
      <button onclick="markOrderAsTaken('${orderDocId}')">Pedido Tomado por Proveedor</button>
      <button onclick="deleteOrder('${orderDocId}')">Eliminar Pedido</button>
    `;
    card.innerHTML = html;
    return card;
  }

  // OTROS ESTADOS
  let mismatchText = "";
  if (order.mismatchedQuantities) {
    mismatchText = `<p style="color: red; font-weight: bold;">No se recibió la misma cantidad pedida</p>`;
  }
  let pendingInvoiceText = "";
  if (order.pendingInvoice) {
    pendingInvoiceText = `<p style="color: orange; font-weight: bold;">Pendiente de Factura</p>`;
  }
  let mismatchCommentHtml = "";
  if (order.mismatchComment) {
    mismatchCommentHtml = `
      <p style="color: #d9534f;">
        <strong>Comentario:</strong> ${order.mismatchComment}
      </p>
    `;
  }

  html += `
    ${mismatchText}
    ${pendingInvoiceText}
    ${mismatchCommentHtml}
    <div class="order-status">${generateProgressBar(order.status)}</div>
    <button onclick="showOrderDetails('${orderDocId}')">Mostrar Pedido</button>
  `;

  // Editar, Exportar, Eliminar
  if (userRole === "administrador" || userPermissions.canEditOrder) {
    html += `<button onclick="editOrder('${orderDocId}')">Editar Pedido</button>`;
  }
  if (userRole === "administrador") {
    html += `<button onclick="exportOrder('${orderDocId}')">Exportar Pedido</button>`;
  }
  if (userRole === "administrador" || userPermissions.canDeleteOrder) {
    html += `<button onclick="deleteOrder('${orderDocId}')">Eliminar Pedido</button>`;
  }

  // InProcess => "Ingresar Cantidades"
  const inProcessArray = [
    "pedidoTomado","caminoABodega","pedidoEnBodega","caminoATienda","enTiendaIncompleto"
  ];
  if (inProcessArray.includes(order.status)) {
    if (userRole === "administrador" || userPermissions.canChangeStatus) {
      html += `<button onclick="openChangeStatusModal('${orderDocId}')">Cambiar Estado</button>`;
    }
    if (order.status === "caminoATienda" || order.status === "enTiendaIncompleto") {
      html += `<button onclick="confirmOrder('${orderDocId}')">Ingresar Cantidades</button>`;
    }
  }

  // Mostrar Recibido en Pedidos Completados
  if (order.status === "completed") {
    // Para Usuarios Administradores
    if (userRole === "administrador") {
      html += `<button onclick="showReceivedOrder('${orderDocId}')">Mostrar Pedido Recibido</button>`;
    }

    // Para Usuarios Normales
    if (userRole !== "administrador") {
      html += `
        <button onclick="showReceivedOrder('${orderDocId}')">Mostrar Pedido Recibido</button>
        <!-- Eliminar los botones de exportación de la tarjeta -->
        <!-- Los botones de exportación se añadirán dentro de la ventana modal -->
      `;
    }
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
      `;

      if (order.lastEditTimestamp) {
        const editDate = new Date(order.lastEditTimestamp.toDate());
        const fechaStr = editDate.toLocaleString();
        html += `<p style="color: green;"><strong>Última Edición:</strong> ${fechaStr}</p>`;
      }

      // Lista de productos
      html += `
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Presentación</th>
              <th>Cantidad</th>
            </tr>
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

      // Botones: Editar + Exportar (dependiendo del rol y estado)
      if (order.status === "pending") {
        if (userRole === "administrador") {
          html += `
            <button onclick="editOrder('${orderId}')">Editar Pedido</button>
            <button onclick="exportOrder('${orderId}')">Exportar Pedido</button>
          `;
        } else {
          html += `
            <button onclick="editOrder('${orderId}')">Editar Pedido</button>
            <button onclick="exportAsImageDirect('${orderId}')">Exportar como Imagen</button>
          `;
        }
      }

      // **Agregar Botón de "Exportar Pedido como Imagen" en Detalles del Pedido**
      html += `
        <button onclick="exportAsImage('${orderId}')">Exportar Pedido como Imagen</button>
      `;

      // **Agregar Botón de "Exportar Recepción de Pedido" si aplica**
      if (order.receivedProducts && order.receivedProducts.length > 0) {
        html += `<button onclick="exportReception('${orderId}')">Exportar Recepción de Pedido</button>`;
      }

      document.getElementById("orderDetails").innerHTML = html;
      document.getElementById("orderDetailsModal").style.display = "block";

      // Configurar el botón de exportación de Pedido como Imagen con el orderId
      const exportImageButton = document.getElementById("exportOrderImageButton");
      if (exportImageButton) {
        exportImageButton.onclick = function() {
          exportAsImage(orderId);
        };
      }
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
      name: n || "",
      presentation: pr || "",
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

  // Guardar la hora de edición
  const editTimestamp = new Date();

  try {
    await db.collection("orders").doc(orderId).update({
      orderDate,
      products,
      lastEditTimestamp: firebase.firestore.Timestamp.fromDate(editTimestamp)
    });

    const fechaStr = editTimestamp.toLocaleString();
    Swal.fire({
      icon: "success",
      title: "Pedido fue editado",
      text: `Fecha y hora: ${fechaStr}`
    });

    closeEditOrderModal();
    closeOrderDetailsModal();
    reloadOrders();
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * EXPORTAR (Imagen, Excel)
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
      // **Deshabilitado:** La exportación a PDF para "Exportar Recepción de Pedido" ha sido removida
      Swal.fire({ icon: "warning", title: "Funcionalidad Deshabilitada", text: "La exportación a PDF para recepción de pedidos no está disponible." });
    } else if (format === "excel") {
      exportAsExcel(order, fileName);
    }
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error al exportar", text: error.message });
  }
  closeExportModal();
}

/**********************************************************
 * Exportar como Imagen DIRECT (usuario normal)
 **********************************************************/
async function exportAsImageDirect(orderId) {
  try {
    const docRef = await db.collection("orders").doc(orderId).get();
    if (!docRef.exists) {
      Swal.fire({ icon: "error", title: "Pedido no encontrado" });
      return;
    }
    const order = docRef.data();
    const fileName = `Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;
    exportAsImage(order, fileName);
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error al exportar", text: error.message });
  }
}

/**********************************************************
 * Exportar como Imagen
 **********************************************************/
function exportAsImage(order, fileName) {
  const hiddenDiv = document.getElementById("exportHiddenContainer");

  // Obtener referencias a los elementos
  const exportOrderIdHidden = document.getElementById("exportOrderIdHidden");
  const exportProviderHidden = document.getElementById("exportProviderHidden");
  const exportSucursalHidden = document.getElementById("exportSucursalHidden");
  const exportFechaHidden = document.getElementById("exportFechaHidden");
  const exportLastEditHidden = document.getElementById("exportLastEditHidden");
  const exportLogoImg = document.getElementById("exportLogo");
  const tBody = document.getElementById("exportProductsTableBody");

  // Verificar que todos los elementos existan
  if (!exportOrderIdHidden || !exportProviderHidden || !exportSucursalHidden || !exportFechaHidden || !exportLastEditHidden || !exportLogoImg || !tBody) {
    Swal.fire({ icon: "error", title: "Error", text: "Elementos de exportación no encontrados en el DOM." });
    console.error("Uno o más elementos necesarios para la exportación no existen.");
    return;
  }

  // Asignar datos al HTML oculto
  exportOrderIdHidden.textContent = order.orderId;
  exportProviderHidden.textContent = order.providerName;
  exportSucursalHidden.textContent = order.sucursalName;
  exportFechaHidden.textContent = order.orderDate;

  if (order.lastEditTimestamp) {
    const editDate = new Date(order.lastEditTimestamp.toDate());
    exportLastEditHidden.textContent = `Pedido editado el: ${editDate.toLocaleString()}`;
  } else {
    exportLastEditHidden.textContent = "";
  }

  // Asignar el logo
  if (logoBase64) {
    exportLogoImg.src = logoBase64;
  } else {
    exportLogoImg.src = "logo.png"; // Asegúrate de que esta ruta sea correcta
  }

  // Llenar la tabla de productos
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

  // Mostrar el contenedor oculto
  hiddenDiv.style.display = "block";
  hiddenDiv.style.left = "50%";
  hiddenDiv.style.top = "50%";
  hiddenDiv.style.transform = "translate(-50%, -50%)";

  // Exportar como imagen usando html2canvas
  html2canvas(hiddenDiv, { scale: 2 })
    .then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `${fileName}.png`;
      link.click();
    })
    .catch(err => {
      Swal.fire({ icon: "error", title: "Error al exportar", text: "No se pudo exportar la imagen" });
      console.error("Error en html2canvas:", err);
    })
    .finally(() => {
      // Ocultar el contenedor nuevamente
      hiddenDiv.style.display = "none";
      hiddenDiv.style.left = "-9999px";
      hiddenDiv.style.top = "-9999px";
      hiddenDiv.style.transform = "none";
    });
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
    []
  ];
  if (order.lastEditTimestamp) {
    const editDate = new Date(order.lastEditTimestamp.toDate()).toLocaleString();
    ws_data.push(["Última Edición", editDate]);
    ws_data.push([]);
  }
  ws_data.push(["Producto", "Presentación", "Cantidad"]);
  order.products.forEach((prod) => {
    ws_data.push([prod.name, prod.presentation, prod.quantity]);
  });
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Pedido");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**********************************************************
 * confirmOrder
 * Muestra el modal donde se ingresan cantidades, factura, etc.
 **********************************************************/
async function confirmOrder(orderId) {
  try {
    const docSnap = await db.collection("orders").doc(orderId).get();
    if (!docSnap.exists) {
      Swal.fire({ icon: "error", title: "Pedido no encontrado" });
      return;
    }
    const order = docSnap.data();

    document.getElementById("confirmOrderId").value = orderId;
    document.getElementById("invoiceNumber").value = order.invoiceNumber || "";
    document.getElementById("invoiceDate").value = order.invoiceDate || "";
    document.getElementById("noInvoiceCheckbox").checked = !!order.pendingInvoice;

    // Mostrar info
    document.getElementById("orderIdDisplay").textContent = order.orderId;
    document.getElementById("providerNameDisplay").textContent = order.providerName;
    document.getElementById("sucursalNameDisplay").textContent = order.sucursalName;
    document.getElementById("orderDateDisplay").textContent = order.orderDate;

    // Llenar la tabla
    const tBody = document.getElementById("confirmOrderProducts");
    tBody.innerHTML = "";
    const receivedArr = order.receivedProducts || [];

    order.products.forEach((prod, i) => {
      const rData = receivedArr[i] || {};
      const receivedQty = rData.receivedQuantity || 0;
      const priceVal = rData.unitPrice || 0;
      const totalVal = rData.totalPerProduct || 0;
      const commentsVal = rData.comments || "";

      tBody.insertAdjacentHTML("beforeend", `
        <tr>
          <td>${prod.name}</td>
          <td>${prod.presentation}</td>
          <td>${prod.quantity}</td>
          <td>
            <input 
              type="number" 
              id="receivedQuantity${i}" 
              min="0" 
              max="${prod.quantity}"
              value="${receivedQty}"
              onchange="updateTotalPerProduct(${i}, ${prod.quantity})"
            />
          </td>
          <td>
            <input 
              type="number" 
              id="unitPrice${i}" 
              step="0.01"
              min="0"
              value="${priceVal}"
              onchange="updateTotalPerProduct(${i}, ${prod.quantity})"
            />
          </td>
          <td>Q<span id="totalPerProduct${i}">${Number(totalVal).toFixed(2)}</span></td>
          <td>
            <input 
              type="text" 
              id="productComments${i}" 
              value="${commentsVal}" 
              placeholder="Comentarios"
            />
          </td>
        </tr>
      `);
    });

    calculateInvoiceTotal();
    document.getElementById("confirmOrderModal").style.display = "block";
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

function updateTotalPerProduct(i, maxQty) {
  const qtyInput = document.getElementById(`receivedQuantity${i}`);
  const priceInput = document.getElementById(`unitPrice${i}`);
  const totalSpan = document.getElementById(`totalPerProduct${i}`);

  let q = parseFloat(qtyInput.value) || 0;
  let p = parseFloat(priceInput.value) || 0;
  if (q < 0) q = 0;
  if (q > maxQty) q = maxQty;
  if (p < 0) p = 0;

  qtyInput.value = q;
  priceInput.value = p;

  const total = q * p;
  totalSpan.textContent = total.toFixed(2);

  calculateInvoiceTotal();
}

function calculateInvoiceTotal() {
  let grandTotal = 0;
  const rows = document.querySelectorAll("#confirmOrderProducts tr");
  rows.forEach((row, idx) => {
    const val = parseFloat(document.getElementById(`totalPerProduct${idx}`).textContent) || 0;
    grandTotal += val;
  });
  document.getElementById("invoiceTotal").textContent = grandTotal.toFixed(2);
}

function closeConfirmOrderModal() {
  document.getElementById("confirmOrderId").value = "";
  document.getElementById("invoiceNumber").value = "";
  document.getElementById("invoiceDate").value = "";
  document.getElementById("noInvoiceCheckbox").checked = false;

  document.getElementById("orderIdDisplay").textContent = "";
  document.getElementById("providerNameDisplay").textContent = "";
  document.getElementById("sucursalNameDisplay").textContent = "";
  document.getElementById("orderDateDisplay").textContent = "";

  document.getElementById("confirmOrderProducts").innerHTML = "";
  document.getElementById("invoiceTotal").textContent = "0.00";

  // Ocultar el botón de exportación para usuarios normales
  document.getElementById("exportReceptionButtonContainer").style.display = "none";

  document.getElementById("confirmOrderModal").style.display = "none";
}

/**********************************************************
 * saveConfirmedOrder
 * Valida:
 * - Cantidades (si < lo pedido => mismatchQuantities)
 * - Factura (si noInvoiceCheckbox => pendingInvoice = true)
 * Luego, si mismatchQuantities o pendingInvoice, pide
 * "motivo/comentario" en un SweetAlert, lo guarda en mismatchComment
 * y NO cambia status => se mantiene en inProcess
 **********************************************************/
async function saveConfirmedOrder() {
  try {
    const orderId = document.getElementById("confirmOrderId").value;
    if (!orderId) {
      Swal.fire({ icon: "error", title: "Error", text: "No se encontró el pedido." });
      return;
    }

    const invoiceNumberField = document.getElementById("invoiceNumber").value.trim();
    const invoiceDateField = document.getElementById("invoiceDate").value.trim();
    const noInvoice = document.getElementById("noInvoiceCheckbox").checked;

    // Validación de factura
    if (!noInvoice) {
      // Si no marcó "No se ingresó factura", entonces #invoiceNumber y #invoiceDate deben tener algo
      if (!invoiceNumberField || !invoiceDateField) {
        Swal.fire({
          icon: "warning",
          title: "Faltan datos de factura",
          text: "Ingresa la factura o marca 'No se ingresó la factura'."
        });
        return;
      }
    }

    // Obtener el pedido original
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      Swal.fire({ icon: "error", title: "Error", text: "Pedido no existe en DB" });
      return;
    }
    const orderData = orderDoc.data();

    // Recorrer la tabla
    const tRows = document.querySelectorAll("#confirmOrderProducts tr");
    let mismatchedQuantities = false;
    let totalFactura = 0;
    let receivedProducts = [];

    for (let i = 0; i < tRows.length; i++) {
      const originalProd = orderData.products[i];
      const qPedida = parseFloat(originalProd.quantity) || 0;

      const qRecibida = parseFloat(document.getElementById(`receivedQuantity${i}`).value) || 0;
      const pUnit = parseFloat(document.getElementById(`unitPrice${i}`).value) || 0;
      const totalCell = parseFloat(document.getElementById(`totalPerProduct${i}`).textContent) || 0;
      const commentsVal = document.getElementById(`productComments${i}`).value.trim();

      // Validación: no permitir recibir más de lo pedido
      if (qRecibida > qPedida) {
        Swal.fire({
          icon: "error",
          title: "Cantidad inválida",
          text: `No puedes recibir más de lo pedido para el producto: ${originalProd.name}`
        });
        return;
      }
      // Si se recibió menos => mismatch
      if (qRecibida < qPedida) {
        mismatchedQuantities = true;
      }

      totalFactura += totalCell;

      receivedProducts.push({
        name: originalProd.name,
        presentation: originalProd.presentation,
        quantity: qPedida,
        receivedQuantity: qRecibida,
        unitPrice: pUnit,
        totalPerProduct: totalCell,
        comments: commentsVal
      });
    }

    // Checar si no se ingresó factura
    let pendingInvoice = false;
    if (noInvoice) {
      pendingInvoice = true;
    }

    const invoiceTotalValue = Number(totalFactura.toFixed(2));

    // Si hay mismatch o no hay factura, pedimos un comentario de motivo
    if (mismatchedQuantities || pendingInvoice) {
      // Pedir el comentario (motivo)
      const { value: reason } = await Swal.fire({
        title: "Motivo del faltante o no factura",
        input: "text",
        inputLabel: "Comentario:",
        inputPlaceholder: "Ej. 'No llegó factura', 'No vino todo el producto'...",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
        confirmButtonText: "Guardar",
        inputValidator: (value) => {
          if (!value) {
            return "Por favor, ingresa un comentario.";
          }
          return null;
        }
      });

      if (!reason) {
        // Canceló
        return; 
      }

      // Guardamos en mismatchComment
      await db.collection("orders").doc(orderId).update({
        invoiceNumber: pendingInvoice ? "" : invoiceNumberField,
        invoiceDate: pendingInvoice ? "" : invoiceDateField,
        pendingInvoice: pendingInvoice,
        receivedProducts: receivedProducts,
        invoiceTotal: invoiceTotalValue,
        mismatchedQuantities: mismatchedQuantities,
        mismatchComment: reason, 
        // No cambiamos status a completed, se queda en inProcess
      });

      Swal.fire({
        icon: "success",
        title: "Recepción Guardada con Faltantes/Comentario",
        text: `El pedido se mantiene en proceso. Total Factura: Q${invoiceTotalValue}`
      });

      closeConfirmOrderModal();
      reloadOrders();
      return;
    }

    // Caso Normal: se recibió todo, con factura
    await db.collection("orders").doc(orderId).update({
      invoiceNumber: invoiceNumberField,
      invoiceDate: invoiceDateField,
      pendingInvoice: false,
      receivedProducts: receivedProducts,
      invoiceTotal: invoiceTotalValue,
      mismatchedQuantities: false,
      mismatchComment: ""
      // status: "inTiendaIncompleto" o "completed" si quisieras, 
      // pero según tu requisito se mantiene en inProcess
    });

    Swal.fire({
      icon: "success",
      title: "Recepción Guardada",
      text: `Todo coincide y se ingresó factura. Total Factura: Q${invoiceTotalValue}`
    });

    // **Mostrar el botón de exportación para usuarios normales**
    if (userRole !== "administrador") {
      document.getElementById("exportReceptionButtonContainer").style.display = "block";
    }

    closeConfirmOrderModal();
    reloadOrders();

  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
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

      // **Mostrar el botón de exportación para usuarios normales**
      if (userRole !== "administrador") {
        document.getElementById("exportReceivedOrderImageButtonContainer").style.display = "block";
        // Asignar el onclick con el orderId
        const exportButton = document.querySelector("#exportReceivedOrderImageButtonContainer button");
        if (exportButton) {
          exportButton.onclick = function() {
            exportAsReceivedOrderImage(orderId);
          };
        }
      }

      document.getElementById("receivedOrderModal").style.display = "block";
    })
    .catch(err => {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    });
}

function closeReceivedOrderModal() {
  document.getElementById("receivedOrderDetails").innerHTML = "";
  document.getElementById("receivedOrderModal").style.display = "none";

  // Ocultar el botón de exportación para usuarios normales
  document.getElementById("exportReceivedOrderImageButtonContainer").style.display = "none";
}

/**********************************************************
 * EXPORTAR RECEPCIÓN DE PEDIDO
 **********************************************************/
async function exportReception(orderId) {
  try {
    const docRef = await db.collection("orders").doc(orderId).get();
    if (!docRef.exists) {
      Swal.fire({ icon: "error", title: "Pedido no encontrado" });
      return;
    }
    const order = docRef.data();
    const fileName = `Recepcion_Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;
    exportReceptionAsImage(orderId, fileName);
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error al exportar", text: error.message });
  }
}

/**********************************************************
 * Exportar Recepción de Pedido como Imagen
 **********************************************************/
async function exportReceptionAsImage(orderId, fileName) {
  if (!orderId) {
    Swal.fire({ icon: "error", title: "Error", text: "No se encontró el pedido para exportar." });
    return;
  }
  try {
    const docRef = await db.collection("orders").doc(orderId).get();
    if (!docRef.exists) {
      Swal.fire({ icon: "error", title: "Pedido no encontrado" });
      return;
    }
    const order = docRef.data();
    exportAsReceptionImage(order, fileName);
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error al exportar", text: error.message });
  }
}

/**********************************************************
 * Exportar Recepción de Pedido como Imagen
 **********************************************************/
function exportAsReceptionImage(order, fileName) {
  const hiddenDiv = document.getElementById("exportReceptionHiddenContainer");

  // Obtener referencias a los elementos
  const exportReceptionOrderIdHidden = document.getElementById("exportReceptionOrderIdHidden");
  const exportReceptionProviderHidden = document.getElementById("exportReceptionProviderHidden");
  const exportReceptionSucursalHidden = document.getElementById("exportReceptionSucursalHidden");
  const exportReceptionOrderDateHidden = document.getElementById("exportReceptionOrderDateHidden");
  const exportReceptionInvoiceNumberHidden = document.getElementById("exportReceptionInvoiceNumberHidden");
  const exportReceptionInvoiceDateHidden = document.getElementById("exportReceptionInvoiceDateHidden");
  const exportReceptionInvoiceTotalHidden = document.getElementById("exportReceptionInvoiceTotalHidden");
  const exportReceptionLastEditHidden = document.getElementById("exportReceptionLastEditHidden");
  const exportReceptionLogoImg = document.getElementById("exportReceptionLogo");
  const exportReceptionTBody = document.getElementById("exportReceptionProductsTableBody");

  // Verificar que todos los elementos existan
  if (!exportReceptionOrderIdHidden || !exportReceptionProviderHidden || !exportReceptionSucursalHidden || !exportReceptionOrderDateHidden || !exportReceptionInvoiceNumberHidden || !exportReceptionInvoiceDateHidden || !exportReceptionInvoiceTotalHidden || !exportReceptionLastEditHidden || !exportReceptionLogoImg || !exportReceptionTBody) {
    Swal.fire({ icon: "error", title: "Error", text: "Elementos de exportación no encontrados en el DOM." });
    console.error("Uno o más elementos necesarios para la exportación de recepción no existen.");
    return;
  }

  // Asignar datos al HTML oculto
  exportReceptionOrderIdHidden.textContent = order.orderId;
  exportReceptionProviderHidden.textContent = order.providerName;
  exportReceptionSucursalHidden.textContent = order.sucursalName;
  exportReceptionOrderDateHidden.textContent = order.orderDate;
  exportReceptionInvoiceNumberHidden.textContent = order.invoiceNumber || "No ingresado";
  exportReceptionInvoiceDateHidden.textContent = order.invoiceDate || "No ingresada";
  exportReceptionInvoiceTotalHidden.textContent = order.invoiceTotal ? `Q${order.invoiceTotal}` : "Q0.00";

  if (order.lastEditTimestamp) {
    const editDate = new Date(order.lastEditTimestamp.toDate());
    exportReceptionLastEditHidden.textContent = `Pedido editado el: ${editDate.toLocaleString()}`;
  } else {
    exportReceptionLastEditHidden.textContent = "";
  }

  // Asignar el logo
  if (logoBase64) {
    exportReceptionLogoImg.src = logoBase64;
  } else {
    exportReceptionLogoImg.src = "logo.png"; // Asegúrate de que esta ruta sea correcta
  }

  // Llenar la tabla de recepción
  exportReceptionTBody.innerHTML = "";
  order.receivedProducts.forEach(prod => {
    const row = document.createElement("tr");
    const tdName = document.createElement("td");
    const tdPres = document.createElement("td");
    const tdQtyPed = document.createElement("td");
    const tdQtyRec = document.createElement("td");
    const tdAdver = document.createElement("td");
    const tdComm = document.createElement("td");

    tdName.textContent = prod.name;
    tdPres.textContent = prod.presentation;
    tdQtyPed.textContent = prod.quantity;
    tdQtyRec.textContent = prod.receivedQuantity;
    tdAdver.textContent = prod.receivedQuantity < prod.quantity ? "Cantidad recibida menor a la pedida." : "—";
    tdComm.textContent = prod.comments || "—";

    row.appendChild(tdName);
    row.appendChild(tdPres);
    row.appendChild(tdQtyPed);
    row.appendChild(tdQtyRec);
    row.appendChild(tdAdver);
    row.appendChild(tdComm);
    exportReceptionTBody.appendChild(row);
  });

  // Mostrar el contenedor oculto
  hiddenDiv.style.display = "block";
  hiddenDiv.style.left = "50%";
  hiddenDiv.style.top = "50%";
  hiddenDiv.style.transform = "translate(-50%, -50%)";

  // Exportar como imagen usando html2canvas
  html2canvas(hiddenDiv, { scale: 2 })
    .then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `${fileName}.png`;
      link.click();
    })
    .catch(err => {
      Swal.fire({ icon: "error", title: "Error al exportar", text: "No se pudo exportar la imagen" });
      console.error("Error en html2canvas:", err);
    })
    .finally(() => {
      // Ocultar el contenedor nuevamente
      hiddenDiv.style.display = "none";
      hiddenDiv.style.left = "-9999px";
      hiddenDiv.style.top = "-9999px";
      hiddenDiv.style.transform = "none";
    });
}

/**********************************************************
 * Exportar como Imagen desde Detalles del Pedido
 **********************************************************/
function exportAsImage(orderId) {
  if (!orderId) {
    Swal.fire({ icon: "error", title: "Error", text: "No se encontró el pedido para exportar." });
    return;
  }
  db.collection("orders").doc(orderId).get()
    .then(docRef => {
      if (!docRef.exists) {
        Swal.fire({ icon: "error", title: "Pedido no encontrado" });
        return;
      }
      const order = docRef.data();
      const fileName = `Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;
      exportAsImageFunction(order, fileName);
    })
    .catch(error => {
      Swal.fire({ icon: "error", title: "Error al exportar", text: error.message });
    });
}

/**********************************************************
 * Función para Exportar Pedido como Imagen
 **********************************************************/
function exportAsImageFunction(order, fileName) {
  const hiddenDiv = document.getElementById("exportHiddenContainer");

  // Obtener referencias a los elementos
  const exportOrderIdHidden = document.getElementById("exportOrderIdHidden");
  const exportProviderHidden = document.getElementById("exportProviderHidden");
  const exportSucursalHidden = document.getElementById("exportSucursalHidden");
  const exportFechaHidden = document.getElementById("exportFechaHidden");
  const exportLastEditHidden = document.getElementById("exportLastEditHidden");
  const exportLogoImg = document.getElementById("exportLogo");
  const tBody = document.getElementById("exportProductsTableBody");

  // Verificar que todos los elementos existan
  if (!exportOrderIdHidden || !exportProviderHidden || !exportSucursalHidden || !exportFechaHidden || !exportLastEditHidden || !exportLogoImg || !tBody) {
    Swal.fire({ icon: "error", title: "Error", text: "Elementos de exportación no encontrados en el DOM." });
    console.error("Uno o más elementos necesarios para la exportación no existen.");
    return;
  }

  // Asignar datos al HTML oculto
  exportOrderIdHidden.textContent = order.orderId;
  exportProviderHidden.textContent = order.providerName;
  exportSucursalHidden.textContent = order.sucursalName;
  exportFechaHidden.textContent = order.orderDate;

  if (order.lastEditTimestamp) {
    const editDate = new Date(order.lastEditTimestamp.toDate());
    exportLastEditHidden.textContent = `Pedido editado el: ${editDate.toLocaleString()}`;
  } else {
    exportLastEditHidden.textContent = "";
  }

  // Asignar el logo
  if (logoBase64) {
    exportLogoImg.src = logoBase64;
  } else {
    exportLogoImg.src = "logo.png"; // Asegúrate de que esta ruta sea correcta
  }

  // Llenar la tabla de productos
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

  // Mostrar el contenedor oculto
  hiddenDiv.style.display = "block";
  hiddenDiv.style.left = "50%";
  hiddenDiv.style.top = "50%";
  hiddenDiv.style.transform = "translate(-50%, -50%)";

  // Exportar como imagen usando html2canvas
  html2canvas(hiddenDiv, { scale: 2 })
    .then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `${fileName}.png`;
      link.click();
    })
    .catch(err => {
      Swal.fire({ icon: "error", title: "Error al exportar", text: "No se pudo exportar la imagen" });
      console.error("Error en html2canvas:", err);
    })
    .finally(() => {
      // Ocultar el contenedor nuevamente
      hiddenDiv.style.display = "none";
      hiddenDiv.style.left = "-9999px";
      hiddenDiv.style.top = "-9999px";
      hiddenDiv.style.transform = "none";
    });
}

/**********************************************************
 * EXPORTAR RECEPCIÓN DE PEDIDO COMO IMAGEN
 **********************************************************/
function exportAsReceivedOrderImage(orderId) {
  if (!orderId) {
    Swal.fire({ icon: "error", title: "Error", text: "No se encontró el pedido para exportar." });
    return;
  }
  db.collection("orders").doc(orderId).get()
    .then(docRef => {
      if (!docRef.exists) {
        Swal.fire({ icon: "error", title: "Pedido no encontrado" });
        return;
      }
      const order = docRef.data();
      const fileName = `Recepcion_Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;
      exportReceptionAsImageFunction(order, fileName);
    })
    .catch(error => {
      Swal.fire({ icon: "error", title: "Error al exportar", text: error.message });
    });
}

/**********************************************************
 * Función para Exportar Recepción de Pedido como Imagen
 **********************************************************/
function exportReceptionAsImageFunction(order, fileName) {
  const hiddenDiv = document.getElementById("exportReceptionHiddenContainer");

  // Obtener referencias a los elementos
  const exportReceptionOrderIdHidden = document.getElementById("exportReceptionOrderIdHidden");
  const exportReceptionProviderHidden = document.getElementById("exportReceptionProviderHidden");
  const exportReceptionSucursalHidden = document.getElementById("exportReceptionSucursalHidden");
  const exportReceptionOrderDateHidden = document.getElementById("exportReceptionOrderDateHidden");
  const exportReceptionInvoiceNumberHidden = document.getElementById("exportReceptionInvoiceNumberHidden");
  const exportReceptionInvoiceDateHidden = document.getElementById("exportReceptionInvoiceDateHidden");
  const exportReceptionInvoiceTotalHidden = document.getElementById("exportReceptionInvoiceTotalHidden");
  const exportReceptionLastEditHidden = document.getElementById("exportReceptionLastEditHidden");
  const exportReceptionLogoImg = document.getElementById("exportReceptionLogo");
  const exportReceptionTBody = document.getElementById("exportReceptionProductsTableBody");

  // Verificar que todos los elementos existan
  if (!exportReceptionOrderIdHidden || !exportReceptionProviderHidden || !exportReceptionSucursalHidden || !exportReceptionOrderDateHidden || !exportReceptionInvoiceNumberHidden || !exportReceptionInvoiceDateHidden || !exportReceptionInvoiceTotalHidden || !exportReceptionLastEditHidden || !exportReceptionLogoImg || !exportReceptionTBody) {
    Swal.fire({ icon: "error", title: "Error", text: "Elementos de exportación no encontrados en el DOM." });
    console.error("Uno o más elementos necesarios para la exportación de recepción no existen.");
    return;
  }

  // Asignar datos al HTML oculto
  exportReceptionOrderIdHidden.textContent = order.orderId;
  exportReceptionProviderHidden.textContent = order.providerName;
  exportReceptionSucursalHidden.textContent = order.sucursalName;
  exportReceptionOrderDateHidden.textContent = order.orderDate;
  exportReceptionInvoiceNumberHidden.textContent = order.invoiceNumber || "No ingresado";
  exportReceptionInvoiceDateHidden.textContent = order.invoiceDate || "No ingresada";
  exportReceptionInvoiceTotalHidden.textContent = order.invoiceTotal ? `Q${order.invoiceTotal}` : "Q0.00";

  if (order.lastEditTimestamp) {
    const editDate = new Date(order.lastEditTimestamp.toDate());
    exportReceptionLastEditHidden.textContent = `Pedido editado el: ${editDate.toLocaleString()}`;
  } else {
    exportReceptionLastEditHidden.textContent = "";
  }

  // Asignar el logo
  if (logoBase64) {
    exportReceptionLogoImg.src = logoBase64;
  } else {
    exportReceptionLogoImg.src = "logo.png"; // Asegúrate de que esta ruta sea correcta
  }

  // Llenar la tabla de recepción
  exportReceptionTBody.innerHTML = "";
  order.receivedProducts.forEach(prod => {
    const row = document.createElement("tr");
    const tdName = document.createElement("td");
    const tdPres = document.createElement("td");
    const tdQtyPed = document.createElement("td");
    const tdQtyRec = document.createElement("td");
    const tdAdver = document.createElement("td");
    const tdComm = document.createElement("td");

    tdName.textContent = prod.name;
    tdPres.textContent = prod.presentation;
    tdQtyPed.textContent = prod.quantity;
    tdQtyRec.textContent = prod.receivedQuantity;
    tdAdver.textContent = prod.receivedQuantity < prod.quantity ? "Cantidad recibida menor a la pedida." : "—";
    tdComm.textContent = prod.comments || "—";

    row.appendChild(tdName);
    row.appendChild(tdPres);
    row.appendChild(tdQtyPed);
    row.appendChild(tdQtyRec);
    row.appendChild(tdAdver);
    row.appendChild(tdComm);
    exportReceptionTBody.appendChild(row);
  });

  // Mostrar el contenedor oculto
  hiddenDiv.style.display = "block";
  hiddenDiv.style.left = "50%";
  hiddenDiv.style.top = "50%";
  hiddenDiv.style.transform = "translate(-50%, -50%)";

  // Exportar como imagen usando html2canvas
  html2canvas(hiddenDiv, { scale: 2 })
    .then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `${fileName}.png`;
      link.click();
    })
    .catch(err => {
      Swal.fire({ icon: "error", title: "Error al exportar", text: "No se pudo exportar la imagen" });
      console.error("Error en html2canvas:", err);
    })
    .finally(() => {
      // Ocultar el contenedor nuevamente
      hiddenDiv.style.display = "none";
      hiddenDiv.style.left = "-9999px";
      hiddenDiv.style.top = "-9999px";
      hiddenDiv.style.transform = "none";
    });
}

/**********************************************************
 * EXPORTAR RECEPCIÓN DE PEDIDO COMO IMAGEN
 **********************************************************/
function exportAsReceivedOrderImage(orderId) {
  if (!orderId) {
    Swal.fire({ icon: "error", title: "Error", text: "No se encontró el pedido para exportar." });
    return;
  }
  db.collection("orders").doc(orderId).get()
    .then(docRef => {
      if (!docRef.exists) {
        Swal.fire({ icon: "error", title: "Pedido no encontrado" });
        return;
      }
      const order = docRef.data();
      const fileName = `Recepcion_Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;
      exportReceptionAsImageFunction(order, fileName);
    })
    .catch(error => {
      Swal.fire({ icon: "error", title: "Error al exportar", text: error.message });
    });
}
