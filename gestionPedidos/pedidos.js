/**********************************************************
 * VARIABLES GLOBALES (se asume que la conexión Firebase ya
 * se realizó en ../database/connection.js)
 **********************************************************/
let userSucursalId = null;
let loggedInUsername = null;
let userRole = null;
let userPermissions = {};
let logoBase64 = ""; // Se cargará el logo en base64

// Variables para almacenar las funciones de desuscripción
let inProcessUnsubscribe = null;
let completedUnsubscribe = null;

// Variable global para almacenar el ID del pedido para cambio de estado
let currentOrderForStatusChange = null;

// Variable global para almacenar el nombre del archivo a descargar
window.exportReceptionDownloadFileName = "";

/**********************************************************
 * FUNCIONES PARA MODAL DE CAMBIO DE ESTADO
 **********************************************************/
function openChangeStatusModal(orderDocId) {
  currentOrderForStatusChange = orderDocId;
  document.getElementById("changeStatusModal").style.display = "block";
}

function closeChangeStatusModal() {
  document.getElementById("changeStatusModal").style.display = "none";
  currentOrderForStatusChange = null;
}

/**********************************************************
 * CAMBIAR ESTADO MANUALMENTE
 **********************************************************/
function changeOrderStatusManually(newStatus) {
  if (!currentOrderForStatusChange) {
    Swal.fire({ icon: "error", title: "Error", text: "No se ha seleccionado ningún pedido para cambiar el estado." });
    return;
  }
  Swal.fire({
    title: `¿Cambiar estado a '${newStatus}'?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "Cancelar"
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await db.collection("orders").doc(currentOrderForStatusChange).update({ status: newStatus });
        Swal.fire({ icon: "success", title: "Estado actualizado", text: `El pedido se actualizó a '${newStatus}'.` });
        closeChangeStatusModal();
      } catch (error) {
        Swal.fire({ icon: "error", title: "Error", text: error.message });
      }
    }
  });
}

/**********************************************************
 * DOMContentLoaded: Inicializa la carga de pedidos y otros
 * datos al cargar la página
 **********************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  await initUserAndSucursal();
  if (userRole === "administrador") {
    document.getElementById("adminFilterContainer").style.display = "block";
    loadSucursalesForAdmin();
    loadProvidersForAdmin();
  }
  loadLogo();
  attachInProcessListener();
  attachCompletedListener();
  document.getElementById("inProcessOrdersContainer").style.display = "block";
  document.getElementById("completedOrdersContainer").style.display = "none";
  
  // Listener para mostrar/ocultar contenedor de facturas adicionales
  document.getElementById("multipleInvoicesCheckbox").addEventListener("change", function() {
    const container = document.getElementById("additionalInvoicesContainer");
    if (this.checked) {
      container.style.display = "block";
    } else {
      container.style.display = "none";
      document.getElementById("additionalInvoicesRows").innerHTML = "";
    }
  });
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
    Swal.fire({
      icon: "error",
      title: "Error",
      text: error.message
    });
  }
}

/**********************************************************
 * loadLogo: Carga el logo y lo convierte a base64
 **********************************************************/
function loadLogo() {
  const img = new Image();
  img.src = "../resources/images/logo.png";
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
    console.error("No se pudo cargar ../resources/images/logo.png");
  };
}

/**********************************************************
 * loadSucursalesForAdmin / loadProvidersForAdmin
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
    Swal.fire({
      icon: "error",
      title: "Error",
      text: error.message
    });
  }
}

async function loadProvidersForAdmin() {
  const sel = document.getElementById("providerFilter");
  sel.innerHTML = `<option value="all">Todos los Proveedores</option>`;
  try {
    const ordersSnap = await db.collection("orders").get();
    const uniqueProviders = new Set();
    ordersSnap.forEach(doc => {
      if (doc.data().providerName) {
        uniqueProviders.add(doc.data().providerName);
      }
    });
    uniqueProviders.forEach(provider => {
      const opt = document.createElement("option");
      opt.value = provider;
      opt.textContent = provider;
      sel.appendChild(opt);
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: error.message
    });
  }
}

/**********************************************************
 * Navegación y Tabs
 **********************************************************/
function openTab(evt, tabName) {
  const tabcontent = document.getElementsByClassName("container");
  for (let el of tabcontent) {
    el.style.display = "none";
  }
  const tablinks = document.getElementsByClassName("tab-button");
  for (let el of tablinks) {
    el.className = el.className.replace(" active", "");
  }
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.className += " active";
}

function goToMainMenu() {
  window.location.href = "../index.html";
}

/**********************************************************
 * Listeners en Tiempo Real “Dinámicos”
 **********************************************************/
function attachInProcessListener() {
  if (inProcessUnsubscribe) inProcessUnsubscribe();
  let query;
  const idSearch = document.getElementById("idSearchInput")?.value?.trim();
  
  if (idSearch) {
    query = db.collection("orders").where("orderId", "==", idSearch);
  } else {
    // Filtro por estado
    const estadoFilter = document.getElementById("estadoFilter")?.value || "all";
    if (estadoFilter === "pending") {
      query = db.collection("orders").where("status", "==", "pending");
    } else if (estadoFilter === "delivery") {
      query = db.collection("orders").where("status", "in", ["bodegaEnvioPedido", "caminoATienda"]);
    } else {
      query = db.collection("orders").where("status", "in", [
        "pending",
        "pedidoTomado",
        "pedidoEnBodega",
        "bodegaEnvioPedido",
        "caminoATienda"
      ]);
    }
    
    // Filtros adicionales según rol
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
    
    // Filtro: Tipo de Entrega (Entrega en Tienda o Bodega)
    const deliveryType = document.getElementById("deliveryTypeFilter")?.value || "all";
    if (deliveryType !== "all") {
      query = query.where("destination", "==", deliveryType);
    }
    
    // Filtro por fecha
    const dateValue = document.getElementById("dateSearchInput")?.value;
    if (dateValue) {
      const startDate = new Date(dateValue);
      const endDate = new Date(dateValue);
      endDate.setDate(endDate.getDate() + 1);
      query = query.where("timestamp", ">=", startDate).where("timestamp", "<", endDate);
    }
  }
  
  const sortValue = document.getElementById("sortOrder")?.value || "masReciente";
  query = sortValue === "masReciente" ? query.orderBy("timestamp", "desc") : query.orderBy("timestamp", "asc");

  inProcessUnsubscribe = query.onSnapshot(
    snapshot => {
      const cont = document.getElementById("inProcessOrdersAdminCards");
      cont.innerHTML = "";
      snapshot.forEach(doc => {
        const order = doc.data();
        if (["pending", "pedidoTomado", "pedidoEnBodega", "bodegaEnvioPedido", "caminoATienda"].includes(order.status)) {
          const card = createOrderCard(doc.id, order);
          cont.appendChild(card);
        }
      });
    },
    error => {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message
      });
    }
  );
}

function attachCompletedListener() {
  if (completedUnsubscribe) completedUnsubscribe();
  const idSearch = document.getElementById("idSearchInput")?.value?.trim();
  let query;

  if (idSearch) {
    query = db
      .collection("orders")
      .where("status", "==", "sucursalRecibioPedido")
      .where("orderId", "==", idSearch);
  } else {
    query = db
      .collection("orders")
      .where("status", "==", "sucursalRecibioPedido");
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

    const dateValue = document.getElementById("dateSearchInput")?.value;
    if (dateValue) {
      const startDate = new Date(dateValue);
      const endDate = new Date(dateValue);
      endDate.setDate(endDate.getDate() + 1);
      query = query.where("timestamp", ">=", startDate).where("timestamp", "<", endDate);
    }
  }

  const sortValue = document.getElementById("sortOrder")?.value || "masReciente";
  query = sortValue === "masReciente" ? query.orderBy("timestamp", "desc") : query.orderBy("timestamp", "asc");

  completedUnsubscribe = query.onSnapshot(
    snapshot => {
      const cont = document.getElementById("completedOrdersAdminCards");
      if (cont) cont.innerHTML = "";
      snapshot.forEach(doc => {
        const order = doc.data();
        if (order.status === "sucursalRecibioPedido") {
          const card = createOrderCard(doc.id, order);
          cont.appendChild(card);
        }
      });
    },
    error => {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message
      });
    }
  );
}

/**********************************************************
 * reloadOrders: Se invoca cuando cambian los filtros
 **********************************************************/
function reloadOrders() {
  attachInProcessListener();
  attachCompletedListener();
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
    <p><strong>Destino:</strong> ${order.destination || "No definido"}</p>
    <div class="order-status">${generateProgressBar(order)}</div>
  `;

  html += `<button onclick="showOrderDetails('${orderDocId}')">Mostrar Pedido</button>`;

  // Solo editar si no es administrador, o si se tienen permisos
  if (userRole !== "administrador") {
    if (order.status === "pending") {
      html += `<button onclick="editOrder('${orderDocId}')">Editar Pedido</button>`;
    }
    if (userPermissions.canEditOrder) {
      html += `<button onclick="editOrder('${orderDocId}')">Editar Pedido</button>`;
    }
  }

  // Administrador: pedido pending => pedidoTomado / Eliminar
  if (order.status === "pending" && userRole === "administrador") {
    html += `
      <button onclick="markOrderAsTaken('${orderDocId}')">Pedido Tomado por Proveedor</button>
      <button onclick="deleteOrder('${orderDocId}')">Eliminar Pedido</button>
    `;
  }

  // Exportar Pedido completo (solo admin)
  if (userRole === "administrador") {
    html += `<button onclick="exportOrder('${orderDocId}')">Exportar Pedido</button>`;
  }

  // Permiso para eliminar pedido
  if (userRole === "administrador" || userPermissions.canDeleteOrder) {
    html += `<button onclick="deleteOrder('${orderDocId}')">Eliminar Pedido</button>`;
  }

  // Destino Bodega (admin)
  if (order.destination === "Bodega" && userRole === "administrador") {
    if (order.status === "pedidoTomado") {
      html += `
        <button onclick="updateStatus('${orderDocId}','pedidoEnBodega')">Pedido en Bodega</button>
        <button onclick="updateStatus('${orderDocId}','bodegaEnvioPedido')">Bodega Envío Pedido</button>
      `;
    }
    if (order.status === "pedidoEnBodega") {
      html += `<button onclick="updateStatus('${orderDocId}','bodegaEnvioPedido')">Bodega Envío Pedido</button>`;
    }
    if (order.status === "bodegaEnvioPedido") {
      html += `<button onclick="confirmOrder('${orderDocId}')">Ingresar Cantidades</button>`;
    }
  }

  // Destino Tienda (admin)
  if (order.destination === "Tienda" && userRole === "administrador") {
    if (order.status === "pedidoTomado") {
      html += `<button onclick="updateStatus('${orderDocId}','caminoATienda')">Camino a Tienda</button>`;
    }
    if (order.status === "caminoATienda") {
      html += `<button onclick="confirmOrder('${orderDocId}')">Ingresar Cantidades</button>`;
    }
  }

  // Encargado no admin
  if (userRole !== "administrador") {
    if (order.destination === "Bodega" && order.status === "bodegaEnvioPedido") {
      html += `<button onclick="confirmOrder('${orderDocId}')">Ingresar Cantidades</button>`;
    }
    if (order.destination === "Tienda" && order.status === "caminoATienda") {
      html += `<button onclick="confirmOrder('${orderDocId}')">Ingresar Cantidades</button>`;
    }
  }

  // Si ya existen cantidades ingresadas, se permite ver/exportar la recepción
  if (order.receivedProducts && order.receivedProducts.length > 0) {
    html += `<button onclick="showReceivedOrder('${orderDocId}')">Exportar Pedido Recibido</button>`;
  }

  // Forzar a completar (excepción) si faltan facturas o hay cantidades incompletas
  if (
    userRole === "administrador" &&
    (order.pendingInvoice || order.mismatchedQuantities)
  ) {
    html += `<button onclick="forceCompleteOrder('${orderDocId}')">Forzar a Completar (Excepción)</button>`;
  }

  // Botón para cambiar estado manualmente (admin)
  if (userRole === "administrador") {
    html += `<button class="change-status-button" onclick="openChangeStatusModal('${orderDocId}')">Cambiar Estado</button>`;
  }

  card.innerHTML = html;
  return card;
}

/**********************************************************
 * updateStatus
 **********************************************************/
function updateStatus(orderDocId, newStatus) {
  Swal.fire({
    title: `¿Cambiar estado a '${newStatus}'?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "Cancelar"
  }).then(async res => {
    if (res.isConfirmed) {
      try {
        await db.collection("orders").doc(orderDocId).update({ status: newStatus });
        Swal.fire({ icon: "success", title: `Estado cambiado a '${newStatus}'` });
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}

/**********************************************************
 * forceCompleteOrder
 **********************************************************/
function forceCompleteOrder(orderDocId) {
  Swal.fire({
    title: "Forzar a completar pedido",
    input: "text",
    inputLabel: "Motivo de la excepción:",
    inputPlaceholder: "Ingresa el motivo...",
    showCancelButton: true,
    confirmButtonText: "Forzar completar",
    cancelButtonText: "Cancelar",
    inputValidator: value => {
      return !value ? "Por favor ingresa un motivo" : null;
    }
  }).then(async result => {
    if (result.isConfirmed) {
      try {
        await db.collection("orders").doc(orderDocId).update({
          status: "sucursalRecibioPedido",
          mismatchComment: result.value,
          commentSource: "admin",
          pendingInvoice: false,
          mismatchedQuantities: false
        });
        Swal.fire({ icon: "success", title: "Pedido completado con excepción" });
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}

/**********************************************************
 * generateProgressBar & createProgressBarHTML
 **********************************************************/
function generateProgressBar(order) {
  const dest = order.destination || "Bodega";
  const flow =
    dest === "Tienda"
      ? [
          { key: "pending", label: "Pendiente" },
          { key: "pedidoTomado", label: "Pedido Tomado" },
          { key: "caminoATienda", label: "En Camino a Tienda" },
          { key: "sucursalRecibioPedido", label: "Sucursal Recibió Pedido" }
        ]
      : [
          { key: "pending", label: "Pendiente" },
          { key: "pedidoTomado", label: "Pedido Tomado" },
          { key: "pedidoEnBodega", label: "Pedido en Bodega" },
          { key: "bodegaEnvioPedido", label: "Bodega Envío Pedido" },
          { key: "sucursalRecibioPedido", label: "Sucursal Recibió Pedido" }
        ];

  return createProgressBarHTML(flow, order.status);
}

function createProgressBarHTML(flowArray, currentStatus) {
  const currentIndex = flowArray.findIndex(s => s.key === currentStatus);
  let progressHTML = `<div class="progress-container">`;
  flowArray.forEach((st, idx) => {
    let stepClass = "";
    if (idx < currentIndex) stepClass = "completed";
    else if (idx === currentIndex) stepClass = "current";
    progressHTML += `
      <div class="progress-step ${stepClass}">
        <div class="step-number">${idx + 1}</div>
        <div class="step-label">${st.label}</div>
      </div>
    `;
    if (idx < flowArray.length - 1) {
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
        Swal.fire({ icon: "success", title: "Pedido Tomado" });
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}

/**********************************************************
 * deleteOrder
 **********************************************************/
async function deleteOrder(orderId) {
  Swal.fire({
    title: "¿Eliminar Pedido?",
    text: "Esto no se puede revertir.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  }).then(async res => {
    if (res.isConfirmed) {
      try {
        await db.collection("orders").doc(orderId).delete();
        Swal.fire({ icon: "success", title: "Pedido eliminado" });
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}

/**********************************************************
 * showOrderDetails
 **********************************************************/
function showOrderDetails(orderId) {
  db.collection("orders")
    .doc(orderId)
    .get()
    .then(docSnap => {
      if (!docSnap.exists) {
        Swal.fire({ icon: "error", title: "No encontrado" });
        return;
      }
      const order = docSnap.data();
      let html = `
        <p><strong>ID Pedido:</strong> ${order.orderId}</p>
        <p><strong>Proveedor:</strong> ${order.providerName}</p>
        <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
        <p><strong>Fecha de Pedido:</strong> ${order.orderDate}</p>
        <p><strong>Destino:</strong> ${order.destination || "No definido"}</p>
      `;
      if (order.products) {
        html += `<table><thead><tr>
                   <th>Producto</th>
                   <th>Presentación</th>
                   <th>Cantidad</th>
                 </tr></thead><tbody>`;
        order.products.forEach(prod => {
          html += `<tr>
                     <td>${prod.name}</td>
                     <td>${prod.presentation}</td>
                     <td>${prod.quantity}</td>
                   </tr>`;
        });
        html += `</tbody></table>`;
      }
      if (order.status === "pending") {
        html += `<button onclick="editOrder('${docSnap.id}')">Editar Pedido</button>`;
      }
      document.getElementById("orderDetails").innerHTML = html;
      document.getElementById("orderDetailsModal").style.display = "block";

      const exportImageButton = document.getElementById("exportOrderImageButton");
      if (exportImageButton) {
        exportImageButton.onclick = () => {
          exportAsImageDirect(orderId);
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
 * editOrder, addProductRow, removeProductRow, saveEditedOrder,
 * closeEditOrderModal
 **********************************************************/
function editOrder(orderDocId) {
  db.collection("orders")
    .doc(orderDocId)
    .get()
    .then(docSnap => {
      if (!docSnap.exists) {
        Swal.fire({ icon: "error", title: "Pedido no encontrado" });
        return;
      }
      const order = docSnap.data();

      document.getElementById("editOrderDocId").value = orderDocId;
      document.getElementById("editOrderIdDisplay").textContent = order.orderId;
      document.getElementById("editOrderDestination").value = order.destination || "";

      const tbody = document.getElementById("editOrderProducts");
      tbody.innerHTML = "";
      if (order.products && order.products.length > 0) {
        order.products.forEach((prod) => {
          tbody.insertAdjacentHTML("beforeend", `
            <tr>
              <td><input type="text" value="${prod.name}" class="editProdName"/></td>
              <td><input type="text" value="${prod.presentation}" class="editProdPresentation"/></td>
              <td><input type="number" value="${prod.quantity}" min="0" class="editProdQuantity"/></td>
              <td><button type="button" onclick="removeProductRow(this)">Eliminar</button></td>
            </tr>
          `);
        });
      }
      document.getElementById("editOrderModal").style.display = "block";
    })
    .catch(err => {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    });
}

function addProductRow() {
  const tbody = document.getElementById("editOrderProducts");
  const newRow = document.createElement("tr");
  newRow.innerHTML = `
    <td><input type="text" placeholder="Nombre del producto" class="editProdName"/></td>
    <td><input type="text" placeholder="Presentación" class="editProdPresentation"/></td>
    <td><input type="number" placeholder="Cantidad" min="0" class="editProdQuantity"/></td>
    <td><button type="button" onclick="removeProductRow(this)">Eliminar</button></td>
  `;
  tbody.appendChild(newRow);
}

function removeProductRow(btn) {
  const row = btn.parentNode.parentNode;
  row.parentNode.removeChild(row);
}

async function saveEditedOrder() {
  try {
    const orderDocId = document.getElementById("editOrderDocId").value;
    const destination = document.getElementById("editOrderDestination").value;

    const prodNames = Array.from(document.getElementsByClassName("editProdName")).map(input => input.value);
    const prodPresentations = Array.from(document.getElementsByClassName("editProdPresentation")).map(input => input.value);
    const prodQuantities = Array.from(document.getElementsByClassName("editProdQuantity")).map(input => parseFloat(input.value) || 0);

    let products = [];
    for (let i = 0; i < prodNames.length; i++) {
      products.push({
        name: prodNames[i],
        presentation: prodPresentations[i],
        quantity: prodQuantities[i]
      });
    }

    await db.collection("orders").doc(orderDocId).update({
      destination: destination,
      products: products,
      lastEditTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
      lastEditedBy: loggedInUsername
    });

    Swal.fire({
      icon: "success",
      title: "Pedido editado",
      text: "Se han guardado los cambios."
    });
    closeEditOrderModal();
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

function closeEditOrderModal() {
  document.getElementById("editOrderDetails").innerHTML = "";
  document.getElementById("editOrderModal").style.display = "none";
}

/**********************************************************
 * Funciones para agregar/eliminar facturas adicionales
 **********************************************************/
function addInvoiceRow() {
  const container = document.getElementById("additionalInvoicesRows");
  const row = document.createElement("div");
  row.className = "invoice-row";
  row.innerHTML = `
    <label>Número de Factura:</label>
    <input type="number" class="additionalInvoiceNumber"/>
    <label>Fecha de Factura:</label>
    <input type="date" class="additionalInvoiceDate"/>
    <button type="button" onclick="removeInvoiceRow(this)">Eliminar</button>
    <br/><br/>
  `;
  container.appendChild(row);
}

function removeInvoiceRow(btn) {
  const row = btn.parentNode;
  row.parentNode.removeChild(row);
}

/**********************************************************
 * exportOrder, closeExportModal, exportAs, exportAsImageDirect,
 * exportAsImage, exportAsExcel
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
    const docRef = await db.collection("orders").doc(orderId).get();
    if (!docRef.exists) {
      Swal.fire({ icon: "error", title: "Pedido no encontrado" });
      return;
    }
    const order = docRef.data();
    const fileName = `Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;

    if (format === "image") {
      exportAsImage(order, fileName);
    } else if (format === "pdf") {
      Swal.fire({
        icon: "warning",
        title: "Deshabilitado",
        text: "Exportar a PDF no disponible."
      });
    } else if (format === "excel") {
      exportAsExcel(order, fileName);
    }
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al exportar",
      text: error.message
    });
  }
  closeExportModal();
}

async function exportAsImageDirect(orderId) {
  try {
    const docSnap = await db.collection("orders").doc(orderId).get();
    if (!docSnap.exists) {
      Swal.fire({ icon: "error", title: "Pedido no encontrado" });
      return;
    }
    const order = docSnap.data();
    const fileName = `Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;
    exportAsImageTicket(order, fileName);
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

function exportAsImage(order, fileName) {
  const hiddenDiv = document.getElementById("exportHiddenContainer");
  const exportOrderIdHidden = document.getElementById("exportOrderIdHidden");
  const exportProviderHidden = document.getElementById("exportProviderHidden");
  const exportSucursalHidden = document.getElementById("exportSucursalHidden");
  const exportFechaHidden = document.getElementById("exportFechaHidden");
  const exportLastEditHidden = document.getElementById("exportLastEditHidden");
  const exportLogoImg = document.getElementById("exportLogo");
  const tBody = document.getElementById("exportProductsTableBody");

  if (
    !exportOrderIdHidden ||
    !exportProviderHidden ||
    !exportSucursalHidden ||
    !exportFechaHidden ||
    !exportLastEditHidden ||
    !exportLogoImg ||
    !tBody
  ) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Elementos de exportación no encontrados."
    });
    return;
  }

  exportOrderIdHidden.textContent = order.orderId;
  exportProviderHidden.textContent = order.providerName;
  exportSucursalHidden.textContent = order.sucursalName;
  exportFechaHidden.textContent = order.orderDate;

  if (order.lastEditTimestamp) {
    const editDate = new Date(order.lastEditTimestamp.toDate());
    exportLastEditHidden.textContent = `Pedido editado el: ${editDate.toLocaleString()} por: ${
      order.lastEditedBy || "N/A"
    }`;
  } else {
    exportLastEditHidden.textContent = "";
  }

  exportLogoImg.src = logoBase64 || "../resources/images/logo.png";
  tBody.innerHTML = "";

  if (order.products) {
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
  }

  hiddenDiv.style.width = "1200px";
  hiddenDiv.style.display = "block";
  hiddenDiv.style.left = "50%";
  hiddenDiv.style.top = "50%";
  hiddenDiv.style.transform = "translate(-50%, -50%)";

  html2canvas(hiddenDiv, { scale: 3 })
    .then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(err => {
      Swal.fire({
        icon: "error",
        title: "Error al exportar",
        text: "No se pudo exportar la imagen"
      });
    })
    .finally(() => {
      hiddenDiv.style.display = "none";
      hiddenDiv.style.width = "";
      hiddenDiv.style.left = "-9999px";
      hiddenDiv.style.top = "-9999px";
      hiddenDiv.style.transform = "none";
    });
}

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
    ws_data.push([
      "Última Edición",
      editDate + " por: " + (order.lastEditedBy || "N/A")
    ]);
    ws_data.push([]);
  }

  ws_data.push(["Producto", "Presentación", "Cantidad"]);

  if (order.products) {
    order.products.forEach(prod => {
      ws_data.push([prod.name, prod.presentation, prod.quantity]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Pedido");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**********************************************************
 * exportAsImageTicket:
 **********************************************************/
function exportAsImageTicket(order, fileName) {
  const ticket = document.getElementById("orderDetailsForImage");
  if (!ticket) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Ticket de exportación no encontrado."
    });
    return;
  }
  document.getElementById("imgOrderId").textContent = order.orderId;
  document.getElementById("imgProviderName").textContent = order.providerName;
  document.getElementById("imgSucursalName").textContent = order.sucursalName;
  document.getElementById("imgDestination").textContent = order.destination;

  const regDate = order.savedDate || order.orderDate;
  document.getElementById("imgSaveDate").textContent = regDate;

  const tBody = document.getElementById("imgProductsTableBody");
  tBody.innerHTML = "";

  if (order.products) {
    order.products.forEach(prod => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${prod.name}</td>
        <td>${prod.presentation}</td>
        <td>${prod.quantity}</td>
      `;
      tBody.appendChild(row);
    });
  }

  ticket.style.display = "block";
  ticket.style.left = "50%";
  ticket.style.top = "50%";
  ticket.style.transform = "translate(-50%, -50%)";

  html2canvas(ticket, { scale: 3 })
    .then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(err => {
      Swal.fire({
        icon: "error",
        title: "Error al exportar",
        text: "No se pudo exportar la imagen"
      });
    })
    .finally(() => {
      ticket.style.display = "none";
      ticket.style.left = "-9999px";
      ticket.style.top = "-9999px";
      ticket.style.transform = "none";
    });
}

