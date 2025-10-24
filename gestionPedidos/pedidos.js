/**********************************************************
 * VARIABLES GLOBALES + ESTADO
 **********************************************************/
let userSucursalId = null;
let loggedInUsername = null;
let userRole = null;
let userPermissions = {};
let logoBase64 = "";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const debounce = (fn, ms = 250) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

const state = {
  role: null,
  sucursalId: null,
  filters: {
    id: "",
    estado: "all",
    delivery: "all",
    provider: "all",
    sucursal: "all",
    date: null,
    sort: "masReciente",
  },
};

let inProcessUnsubscribe = null;
let completedUnsubscribe = null;
let currentOrderForStatusChange = null;

// Mapa idDoc -> elemento card
const orderEls = new Map();

window.exportReceptionDownloadFileName = "";

/**********************************************************
 * BOOTSTRAP
 **********************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  await initUserAndSucursal();
  state.role = userRole;
  state.sucursalId = userSucursalId;

  if (userRole === "administrador" || userRole === "view") {
    $("#adminFilterContainer").style.display = "block";
    loadSucursalesForAdmin();
    loadProvidersForAdmin();
  }

  loadLogo();
  wireFilters();
  wireStaticButtons();
  wireGlobalActions();

  // Tabs por data-atributos
  wireTabs();

  // Suscripciones iniciales
  attachInProcessListener();
  attachCompletedListener();
});

/**********************************************************
 * INIT USER
 **********************************************************/
async function initUserAndSucursal() {
  loggedInUsername = localStorage.getItem("usuarioLogueado");
  if (!loggedInUsername) {
    Swal.fire({
      icon: "warning",
      title: "No hay usuario logueado",
      text: "Redirigiendo a login...",
    }).then(() => (window.location.href = "login.html"));
    return;
  }
  const loggedInUserDiv = $("#loggedInUser");
  if (loggedInUserDiv) loggedInUserDiv.textContent = "Usuario: " + loggedInUsername;

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
        text: "Inicia sesión nuevamente.",
      }).then(() => (window.location.href = "login.html"));
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
 * UTILS UI / WIRING
 **********************************************************/
function wireTabs() {
  document.getElementById("tabContainer").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab-target]");
    if (!btn) return;
    const targetId = btn.getAttribute("data-tab-target");
    $$(".tab-button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $$(".container").forEach((c) => (c.style.display = "none"));
    document.getElementById(targetId).style.display = "block";
  });
}

function wireStaticButtons() {
  // Header
  $("#btnMainMenu")?.addEventListener("click", goToMainMenu);

  // Modales - cierres
  $("#btnCloseOrderDetails")?.addEventListener("click", closeOrderDetailsModal);
  $("#btnCloseExportModal")?.addEventListener("click", closeExportModal);
  $("#btnCloseEditOrder")?.addEventListener("click", closeEditOrderModal);
  $("#btnCloseConfirmOrder")?.addEventListener("click", closeConfirmOrderModal);
  $("#btnCloseReceivedOrder")?.addEventListener("click", closeReceivedOrderModal);
  $("#btnCloseChangeStatus")?.addEventListener("click", closeChangeStatusModal);

  // Edit modal actions
  $("#btnAddProductRow")?.addEventListener("click", addProductRow);
  $("#btnSaveEditedOrder")?.addEventListener("click", saveEditedOrder);
  $("#editOrderProducts")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='removeRow']");
    if (btn) removeProductRow(btn);
  });

  // Export modal
  $("#exportModalButtons")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-export-format]");
    if (!btn) return;
    exportAs(btn.getAttribute("data-export-format"));
  });

  // Confirm reception
  $("#btnSaveReception")?.addEventListener("click", saveConfirmedOrder);
  $("#btnExportReceived")?.addEventListener("click", () => {
    const id = $("#confirmOrderId")?.value || "";
    if (id) exportAsReceivedOrderImage(id);
  });
  $("#btnAddInvoice")?.addEventListener("click", addNewInvoiceEntry);
  
  // Manejo de cálculos de facturas
  $("#confirmOrderProducts").addEventListener("input", (e) => {
    if (e.target.matches('input[type="number"]')) {
      updateInvoiceTotals();
    }
  });

  $("#invoicesList").addEventListener("input", (e) => {
    if (e.target.matches('input[type="text"]')) {
      updateInvoiceNumbers();
    }
  });

  // Cambiar estado manual
  $("#changeStatusButtons")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='changeManualStatus']");
    if (!btn) return;
    changeOrderStatusManually(btn.getAttribute("data-status"));
  });

  // Compatibilidad con ventana externa (descarga recepción)
  document.addEventListener("exportReception", (ev) => {
    const id = ev.detail;
    if (id) exportReception(id);
  });
}