/**********************************************************
 * confirmOrder, updateTotalPerProduct, calculateInvoiceTotal,
 * closeConfirmOrderModal, saveConfirmedOrder
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
    document.getElementById("orderIdDisplay").textContent = order.orderId;
    document.getElementById("providerNameDisplay").textContent = order.providerName;
    document.getElementById("sucursalNameDisplay").textContent = order.sucursalName;
    document.getElementById("orderDateDisplay").textContent = order.orderDate;

    const tBody = document.getElementById("confirmOrderProducts");
    tBody.innerHTML = "";
    const receivedArr = order.receivedProducts || [];

    if (order.products) {
      order.products.forEach((prod, i) => {
        const rData = receivedArr[i] || {};
        const receivedQty = rData.receivedQuantity === 0 ? "" : rData.receivedQuantity;
        const priceVal = rData.unitPrice === 0 ? "" : rData.unitPrice;
        const totalVal = rData.totalPerProduct || 0;
        const commentsVal = rData.comments || "";

        tBody.insertAdjacentHTML("beforeend", `
          <tr>
            <td>${prod.name}</td>
            <td>${prod.presentation}</td>
            <td>${prod.quantity}</td>
            <td>
              <input type="number" id="receivedQuantity${i}" min="0"
                     value="${receivedQty}"
                     onchange="updateTotalPerProduct(${i}, ${prod.quantity})" />
            </td>
            <td>
              <input type="number" id="unitPrice${i}" step="0.01" min="0"
                     value="${priceVal}"
                     onchange="updateTotalPerProduct(${i}, ${prod.quantity})" />
            </td>
            <td>Q<span id="totalPerProduct${i}">${Number(totalVal).toFixed(2)}</span></td>
            <td>
              <input type="text" id="productComments${i}" value="${commentsVal}" placeholder="Comentarios" />
            </td>
          </tr>
        `);
      });
    }
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
  document.getElementById("confirmOrderModal").style.display = "none";
}

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

    if (!noInvoice && (!invoiceNumberField || !invoiceDateField)) {
      Swal.fire({
        icon: "warning",
        title: "Faltan datos de factura",
        text: "Ingresa la factura o marca 'No se ingresó la factura'."
      });
      return;
    }

    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      Swal.fire({ icon: "error", title: "Error", text: "Pedido no existe en DB" });
      return;
    }
    const orderData = orderDoc.data();

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

      if (qRecibida !== qPedida) {
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

    let pendingInvoice = noInvoice;
    const invoiceTotalValue = Number(totalFactura.toFixed(2));

    // Recopilar información de facturas
    let invoices = [];
    if (document.getElementById("multipleInvoicesCheckbox").checked) {
      if (invoiceNumberField && invoiceDateField) {
        invoices.push({ invoiceNumber: invoiceNumberField, invoiceDate: invoiceDateField });
      }
      const additionalRows = document.querySelectorAll(".invoice-row");
      additionalRows.forEach(row => {
        const invNum = row.querySelector(".additionalInvoiceNumber").value.trim();
        const invDate = row.querySelector(".additionalInvoiceDate").value.trim();
        if (invNum && invDate) {
          invoices.push({ invoiceNumber: invNum, invoiceDate: invDate });
        }
      });
    } else {
      invoices = [{ invoiceNumber: invoiceNumberField, invoiceDate: invoiceDateField }];
    }

    if (mismatchedQuantities || pendingInvoice) {
      const { value: reason } = await Swal.fire({
        title: "Motivo del faltante o no factura",
        input: "text",
        inputLabel: "Comentario:",
        inputPlaceholder: "Ej. 'No llegó factura', 'Producto incompleto'...",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
        confirmButtonText: "Guardar",
        inputValidator: value => {
          return !value ? "Por favor ingresa un comentario." : null;
        }
      });
      if (!reason) return;

      await db.collection("orders").doc(orderId).update({
        invoices: invoices,
        pendingInvoice,
        receivedProducts,
        invoiceTotal: invoiceTotalValue,
        mismatchedQuantities,
        mismatchComment: reason,
        commentSource: "encargado"
      });

      Swal.fire({
        icon: "success",
        title: "Recepción Guardada con Faltantes/Comentario",
        text: pendingInvoice
          ? "Esperando factura"
          : "Producto faltante. Total Factura: Q" + invoiceTotalValue
      });
      closeConfirmOrderModal();
      return;
    }

    await db.collection("orders").doc(orderId).update({
      invoices: invoices,
      pendingInvoice: false,
      receivedProducts,
      invoiceTotal: invoiceTotalValue,
      mismatchedQuantities: false,
      mismatchComment: "",
      status: "sucursalRecibioPedido"
    });

    Swal.fire({
      icon: "success",
      title: "Recepción Guardada",
      text: "Todo coincide y se ingresó factura. Total Factura: Q" + invoiceTotalValue
    }).then(() => {
      showReceivedOrder(orderId);
    });
    closeConfirmOrderModal();
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * showReceivedOrder, closeReceivedOrderModal
 **********************************************************/
function showReceivedOrder(orderId) {
  db.collection("orders").doc(orderId).get()
    .then(docSnap => {
      if (!docSnap.exists) {
        Swal.fire({ icon: "error", title: "Pedido no encontrado" });
        return;
      }
      const order = docSnap.data();

      let html = `
        <p><strong>ID Pedido:</strong> ${order.orderId}</p>
        <p><strong>Proveedor:</strong> ${order.providerName}</p>
        <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
        <p><strong>Fecha de Pedido:</strong> ${order.orderDate}</p>
        <p><strong>Facturas:</strong></p>
      `;

      if (order.invoices && order.invoices.length > 0) {
        html += `<ul>`;
        order.invoices.forEach(inv => {
          html += `<li>N°: ${inv.invoiceNumber} – Fecha: ${inv.invoiceDate}</li>`;
        });
        html += `</ul>`;
      } else {
        html += `<p>No ingresado</p>`;
      }

      html += `<p><strong>Total de la Factura:</strong> Q${order.invoiceTotal || 0}</p>`;

      if (order.mismatchComment) {
        let prefix = (order.commentSource === "admin") ? "Comentario del Admin:" : "Comentario de Encargado:";
        html += `<p style="color:red;"><strong>${prefix}</strong> ${order.mismatchComment}</p>`;
      }

      html += `<table>
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
                 <tbody>`;
      if (order.receivedProducts) {
        order.receivedProducts.forEach(rp => {
          html += `<tr>
                     <td>${rp.name}</td>
                     <td>${rp.presentation}</td>
                     <td>${rp.quantity}</td>
                     <td>${rp.receivedQuantity}</td>
                     <td>Q${rp.unitPrice}</td>
                     <td>Q${rp.totalPerProduct}</td>
                     <td>${rp.comments || ""}</td>
                   </tr>`;
        });
      }
      html += `</tbody></table>`;

      document.getElementById("receivedOrderDetails").innerHTML = html;
      document.getElementById("receivedOrderModal").style.display = "block";

      const fileName = `Recepcion_Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;
      exportAsReceptionImageNoPreview(order, fileName);
    })
    .catch(err => {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    });
}

function closeReceivedOrderModal() {
  document.getElementById("receivedOrderDetails").innerHTML = "";
  document.getElementById("receivedOrderModal").style.display = "none";
}

/**********************************************************
 * exportReception & Related Functions (SIN VISTA PREVIA)
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
    exportReceptionAsImageNoPreview(order, fileName);
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error al exportar", text: error.message });
  }
}

async function exportReceptionAsImageNoPreview(order, fileName) {
  exportAsReceptionImageNoPreview(order, fileName);
}

/**
 * exportAsReceptionImageNoPreview: Genera y descarga la imagen directamente, sin vista previa
 */
function exportAsReceptionImageNoPreview(order, fileName) {
  const hiddenDiv = document.getElementById("exportReceptionHiddenContainer");
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

  if (
    !exportReceptionOrderIdHidden ||
    !exportReceptionProviderHidden ||
    !exportReceptionSucursalHidden ||
    !exportReceptionOrderDateHidden ||
    !exportReceptionInvoiceNumberHidden ||
    !exportReceptionInvoiceDateHidden ||
    !exportReceptionInvoiceTotalHidden ||
    !exportReceptionLastEditHidden ||
    !exportReceptionLogoImg ||
    !exportReceptionTBody
  ) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Elementos de exportación no encontrados."
    });
    return;
  }

  hiddenDiv.style.width = "1200px";

  exportReceptionOrderIdHidden.textContent = order.orderId;
  exportReceptionProviderHidden.textContent = order.providerName;
  exportReceptionSucursalHidden.textContent = order.sucursalName;
  exportReceptionOrderDateHidden.textContent = order.orderDate;

  if (order.invoices && order.invoices.length > 0) {
    let invoiceInfo = order.invoices
      .map(inv => `N°: ${inv.invoiceNumber} – Fecha: ${inv.invoiceDate}`)
      .join(" | ");
    exportReceptionInvoiceNumberHidden.textContent = invoiceInfo;
    exportReceptionInvoiceDateHidden.textContent = "";
  } else {
    exportReceptionInvoiceNumberHidden.textContent = order.invoiceNumber || "No ingresado";
    exportReceptionInvoiceDateHidden.textContent = order.invoiceDate || "No ingresada";
  }

  exportReceptionInvoiceTotalHidden.textContent = order.invoiceTotal
    ? `Q${order.invoiceTotal}`
    : "Q0.00";

  if (order.lastEditTimestamp) {
    const editDate = new Date(order.lastEditTimestamp.toDate());
    exportReceptionLastEditHidden.textContent = `Pedido editado el: ${editDate.toLocaleString()} por: ${
      order.lastEditedBy || "N/A"
    }`;
  } else {
    exportReceptionLastEditHidden.textContent = "";
  }

  exportReceptionLogoImg.src = logoBase64 || "../resources/images/logo.png";
  exportReceptionTBody.innerHTML = "";

  if (order.receivedProducts) {
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
      tdAdver.textContent =
        prod.receivedQuantity < prod.quantity
          ? "Cantidad menor a la pedida."
          : "—";
      tdComm.textContent = prod.comments || "—";

      row.appendChild(tdName);
      row.appendChild(tdPres);
      row.appendChild(tdQtyPed);
      row.appendChild(tdQtyRec);
      row.appendChild(tdAdver);
      row.appendChild(tdComm);

      exportReceptionTBody.appendChild(row);
    });
  }

  hiddenDiv.style.display = "block";
  hiddenDiv.style.left = "50%";
  hiddenDiv.style.top = "50%";
  hiddenDiv.style.transform = "translate(-50%, -50%)";

  html2canvas(hiddenDiv, { scale: 3 })
    .then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imgData;
      link.download = fileName + ".png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(err => {
      Swal.fire({
        icon: "error",
        title: "Error al exportar",
        text: "No se pudo generar la imagen."
      });
    })
    .finally(() => {
      hiddenDiv.style.display = "none";
      hiddenDiv.style.width = "";
      hiddenDiv.style.left = "-9999px";
      hiddenDiv.style.top = "-9999px";
      hiddenDiv.style.transform = "none";
    });
}

/**********************************************************
 * escapeHtml (puedes dejarla si la usas en otro lado)
 **********************************************************/
function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, m => map[m]);
}