function wireFilters() {
  const onChange = debounce(() => {
    state.filters.id = $("#idSearchInput")?.value?.trim() || "";
    state.filters.estado = $("#estadoFilter")?.value || "all";
    state.filters.delivery = $("#deliveryTypeFilter")?.value || "all";
    state.filters.provider = $("#providerFilter")?.value || "all";
    state.filters.sucursal = $("#sucursalFilter")?.value || "all";
    state.filters.sort = $("#sortOrder")?.value || "masReciente";

    // Guardamos Date real para construir el rango exacto del día
    state.filters.date = $("#dateSearchInput")?.value
      ? new Date($("#dateSearchInput").value)
      : null;

    // Re-suscribimos con los nuevos filtros
    attachInProcessListener();
    attachCompletedListener();
  }, 200);

  [
    "sucursalFilter",
    "providerFilter",
    "estadoFilter",
    "deliveryTypeFilter",
    "sortOrder",
    "idSearchInput",
    "dateSearchInput",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ev = id.includes("Filter") || id.includes("date") ? "change" : "input";
    el.addEventListener(ev, onChange);
  });
}

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

function goToMainMenu() {
  window.location.href = "../index.html";
}

/**********************************************************
 * FILTROS ADMIN
 **********************************************************/
async function loadSucursalesForAdmin() {
  const sel = $("#sucursalFilter");
  sel.innerHTML = `<option value="all">Todas las sucursales</option>`;
  try {
    const snap = await db.collection("sucursales").get();
    snap.forEach((doc) => {
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
async function loadProvidersForAdmin() {
  const sel = $("#providerFilter");
  sel.innerHTML = `<option value="all">Todos los Proveedores</option>`;
  try {
    const ordersSnap = await db.collection("orders").limit(500).get();
    const uniqueProviders = new Set();
    ordersSnap.forEach((doc) => {
      if (doc.data().providerName) uniqueProviders.add(doc.data().providerName);
    });
    Array.from(uniqueProviders)
      .sort()
      .forEach((provider) => {
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
 * QUERY BUILDER + WATCHERS (docChanges)
 * (Corregido: filtros por estado y fecha)
 **********************************************************/
function buildOrdersBaseQuery() {
  let q = db.collection("orders");

  // Búsqueda por ID exacto: salimos temprano
  if (state.filters.id) {
    q = q.where("orderId", "==", state.filters.id);
    return q
      .orderBy("timestamp", state.filters.sort === "masAntiguo" ? "asc" : "desc")
      .limit(50);
  }

  // Rol y filtros base
  if (state.role !== "administrador" && state.role !== "view") {
    q = q.where("sucursalId", "==", state.sucursalId);
  } else {
    if (state.filters.sucursal !== "all")
      q = q.where("sucursalId", "==", state.filters.sucursal);
    if (state.filters.provider !== "all")
      q = q.where("providerName", "==", state.filters.provider);
  }
  if (state.filters.delivery !== "all")
    q = q.where("destination", "==", state.filters.delivery);

  // Filtro por FECHA (rango del día) — requiere orderBy en el mismo campo
  if (state.filters.date) {
    const start = new Date(state.filters.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    q = q.where("timestamp", ">=", start).where("timestamp", "<", end);
  }

  // Filtro por ESTADO: si se elige uno específico, lo aplicamos aquí
  if (state.filters.estado !== "all") {
    q = q.where("status", "==", state.filters.estado);
  }

  // Orden
  return q
    .orderBy("timestamp", state.filters.sort === "masAntiguo" ? "asc" : "desc")
    .limit(50);
}

function watchOrders(container, statuses) {
  // Limpia suscripción previa
  if (container._unsub) container._unsub();

  let q = buildOrdersBaseQuery();

  // Si NO hay un estado específico seleccionado, limitamos por el conjunto del contenedor
  if (state.filters.estado === "all") {
    q = q.where("status", "in", statuses);
  }

  container.innerHTML = "";
  orderEls.clear();

  container._unsub = q.onSnapshot(
    (snap) => {
      snap.docChanges().forEach((ch) => {
        const id = ch.doc.id;
        const data = ch.doc.data();
        if (ch.type === "added") {
          const el = renderOrderCard(id, data);
          orderEls.set(id, el);
          container.appendChild(el);
        } else if (ch.type === "modified") {
          const oldEl = orderEls.get(id);
          const newEl = renderOrderCard(id, data);
          if (oldEl) oldEl.replaceWith(newEl);
          orderEls.set(id, newEl);
        } else if (ch.type === "removed") {
          const oldEl = orderEls.get(id);
          if (oldEl) oldEl.remove();
          orderEls.delete(id);
        }
      });
    },
    (error) => {
      Swal.fire({ icon: "error", title: "Error", text: error.message });
    }
  );
}

function attachInProcessListener() {
  const cont = $("#inProcessOrdersAdminCards");
  const statuses = [
    "pending",
    "pedidoTomado",
    "pedidoEnBodega",
    "bodegaEnvioPedido",
    "caminoATienda",
  ];
  watchOrders(cont, statuses);
}
function attachCompletedListener() {
  const cont = $("#completedOrdersAdminCards");
  watchOrders(cont, ["sucursalRecibioPedido"]);
}

/**********************************************************
 * TARJETAS + ACCIONES (delegación)
 **********************************************************/
function renderOrderCard(orderDocId, order) {
  const card = document.createElement("div");
  card.className = "order-card";
  const actions = [];

  actions.push(
    `<button data-action="show" data-id="${orderDocId}">Mostrar Pedido</button>`
  );

  if (
    userRole !== "administrador" &&
    userRole !== "view" &&
    (order.status === "pending" || userPermissions.canEditOrder)
  ) {
    actions.push(
      `<button data-action="edit" data-id="${orderDocId}">Editar Pedido</button>`
    );
  }
  if (order.status === "pending" && userRole === "administrador") {
    actions.push(
      `<button data-action="markTaken" data-id="${orderDocId}">Pedido Tomado por Proveedor</button>`
    );
    actions.push(
      `<button data-action="delete" data-id="${orderDocId}">Eliminar Pedido</button>`
    );
  }
  if (userRole === "administrador") {
    actions.push(
      `<button data-action="exportOrder" data-id="${orderDocId}">Exportar Pedido</button>`
    );
    actions.push(
      `<button class="change-status-button" data-action="openChange" data-id="${orderDocId}">Cambiar Estado</button>`
    );
  } else if (userRole === "view") {
    // For view role, only show export button
    actions.push(
      `<button data-action="exportOrder" data-id="${orderDocId}">Exportar Pedido</button>`
    );
  }
  if ((userRole === "administrador" || userPermissions.canDeleteOrder) && userRole !== "view") {
    actions.push(
      `<button data-action="delete" data-id="${orderDocId}">Eliminar Pedido</button>`
    );
  }

  const toConfirm =
    (order.destination === "Bodega" && order.status === "bodegaEnvioPedido") ||
    (order.destination === "Tienda" && order.status === "caminoATienda") ||
    (userRole === "administrador" &&
      (order.status === "bodegaEnvioPedido" || order.status === "caminoATienda"));
  if (toConfirm && userRole !== "view")
    actions.push(
      `<button data-action="confirm" data-id="${orderDocId}">Ingresar Cantidades</button>`
    );

  if (order.receivedProducts?.length) {
    actions.push(
      `<button data-action="showReceived" data-id="${orderDocId}">Exportar Pedido Recibido</button>`
    );
  }
  if (
    userRole === "administrador" &&
    userRole !== "view" &&
    (order.pendingInvoice || order.mismatchedQuantities)
  ) {
    actions.push(
      `<button data-action="forceComplete" data-id="${orderDocId}">Forzar a Completar (Excepción)</button>`
    );
  }

  card.innerHTML = `
    <h3>Pedido ID: ${order.orderId}</h3>
    <p>Proveedor: ${order.providerName}</p>
    <p>Sucursal: ${order.sucursalName}</p>
    <p>Fecha: ${order.orderDate}</p>
    <p><strong>Destino:</strong> ${order.destination || "No definido"}</p>
    <div class="order-status">${generateProgressBar(order)}</div>
    <div class="order-actions">${actions.join("")}</div>
  `;
  return card;
}

function wireGlobalActions() {
  // Delegación global para botones de tarjetas
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    const map = {
      show: showOrderDetails,
      edit: editOrder,
      markTaken: markOrderAsTaken,
      delete: deleteOrder,
      exportOrder: exportOrder,
      openChange: openChangeStatusModal,
      confirm: confirmOrder,
      showReceived: showReceivedOrder,
      forceComplete: forceCompleteOrder,
    };
    const fn = map[action];
    if (fn) fn(id);
  });
}

/**********************************************************
 * ESTADOS
 **********************************************************/
function updateStatus(orderDocId, newStatus) {
  Swal.fire({
    title: `¿Cambiar estado a '${newStatus}'?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "Cancelar",
  }).then(async (res) => {
    if (res.isConfirmed) {
      try {
        await db.collection("orders").doc(orderDocId).update({ status: newStatus });
        Swal.fire({ icon: "success", title: `Estado cambiado a '${newStatus}'` });
        // Refresca la vista automáticamente
        attachInProcessListener();
        attachCompletedListener();
        closeChangeStatusModal();
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}
function forceCompleteOrder(orderDocId) {
  Swal.fire({
    title: "Forzar a completar pedido",
    input: "text",
    inputLabel: "Motivo de la excepción:",
    inputPlaceholder: "Ingresa el motivo...",
    showCancelButton: true,
    confirmButtonText: "Forzar completar",
    cancelButtonText: "Cancelar",
    inputValidator: (value) => (!value ? "Por favor ingresa un motivo" : null),
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await db.collection("orders").doc(orderDocId).update({
          status: "sucursalRecibioPedido",
          mismatchComment: result.value,
          commentSource: "admin",
          pendingInvoice: false,
          mismatchedQuantities: false,
        });
        Swal.fire({ icon: "success", title: "Pedido completado con excepción" });
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}
function openChangeStatusModal(orderDocId) {
  currentOrderForStatusChange = orderDocId;
  $("#changeStatusModal").style.display = "block";
}
function closeChangeStatusModal() {
  $("#changeStatusModal").style.display = "none";
  currentOrderForStatusChange = null;
}
function changeOrderStatusManually(newStatus) {
  if (!currentOrderForStatusChange) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se ha seleccionado ningún pedido para cambiar el estado.",
    });
    return;
  }
  updateStatus(currentOrderForStatusChange, newStatus);
}

/**********************************************************
 * PROGRESO
 **********************************************************/
const FLOWS = {
  Tienda: [
    { key: "pending", label: "Pendiente" },
    { key: "pedidoTomado", label: "Pedido Tomado" },
    { key: "caminoATienda", label: "En Camino a Tienda" },
    { key: "sucursalRecibioPedido", label: "Sucursal Recibió Pedido" },
  ],
  Bodega: [
    { key: "pending", label: "Pendiente" },
    { key: "pedidoTomado", label: "Pedido Tomado" },
    { key: "pedidoEnBodega", label: "Pedido en Bodega" },
    { key: "bodegaEnvioPedido", label: "Bodega Envío Pedido" },
    { key: "sucursalRecibioPedido", label: "Sucursal Recibió Pedido" },
  ],
};
function generateProgressBar(order) {
  const dest = order.destination === "Tienda" ? "Tienda" : "Bodega";
  return createProgressBarHTML(FLOWS[dest], order.status);
}
function createProgressBarHTML(flowArray, currentStatus) {
  const currentIndex = flowArray.findIndex((s) => s.key === currentStatus);
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
      progressHTML += `<div class="progress-line ${
        idx < currentIndex ? "completed" : ""
      }"></div>`;
    }
  });
  progressHTML += `</div>`;
  return progressHTML;
}

/**********************************************************
 * ACCIONES BÁSICAS
 **********************************************************/
async function markOrderAsTaken(orderId) {
  Swal.fire({
    title: "¿Marcar como 'Pedido Tomado'?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "Cancelar",
  }).then(async (res) => {
    if (res.isConfirmed) {
      try {
        await db.collection("orders").doc(orderId).update({ status: "pedidoTomado" });
        Swal.fire({ icon: "success", title: "Pedido Tomado" });
        // Actualiza la vista automáticamente
        attachInProcessListener();
        attachCompletedListener();
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}
async function deleteOrder(orderId) {
  Swal.fire({
    title: "¿Eliminar Pedido?",
    text: "Esto no se puede revertir.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
  }).then(async (res) => {
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
 * DETALLES PEDIDO
 **********************************************************/
function showOrderDetails(orderId) {
  db.collection("orders")
    .doc(orderId)
    .get()
    .then((docSnap) => {
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
        order.products.forEach((prod) => {
          html += `<tr>
                     <td>${prod.name}</td>
                     <td>${prod.presentation}</td>
                     <td>${prod.quantity}</td>
                   </tr>`;
        });
        html += `</tbody></table>`;
      }
      $("#orderDetails").innerHTML = html;
      $("#orderDetailsModal").style.display = "block";

      const exportImageButton = $("#exportOrderImageButton");
      if (exportImageButton)
        exportImageButton.onclick = () =>
          exportAsImageTicket(
            order,
            `Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`
          );

      const editBtn = $("#editOrderFromDetailsBtn");
      if (editBtn) {
        if (
          (order.status === "pending" ||
          userPermissions.canEditOrder ||
          userRole === "administrador") &&
          userRole !== "view"
        ) {
          editBtn.style.display = "inline-block";
          editBtn.onclick = () => editOrder(docSnap.id);
        } else {
          editBtn.style.display = "none";
        }
      }
    })
    .catch((err) =>
      Swal.fire({ icon: "error", title: "Error", text: err.message })
    );
}
function closeOrderDetailsModal() {
  $("#orderDetails").innerHTML = "";
  $("#orderDetailsModal").style.display = "none";
}

/**********************************************************
 * EDITAR PEDIDO
 **********************************************************/
function editOrder(orderDocId) {
  db.collection("orders")
    .doc(orderDocId)
    .get()
    .then((docSnap) => {
      if (!docSnap.exists) {
        Swal.fire({ icon: "error", title: "Pedido no encontrado" });
        return;
      }
      const order = docSnap.data();

      const idInput = $("#editOrderDocId");
      const idDisplay = $("#editOrderIdDisplay");
      const destSel = $("#editOrderDestination");
      const tbody = $("#editOrderProducts");

      if (!idInput || !idDisplay || !destSel || !tbody) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Formulario de edición no disponible.",
        });
        return;
      }

      idInput.value = orderDocId;
      idDisplay.textContent = order.orderId;
      destSel.value = order.destination || "Bodega";

      tbody.innerHTML = "";
      if (order.products?.length) {
        order.products.forEach((prod) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><input type="text" value="${prod.name}" class="editProdName"/></td>
            <td><input type="text" value="${prod.presentation}" class="editProdPresentation"/></td>
            <td><input type="number" value="${prod.quantity}" min="0" class="editProdQuantity"/></td>
            <td><button type="button" data-action="removeRow">Eliminar</button></td>
          `;
          tbody.appendChild(tr);
        });
      }
      $("#editOrderModal").style.display = "block";
    })
    .catch((err) =>
      Swal.fire({ icon: "error", title: "Error", text: err.message })
    );
}
function addProductRow() {
  const tbody = $("#editOrderProducts");
  const newRow = document.createElement("tr");
  newRow.innerHTML = `
    <td><input type="text" placeholder="Nombre del producto" class="editProdName"/></td>
    <td><input type="text" placeholder="Presentación" class="editProdPresentation"/></td>
    <td><input type="number" placeholder="Cantidad" min="0" class="editProdQuantity"/></td>
    <td><button type="button" data-action="removeRow">Eliminar</button></td>
  `;
  tbody.appendChild(newRow);
}
function removeProductRow(btn) {
  const row = btn.closest("tr");
  row?.parentNode?.removeChild(row);
}
async function saveEditedOrder() {
  try {
    const orderDocId = $("#editOrderDocId").value;
    const destination = $("#editOrderDestination").value;

    const prodNames = Array.from($$(".editProdName")).map((input) => input.value);
    const prodPresentations = Array.from($$(".editProdPresentation")).map(
      (input) => input.value
    );
    const prodQuantities = Array.from($$(".editProdQuantity")).map(
      (input) => parseFloat(input.value) || 0
    );

    const products = prodNames.map((name, i) => ({
      name,
      presentation: prodPresentations[i],
      quantity: prodQuantities[i],
    }));

    await db.collection("orders").doc(orderDocId).update({
      destination,
      products,
      lastEditTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
      lastEditedBy: loggedInUsername,
    });

    Swal.fire({
      icon: "success",
      title: "Pedido editado",
      text: "Se han guardado los cambios.",
    });
    closeEditOrderModal();
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}
function closeEditOrderModal() {
  const form = $("#editOrderForm");
  if (form) form.reset();
  const tbody = $("#editOrderProducts");
  if (tbody) tbody.innerHTML = "";
  const idDisplay = $("#editOrderIdDisplay");
  if (idDisplay) idDisplay.textContent = "";
  $("#editOrderModal").style.display = "none";
}

/**********************************************************
 * EXPORTACIONES
 **********************************************************/
function exportOrder(orderId) {
  $("#exportModal").style.display = "block";
  $("#exportModal").dataset.orderId = orderId;
}
function closeExportModal() {
  $("#exportModal").style.display = "none";
}
async function exportAs(format) {
  const modal = $("#exportModal");
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
      exportAsImageTicket(order, fileName);
    } else if (format === "pdf") {
      Swal.fire({
        icon: "warning",
        title: "Deshabilitado",
        text: "Exportar a PDF no disponible.",
      });
    } else if (format === "excel") {
      exportAsExcel(order, fileName);
    }
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error al exportar", text: error.message });
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
function exportAsExcel(order, fileName) {
  const wb = XLSX.utils.book_new();
  const ws_data = [
    ["ID Pedido", order.orderId],
    ["Proveedor", order.providerName],
    ["Sucursal", order.sucursalName],
    ["Fecha", order.orderDate],
    [],
  ];
  if (order.lastEditTimestamp) {
    const editDate = new Date(order.lastEditTimestamp.toDate()).toLocaleString();
    ws_data.push([
      "Última Edición",
      editDate + " por: " + (order.lastEditedBy || "N/A"),
    ]);
    ws_data.push([]);
  }
  ws_data.push(["Producto", "Presentación", "Cantidad"]);
  if (order.products) {
    order.products.forEach((prod) =>
      ws_data.push([prod.name, prod.presentation, prod.quantity])
    );
  }
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Pedido");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
function exportAsImageTicket(order, fileName) {
  const ticket = $("#orderDetailsForImage");
  if (!ticket) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Ticket de exportación no encontrado.",
    });
    return;
  }
  $("#imgOrderId").textContent = order.orderId;
  $("#imgProviderName").textContent = order.providerName;
  $("#imgSucursalName").textContent = order.sucursalName;
  $("#imgDestination").textContent = order.destination || "";
  $("#imgSaveDate").textContent = order.savedDate || order.orderDate;

  const tBody = $("#imgProductsTableBody");
  tBody.innerHTML = "";
  if (order.products) {
    order.products.forEach((prod) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${prod.name}</td><td>${prod.presentation}</td><td>${prod.quantity}</td>`;
      tBody.appendChild(row);
    });
  }

  ticket.style.display = "block";
  ticket.style.left = "50%";
  ticket.style.top = "50%";
  ticket.style.transform = "translate(-50%, -50%)";

  html2canvas(ticket, { scale: 3 })
    .then((canvas) => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(() =>
      Swal.fire({
        icon: "error",
        title: "Error al exportar",
        text: "No se pudo exportar la imagen",
      })
    )
    .finally(() => {
      ticket.style.display = "none";
      ticket.style.left = "-9999px";
      ticket.style.top = "-9999px";
      ticket.style.transform = "none";
    });
}

/**********************************************************
 * RECEPCIÓN (ACTUALIZADO)
 **********************************************************/
async function confirmOrder(orderId) {
  try {
    if (!orderId) {
      console.error("No se proporcionó ID de pedido");
      return;
    }

    const docSnap = await db.collection("orders").doc(orderId).get();
    if (!docSnap.exists) {
      Swal.fire({ icon: "error", title: "Pedido no encontrado" });
      return;
    }
    const order = docSnap.data();

    $("#confirmOrderId").value = orderId;

    // Inicializar la lista de facturas con una entrada
    $("#invoicesList").innerHTML = `
      <div class="invoice-entry">
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <label><strong>Número de Factura:</strong></label>
            <input type="text" class="invoice-number" placeholder="Ingrese número de factura" />
          </div>
          <div>
            <label><strong>Fecha de Factura:</strong></label>
            <input type="date" class="invoice-date" value="${new Date().toISOString().split('T')[0]}" />
          </div>
        </div>
      </div>
    `;

    $("#orderIdDisplay").textContent = order.orderId;
    $("#providerNameDisplay").textContent = order.providerName;
    $("#sucursalNameDisplay").textContent = order.sucursalName;
    $("#orderDateDisplay").textContent = order.orderDate;

    const tBody = $("#confirmOrderProducts");
    tBody.innerHTML = "";
    const receivedArr = order.receivedProducts || [];

    if (order.products) {
      order.products.forEach((prod, i) => {
        const rData = receivedArr[i] || {};
        const receivedQty = rData.receivedQuantity === 0 ? "" : rData.receivedQuantity;
        const priceVal = rData.unitPrice === 0 ? "" : rData.unitPrice;
        const totalVal = rData.totalPerProduct || 0;
        const commentsVal = rData.comments || "";
        tBody.insertAdjacentHTML(
          "beforeend",
          `
          <tr>
            <td>${prod.name}</td>
            <td>${prod.presentation}</td>
            <td>${prod.quantity}</td>
            <td><input type="number" id="receivedQuantity${i}" min="0" value="${receivedQty}" onchange="updateTotalPerProduct(${i})" /></td>
            <td><input type="number" id="unitPrice${i}" step="0.01" min="0" value="${priceVal}" onchange="updateTotalPerProduct(${i})" /></td>
            <td>Q<span id="totalPerProduct${i}">${Number(totalVal).toFixed(2)}</span></td>
            <td><input type="text" id="productComments${i}" value="${commentsVal}" placeholder="Comentarios" /></td>
          </tr>
        `
        );
      });
    }
    
    // Inicializar totales
    $("#invoiceTotalsList").innerHTML = "";
    $("#grandTotal").textContent = "0.00";
    updateInvoiceTotals();

    $("#confirmOrderModal").style.display = "block";
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}
function updateTotalPerProduct(i) {
  const qtyInput = document.getElementById(`receivedQuantity${i}`);
  const priceInput = document.getElementById(`unitPrice${i}`);
  const totalSpan = document.getElementById(`totalPerProduct${i}`);

  let q = parseFloat(qtyInput.value) || 0;
  let p = parseFloat(priceInput.value) || 0;
  if (q < 0) q = 0;
  if (p < 0) p = 0;

  qtyInput.value = q;
  priceInput.value = p;

  totalSpan.textContent = (q * p).toFixed(2);
  updateInvoiceTotals();
}
function addNewInvoiceEntry() {
  const invoicesList = $("#invoicesList");
  const newEntry = document.createElement("div");
  newEntry.className = "invoice-entry";
  newEntry.innerHTML = `
    <div style="display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-end;">
      <div>
        <label><strong>Número de Factura:</strong></label>
        <input type="text" class="invoice-number" placeholder="Ingrese número de factura" />
      </div>
      <div>
        <label><strong>Fecha de Factura:</strong></label>
        <input type="date" class="invoice-date" />
      </div>
      <button type="button" class="remove-invoice" style="height: 2rem;">×</button>
    </div>
  `;
  
  newEntry.querySelector(".remove-invoice").addEventListener("click", (e) => {
    e.target.closest(".invoice-entry").remove();
    updateInvoiceTotals();
  });

  invoicesList.appendChild(newEntry);
}

function updateInvoiceNumbers() {
  const invoiceEntries = document.querySelectorAll(".invoice-entry");
  const invoiceNumbers = Array.from(invoiceEntries).map(entry => 
    entry.querySelector(".invoice-number").value
  ).filter(Boolean);
  
  return invoiceNumbers;
}

function updateInvoiceTotals() {
  let grandTotal = 0;
  const rows = $$("#confirmOrderProducts tr");
  const invoiceTotalsList = $("#invoiceTotalsList");
  invoiceTotalsList.innerHTML = "";
  
  const invoiceEntries = document.querySelectorAll(".invoice-entry");
  
  invoiceEntries.forEach((entry, index) => {
    let invoiceTotal = 0;
    rows.forEach((_, idx) => {
      const val = parseFloat(
        document.getElementById(`totalPerProduct${idx}`).textContent
      ) || 0;
      invoiceTotal += val / invoiceEntries.length; // Distribuir el total entre las facturas
    });
    grandTotal += invoiceTotal;
    
    const invoiceNumber = entry.querySelector(".invoice-number").value || `Factura ${index + 1}`;
    invoiceTotalsList.innerHTML += `
      <div style="margin-bottom: 0.5rem;">
        <strong>${invoiceNumber}:</strong> Q<span class="invoice-total">${invoiceTotal.toFixed(2)}</span>
      </div>
    `;
  });
  
  $("#grandTotal").textContent = grandTotal.toFixed(2);
}
function closeConfirmOrderModal() {
  $("#confirmOrderId").value = "";
  $("#orderIdDisplay").textContent = "";
  $("#providerNameDisplay").textContent = "";
  $("#sucursalNameDisplay").textContent = "";
  $("#orderDateDisplay").textContent = "";
  $("#confirmOrderProducts").innerHTML = "";
  $("#invoicesList").innerHTML = `
    <div class="invoice-entry">
      <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <label for="invoiceNumber"><strong>Número de Factura:</strong></label>
          <input type="text" class="invoice-number" placeholder="Ingrese número de factura" />
        </div>
        <div>
          <label for="invoiceDate"><strong>Fecha de Factura:</strong></label>
          <input type="date" class="invoice-date" value="${new Date().toISOString().split('T')[0]}" />
        </div>
      </div>
    </div>
  `;
  $("#invoiceTotalsList").innerHTML = "";
  $("#grandTotal").textContent = "0.00";
  $("#confirmOrderModal").style.display = "none";
}
async function saveConfirmedOrder() {
  try {
    const orderId = $("#confirmOrderId").value;
    if (!orderId) {
      Swal.fire({ icon: "error", title: "Error", text: "No se encontró el pedido." });
      return;
    }

    // Verificar que haya al menos una factura con número
    const invoiceNumbers = updateInvoiceNumbers();
    if (invoiceNumbers.length === 0) {
      Swal.fire({ 
        icon: "error", 
        title: "Error", 
        text: "Debe ingresar al menos un número de factura." 
      });
      return;
    }

    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      Swal.fire({ icon: "error", title: "Error", text: "Pedido no existe en DB" });
      return;
    }
    const orderData = orderDoc.data();

    // Recolectar información de facturas
    const invoiceEntries = document.querySelectorAll(".invoice-entry");
    const invoices = Array.from(invoiceEntries).map(entry => ({
      invoiceNumber: entry.querySelector(".invoice-number").value,
      invoiceDate: entry.querySelector(".invoice-date").value || new Date().toISOString().split('T')[0],
      total: parseFloat(entry.closest(".invoice-entry").querySelector(".invoice-total")?.textContent || "0")
    })).filter(invoice => invoice.invoiceNumber);

    const rows = $$("#confirmOrderProducts tr");
    let mismatchedQuantities = false;
    let totalFactura = 0;
    const receivedProducts = [];

    rows.forEach((_, i) => {
      const originalProd = orderData.products[i];
      const qPedida = parseFloat(originalProd.quantity) || 0;
      const qRecibida = parseFloat(document.getElementById(`receivedQuantity${i}`).value) || 0;
      const pUnit = parseFloat(document.getElementById(`unitPrice${i}`).value) || 0;
      const totalCell = parseFloat(document.getElementById(`totalPerProduct${i}`).textContent) || 0;
      const commentsVal = document.getElementById(`productComments${i}`).value.trim();

      if (qRecibida !== qPedida) mismatchedQuantities = true;
      totalFactura += totalCell;

      receivedProducts.push({
        name: originalProd.name,
        presentation: originalProd.presentation,
        quantity: qPedida,
        receivedQuantity: qRecibida,
        unitPrice: pUnit,
        totalPerProduct: totalCell,
        comments: commentsVal,
      });
    });

    // Usar los datos de factura ya recolectados anteriormente
    const invoicesList = invoices;

    const invoiceTotalValue = Number(totalFactura.toFixed(2));
    const pendingInvoice = false;

    if (mismatchedQuantities) {
      const { value: reason } = await Swal.fire({
        title: "Motivo del faltante",
        input: "text",
        inputLabel: "Comentario:",
        inputPlaceholder: "Ej. 'Producto incompleto'...",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
        confirmButtonText: "Guardar",
        inputValidator: (value) => (!value ? "Por favor ingresa un comentario." : null),
      });
      if (!reason) return;

      await db.collection("orders").doc(orderId).update({
        invoices: invoicesList,
        pendingInvoice,
        receivedProducts,
        invoiceTotal: invoiceTotalValue,
        mismatchedQuantities: true,
        mismatchComment: reason,
        commentSource: "encargado",
      });

      Swal.fire({
        icon: "success",
        title: "Recepción Guardada con Faltantes",
        text: "Total Factura: Q" + invoiceTotalValue,
      });
      closeConfirmOrderModal();
      return;
    }

    await db.collection("orders").doc(orderId).update({
      invoices: invoicesList,
      pendingInvoice,
      receivedProducts,
      invoiceTotal: invoiceTotalValue,
      mismatchedQuantities: false,
      mismatchComment: "",
      status: "sucursalRecibioPedido",
    });

    Swal.fire({
      icon: "success",
      title: "Recepción Guardada",
      text: "Todo coincide. Total Factura: Q" + invoiceTotalValue,
    }).then(() => showReceivedOrder(orderId));
    closeConfirmOrderModal();
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * VER / EXPORTAR RECEPCIÓN
 **********************************************************/
function showReceivedOrder(orderId) {
  db.collection("orders")
    .doc(orderId)
    .get()
    .then((docSnap) => {
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
      if (order.invoices?.length) {
        html += `<ul>`;
        order.invoices.forEach((inv) => {
          html += `<li>N°: ${inv.invoiceNumber} – Fecha: ${inv.invoiceDate}</li>`;
        });
        html += `</ul>`;
      } else {
        html += `<p>No ingresado</p>`;
      }
      html += `<p><strong>Total de la Factura:</strong> Q${order.invoiceTotal || 0}</p>`;
      if (order.mismatchComment) {
        const prefix =
          order.commentSource === "admin"
            ? "Comentario del Admin:"
            : "Comentario de Encargado:";
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
        order.receivedProducts.forEach((rp) => {
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

      $("#receivedOrderDetails").innerHTML = html;
      $("#receivedOrderModal").style.display = "block";

      const fileName = `Recepcion_Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;
      exportAsReceptionImageNoPreview(order, fileName);
    })
    .catch((err) =>
      Swal.fire({ icon: "error", title: "Error", text: err.message })
    );
}
function closeReceivedOrderModal() {
  $("#receivedOrderDetails").innerHTML = "";
  $("#receivedOrderModal").style.display = "none";
}
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
function exportAsReceptionImageNoPreview(order, fileName) {
  const hiddenDiv = $("#exportReceptionHiddenContainer");
  const exportReceptionOrderIdHidden = $("#exportReceptionOrderIdHidden");
  const exportReceptionProviderHidden = $("#exportReceptionProviderHidden");
  const exportReceptionSucursalHidden = $("#exportReceptionSucursalHidden");
  const exportReceptionOrderDateHidden = $("#exportReceptionOrderDateHidden");
  const exportReceptionInvoiceNumberHidden = $("#exportReceptionInvoiceNumberHidden");
  const exportReceptionInvoiceDateHidden = $("#exportReceptionInvoiceDateHidden");
  const exportReceptionInvoiceTotalHidden = $("#exportReceptionInvoiceTotalHidden");
  const exportReceptionLastEditHidden = $("#exportReceptionLastEditHidden");
  const exportReceptionLogoImg = $("#exportReceptionLogo");
  const exportReceptionTBody = $("#exportReceptionProductsTableBody");

  if (
    !hiddenDiv ||
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
      text: "Elementos de exportación no encontrados.",
    });
    return;
  }

  hiddenDiv.style.width = "1200px";

  exportReceptionOrderIdHidden.textContent = order.orderId;
  exportReceptionProviderHidden.textContent = order.providerName;
  exportReceptionSucursalHidden.textContent = order.sucursalName;
  exportReceptionOrderDateHidden.textContent = order.orderDate;

  if (order.invoices && order.invoices.length > 0) {
    const invoiceInfo = order.invoices
      .map((inv) => `N°: ${inv.invoiceNumber} – Fecha: ${inv.invoiceDate}`)
      .join(" | ");
    exportReceptionInvoiceNumberHidden.textContent = invoiceInfo;
    exportReceptionInvoiceDateHidden.textContent = "";
  } else {
    exportReceptionInvoiceNumberHidden.textContent = order.invoiceNumber || "No ingresado";
    exportReceptionInvoiceDateHidden.textContent = order.invoiceDate || "No ingresada";
  }

  exportReceptionInvoiceTotalHidden.textContent = order.invoiceTotal
    ? Number(order.invoiceTotal).toFixed(2)
    : "0.00";

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
    order.receivedProducts.forEach((prod) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${prod.name}</td>
        <td>${prod.presentation}</td>
        <td>${prod.quantity}</td>
        <td>${prod.receivedQuantity}</td>
        <td>${prod.receivedQuantity < prod.quantity ? "Cantidad menor a la pedida." : "—"}</td>
        <td>${prod.comments || "—"}</td>
      `;
      exportReceptionTBody.appendChild(row);
    });
  }

  hiddenDiv.style.display = "block";
  hiddenDiv.style.left = "50%";
  hiddenDiv.style.top = "50%";
  hiddenDiv.style.transform = "translate(-50%, -50%)";

  html2canvas(hiddenDiv, { scale: 3 })
    .then((canvas) => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = fileName + ".png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(() =>
      Swal.fire({
        icon: "error",
        title: "Error al exportar",
        text: "No se pudo generar la imagen.",
      })
    )
    .finally(() => {
      hiddenDiv.style.display = "none";
      hiddenDiv.style.width = "";
      hiddenDiv.style.left = "-9999px";
      hiddenDiv.style.top = "-9999px";
      hiddenDiv.style.transform = "none";
    });
}

/**********************************************************
 * UTIL
 **********************************************************/
function escapeHtml(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(str).replace(/[&<>"']/g, (m) => map[m]);
}

async function markOrderAsTaken(orderId) {
  Swal.fire({
    title: "¿Marcar como 'Pedido Tomado'?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí",
    cancelButtonText: "Cancelar",
  }).then(async (res) => {
    if (res.isConfirmed) {
      try {
        await db.collection("orders").doc(orderId).update({ status: "pedidoTomado" });
        Swal.fire({ icon: "success", title: "Pedido Tomado" });
        // Actualiza la vista automáticamente
        attachInProcessListener();
        attachCompletedListener();
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}