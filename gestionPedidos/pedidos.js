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

  // Inicializar controles de promedios
  await initUsageAverageModalControls();

  // Dashboard Stats
  initDashboardStats();
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
    }).then(() => (window.location.href = "../login.html"));
    return;
  }
  const loggedInUserDiv = $("#loggedInEmail");
  if (loggedInUserDiv) loggedInUserDiv.textContent = loggedInUsername;

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
      }).then(() => (window.location.href = "../login.html"));
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
  $$(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab-target");
      $$(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $$(".tab-view").forEach(v => v.style.display = "none");
      $("#" + targetId).style.display = "block";
    });
  });
}

function wireStaticButtons() {
  // Header
  $("#btnMainMenu")?.addEventListener("click", goToMainMenu);
  $("#btnConfigAverages")?.addEventListener("click", showUsageAverageModal);

  // Modales - cierres
  $("#btnCloseOrderDetails")?.addEventListener("click", closeOrderDetailsModal);
  $("#btnCloseUsageAverage")?.addEventListener("click", closeUsageAverageModal);
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
  $("#confirmOrderProducts")?.addEventListener("input", (e) => {
    if (e.target.matches('input[type="number"]')) {
      updateInvoiceTotals();
    }
  });

  $("#invoicesList")?.addEventListener("input", (e) => {
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

  // Configurar Promedios
  $("#btnSaveUsageAverages")?.addEventListener("click", saveUsageAverages);
  $("#avgProviderSelect")?.addEventListener("change", (e) => loadProductsForAverage(e.target.value));
  $("#avgProductSearch")?.addEventListener("keyup", filterAvgProducts);
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
  card.dataset.action = "show";
  card.dataset.id = orderDocId;

  const statusConfig = getStatusConfig(order.status);
  const progress = generateProgressBar(order);

  const actions = [];

  if (userRole !== "administrador" && userRole !== "view" && (order.status === "pending" || userPermissions.canEditOrder)) {
    actions.push(`<button class="btn btn-secondary btn-sm" style="flex:1;" data-action="edit" data-id="${orderDocId}"><i class="fas fa-edit"></i></button>`);
  }

  if (order.status === "pending" && userRole === "administrador") {
    actions.push(`<button class="btn btn-warning btn-sm" style="flex:1;" data-action="markTaken" data-id="${orderDocId}"><i class="fas fa-check"></i></button>`);
  }

  if (userRole === "administrador") {
    actions.push(`<button class="btn btn-secondary btn-sm" style="flex:1;" data-action="openChange" data-id="${orderDocId}"><i class="fas fa-exchange-alt"></i></button>`);
  }

  if ((userRole === "administrador" || userPermissions.canDeleteOrder) && userRole !== "view") {
    actions.push(`<button class="btn btn-danger btn-sm" style="padding: 10px;" data-action="delete" data-id="${orderDocId}"><i class="fas fa-trash"></i></button>`);
  }

  const toConfirm = (order.destination === "Bodega" && order.status === "bodegaEnvioPedido") ||
    (order.destination === "Tienda" && order.status === "caminoATienda") ||
    (userRole === "administrador" && (order.status === "bodegaEnvioPedido" || order.status === "caminoATienda"));

  let receiveBtn = "";
  if (toConfirm && userRole !== "view") {
    receiveBtn = `
      <div style="display:flex; gap:8px; margin-top:12px; width:100%;">
        <button class="btn btn-success btn-sm" style="flex:1;" data-action="confirm" data-id="${orderDocId}">Recibir</button>
        <button class="btn btn-primary btn-sm" style="flex:1;" data-action="directReceive" data-id="${orderDocId}">Recibir Directo</button>
      </div>
    `;
  }

  if (order.receivedProducts?.length) {
    actions.push(`<button class="btn btn-success btn-sm" style="flex:1;" data-action="showReceived" data-id="${orderDocId}"><i class="fas fa-receipt"></i></button>`);
  }

  if (userRole === "administrador" && userRole !== "view" && (order.pendingInvoice || order.mismatchedQuantities)) {
    actions.push(`<button class="btn btn-danger btn-sm" style="flex:1;" data-action="forceComplete" data-id="${orderDocId}"><i class="fas fa-exclamation-triangle"></i></button>`);
  }

  card.innerHTML = `
    <div class="card-header">
        <span class="card-id">#${order.orderId}</span>
        <span class="card-date">${order.orderDate}</span>
    </div>
    <div class="card-body">
        <div class="card-sucursal">${order.sucursalName}</div>
        <h3>${order.providerName}</h3>
        <div class="info-col">
            <div class="info-row"><i class="fas fa-map-marker-alt"></i> <span><b>Destino:</b> ${order.destination || "Buscando..."}</span></div>
        </div>
        <div class="status-progress-col">
            <span class="status-badge" style="background: ${statusConfig.color}20; color: ${statusConfig.color};">
                <i class="fas fa-info-circle"></i> ${statusConfig.label}
            </span>
            <div class="progress-track">
                <div class="progress-fill" style="width: ${statusConfig.percent}%; background: ${statusConfig.color};"></div>
            </div>
        </div>
    </div>
    ${receiveBtn}
    <div class="card-actions">
        ${actions.join("")}
    </div>
  `;

  // Quick Receive for Admin
  if (userRole === "administrador" && order.status !== "sucursalRecibioPedido") {
    const qBtn = document.createElement("button");
    qBtn.className = "btn btn-primary btn-sm";
    qBtn.style.position = "absolute";
    qBtn.style.top = "10px";
    qBtn.style.right = "10px";
    qBtn.style.zIndex = "10";
    qBtn.innerHTML = "<i class='fas fa-bolt'></i>";
    qBtn.title = "Recibir Rápido (Admin)";
    qBtn.dataset.action = "quickReceive";
    qBtn.dataset.id = orderDocId;
    card.appendChild(qBtn);
  }

  return card;
}

function getStatusConfig(status) {
  const map = {
    pending: { label: "Pendiente", color: "#6366f1", percent: 10 },
    pedidoTomado: { label: "Tomado", color: "#f59e0b", percent: 30 },
    pedidoEnBodega: { label: "En Bodega", color: "#8b5cf6", percent: 50 },
    bodegaEnvioPedido: { label: "Enviado", color: "#ec4899", percent: 70 },
    caminoATienda: { label: "En Camino", color: "#0ea5e9", percent: 80 },
    sucursalRecibioPedido: { label: "Completado", color: "#10b981", percent: 100 }
  };
  return map[status] || map.pending;
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
      directReceive: markOrderAsReceivedDirectly,
      quickReceive: quickReceiveOrder, // Nueva acción rápida
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
        Swal.fire({ icon: "success", title: `Estado cambiado a '${newStatus}'` });
        // Refresca la vista automáticamente gracias al onSnapshot
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
        const orderRef = db.collection("orders").doc(orderDocId);
        const docSnap = await orderRef.get();
        if (!docSnap.exists) throw new Error("Pedido no encontrado");
        const orderData = docSnap.data();

        const batch = db.batch();

        batch.update(orderRef, {
          status: "sucursalRecibioPedido",
          mismatchComment: result.value,
          commentSource: "admin",
          pendingInvoice: false,
          mismatchedQuantities: false,
        });

        // Crear facturas en Cuentas por Pagar si existen
        if (orderData.invoices && Array.isArray(orderData.invoices)) {
          orderData.invoices.forEach((inv) => {
            const facturaRef = db.collection('facturas_pagar').doc();
            const fechaEmision = new Date(inv.invoiceDate);
            const fechaVencimiento = new Date(fechaEmision);
            fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

            batch.set(facturaRef, {
              numeroFactura: inv.invoiceNumber,
              pedidoId: orderDocId,
              orderId: orderData.orderId,
              proveedorId: orderData.providerName,
              proveedorNombre: orderData.providerName,
              fechaEmision: inv.invoiceDate,
              fechaVencimiento: fechaVencimiento.toISOString().split('T')[0],
              total: inv.total,
              saldoPendiente: inv.total,
              estado: 'pendiente',
              empresaId: orderData.sucursalId,
              sucursalId: orderData.sucursalId,
              fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
              notasRevision: `Excepción: ${result.value}`
            });
          });
        }

        await batch.commit();
        Swal.fire({ icon: "success", title: "Pedido completado con excepción" });
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}
function openChangeStatusModal(orderDocId) {
  currentOrderForStatusChange = orderDocId;
  const container = $("#changeStatusButtons");
  const flow = FLOWS.Bodega; // Default to full flow for admin

  container.innerHTML = flow.map(st => `
        <button class="btn btn-secondary" data-action="changeManualStatus" data-status="${st.key}">
            ${st.label}
        </button>
    `).join("");

  $("#changeStatusModal").style.display = "flex"; // Note: flex for backdrop-filter center
}

function initDashboardStats() {
  let q = db.collection("orders");
  if (userRole !== "administrador" && userRole !== "view") {
    q = q.where("sucursalId", "==", userSucursalId);
  }

  q.onSnapshot(snap => {
    const orders = snap.docs.map(d => d.data());
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const pending = orders.filter(o => o.status === "pending").length;
    const transit = orders.filter(o => ["pedidoTomado", "pedidoEnBodega", "bodegaEnvioPedido", "caminoATienda"].includes(o.status)).length;

    const completedToday = orders.filter(o => {
      if (o.status !== "sucursalRecibioPedido") return false;
      const t = o.timestamp?.toMillis ? new Date(o.timestamp.toMillis()) : null;
      return t && t >= startOfDay;
    }).length;

    const totalMonth = orders.length; // Simplified for demo, usually filtered by month

    $("#stat-pending").textContent = pending;
    $("#stat-transit").textContent = transit;
    $("#stat-completed-today").textContent = completedToday;
    $("#stat-total-month").textContent = totalMonth;
  });
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
 * ACCIÓN DIRECTA RECIBIR
 **********************************************************/
async function markOrderAsReceivedDirectly(orderId) {
  try {
    await db.collection("orders").doc(orderId).update({
      status: "sucursalRecibioPedido",
      receivedDirectly: true,
      directReceiveTimestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    Swal.fire({
      icon: "success",
      title: "Pedido Recibido",
      text: "El estado ha sido actualizado a 'Sucursal Recibió Pedido' correctamente.",
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    Swal.fire({ icon: "error", title: "Error", text: err.message });
  }
}

/**********************************************************
 * ACCIÓN RÁPIDA (ADMIN)
 **********************************************************/
async function quickReceiveOrder(orderId) {
  // Sin confirmación (sweetalert), ejecución directa a firestore
  try {
    await db.collection("orders").doc(orderId).update({
      status: "sucursalRecibioPedido",
      quickReceivedByAdmin: true,
      statusChangeTimestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Pequeña notificación toast para que sepa que se hizo
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
    });
    Toast.fire({
      icon: 'success',
      title: 'Pedido marcado como RECIBIDO (Rápido)'
    });

  } catch (err) {
    console.error(err);
    Swal.fire({ icon: "error", title: "Error Rápido", text: err.message });
  }
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
      progressHTML += `<div class="progress-line ${idx < currentIndex ? "completed" : ""
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
    .then(async (docSnap) => {
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
                   <th>Promedio Sem.</th>
                   <th>Inventario</th>
                   <th>Sugerido</th>
                   <th>Cantidad</th>
                   <th>Estado</th>
                 </tr></thead><tbody>`;

        const sucursalId = order.sucursalId || userSucursalId;
        const providerId = order.providerId || null;
        const rows = [];

        for (const prod of order.products) {
          let avg = null;
          if (providerId && prod.id) {
            try {
              avg = await fetchUsageAverageValueForPedidos(sucursalId, providerId, prod.id);
            } catch (e) { avg = null; }
          }
          const inv = Number(prod.inventory ?? 0);
          const avgNum = avg != null ? Number(avg) : null;
          const suggested = avgNum != null ? Math.max(Math.round(avgNum) - inv, 0) : null;
          const avgText = avgNum != null ? avgNum.toFixed(0) : "-";
          const sugText = suggested != null ? String(suggested) : "-";

          let estado = "OK";
          let color = "#28a745"; // verde
          if (suggested != null) {
            if (suggested === 0 && prod.quantity > 0) { estado = "Más"; color = "#dc3545"; }
            else if (suggested > 0) {
              if (prod.quantity > Math.ceil(suggested * 1.5)) { estado = "Más"; color = "#dc3545"; }
              else if (prod.quantity < Math.floor(suggested * 0.5)) { estado = "Menos"; color = "#fd7e14"; }
            }
          }

          rows.push(`
            <tr>
              <td>${escapeHtml(prod.name)}</td>
              <td>${escapeHtml(prod.presentation)}</td>
              <td>${avgText}</td>
              <td>${inv}</td>
              <td>${sugText}</td>
              <td>${prod.quantity}</td>
              <td style="font-weight:bold; color:${color};">${estado}</td>
            </tr>
          `);
        }
        html += rows.join("") + `</tbody></table>`;
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

async function fetchUsageAverageValueForPedidos(sucursalId, providerId, productId) {
  if (!sucursalId || !providerId || !productId) return null;
  const docId = `${sucursalId}__${providerId}__${productId}`;
  const ref = await db.collection('usageAverages').doc(docId).get();
  if (!ref.exists) return null;
  const data = ref.data();
  return typeof data.weeklyAverage === 'number' ? data.weeklyAverage : null;
}
function closeOrderDetailsModal() {
  $("#orderDetails").innerHTML = "";
  $("#orderDetailsModal").style.display = "none";
}

/**********************************************************
 * EDITAR PEDIDO
 **********************************************************/
// Variable global para tracking del proveedor en edición
let currentEditingProviderId = null;

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
      currentEditingProviderId = order.providerId || null; // Guardar proveedor

      const idInput = $("#editOrderDocId");
      const idDisplay = $("#editOrderIdDisplay");
      const destSel = $("#editOrderDestination");
      const tbody = $("#editOrderProducts");
      const btnAdd = $("#btnAddProductRow");

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

      // Actualizar botón para llamar al modal en lugar de agregar fila vacía
      if (btnAdd) {
        btnAdd.onclick = openProductSelectModalForEdit;
        btnAdd.innerHTML = '<i class="fas fa-plus"></i> Agregar Producto';
      }

      tbody.innerHTML = "";
      if (order.products?.length) {
        order.products.forEach((prod) => {
          const tr = document.createElement("tr");
          tr.setAttribute("data-id", prod.id || "");
          tr.innerHTML = `
            <td>
              <input type="text" value="${prod.name}" class="editProdName" readonly/>
              <input type="hidden" value="${prod.id || ''}" class="editProdId"/>
            </td>
            <td><input type="text" value="${prod.presentation}" class="editProdPresentation" readonly/></td>
            <td><input type="number" value="${prod.quantity}" min="0" class="editProdQuantity"/></td>
            <td><input type="number" value="${prod.inventory || 0}" min="0" class="editProdInventory"/></td>
            <td><button type="button" data-action="removeRow" onclick="removeProductRow(this)">Eliminar</button></td>
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
// --- Funciones para Modal de Selección (Edición) ---
async function openProductSelectModalForEdit() {
  if (!currentEditingProviderId) {
    Swal.fire({
      icon: "warning",
      title: "Proveedor desconocido",
      text: "No se tiene registrado el proveedor de este pedido para filtrar productos.",
    });
    // Fallback: Si no hay providerId, quizás permitir agregar fila manual (comportamiento antiguo)
    addProductRowManual();
    return;
  }

  const modal = $("#productSelectionModal");
  if (!modal) return;
  modal.style.display = "block";

  const tbody = $("#productSelectionTable").getElementsByTagName("tbody")[0];
  tbody.innerHTML = '<tr><td colspan="2">Cargando productos...</td></tr>';

  try {
    const snap = await db.collection("products")
      .where("providerId", "==", currentEditingProviderId)
      .get();

    tbody.innerHTML = "";
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="2">Este proveedor no tiene productos registrados.</td></tr>';
      return;
    }

    snap.forEach(doc => {
      const prod = doc.data();
      const row = tbody.insertRow();
      row.setAttribute("data-id", doc.id);
      row.setAttribute("data-name", prod.name);
      row.setAttribute("data-pres", prod.presentation);
      row.style.cursor = "pointer";
      row.onclick = () => addSelectedProductToEditTable({ id: doc.id, ...prod });

      row.innerHTML = `
        <td>${prod.name || "Sin Nombre"}</td>
        <td>${prod.presentation || "-"}</td>
      `;
    });
  } catch (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="2">Error al cargar productos.</td></tr>';
  }
}

function closeProductSelectionModal() {
  const modal = $("#productSelectionModal");
  if (modal) modal.style.display = "none";
}

function filterProductsForEdit() {
  const input = $("#productSearchForEdit");
  const filter = input.value.toLowerCase();
  const table = $("#productSelectionTable");
  const tr = table.getElementsByTagName("tr");
  for (let i = 2; i < tr.length; i++) { // Skip headers
    const tdProduct = tr[i].getElementsByTagName("td")[0];
    const tdPres = tr[i].getElementsByTagName("td")[1];
    if (tdProduct || tdPres) {
      const txtValue = (tdProduct.textContent || "") + " " + (tdPres.textContent || "");
      if (txtValue.toLowerCase().indexOf(filter) > -1) {
        tr[i].style.display = "";
      } else {
        tr[i].style.display = "none";
      }
    }
  }
}

function addSelectedProductToEditTable(product) {
  closeProductSelectionModal();
  const tbody = $("#editOrderProducts");

  // Verificar duplicados visuales (opcional)
  const existingIds = Array.from(tbody.querySelectorAll(".editProdId")).map(i => i.value);
  if (existingIds.includes(product.id)) {
    Swal.fire({ icon: 'info', title: 'Producto ya listado', text: 'Este producto ya está en la lista.' });
    return;
  }

  const newRow = document.createElement("tr");
  newRow.innerHTML = `
    <td>
      <input type="text" value="${product.name}" class="editProdName" readonly />
      <input type="hidden" value="${product.id}" class="editProdId" />
    </td>
    <td><input type="text" value="${product.presentation}" class="editProdPresentation" readonly /></td>
    <td><input type="number" value="" placeholder="Cant." min="0" class="editProdQuantity" /></td>
    <td><input type="number" value="0" min="0" class="editProdInventory" /></td>
    <td><button type="button" data-action="removeRow" onclick="removeProductRow(this)">Eliminar</button></td>
  `;
  tbody.appendChild(newRow);
}

function addProductRowManual() {
  const tbody = $("#editOrderProducts");
  const newRow = document.createElement("tr");
  newRow.innerHTML = `
    <td>
      <input type="text" placeholder="Nombre del producto" class="editProdName"/>
      <input type="hidden" value="" class="editProdId"/>
    </td>
    <td><input type="text" placeholder="Presentación" class="editProdPresentation"/></td>
    <td><input type="number" placeholder="Cantidad" min="0" class="editProdQuantity"/></td>
    <td><input type="number" placeholder="Inventario" min="0" value="0" class="editProdInventory"/></td>
    <td><button type="button" data-action="removeRow" onclick="removeProductRow(this)">Eliminar</button></td>
  `;
  tbody.appendChild(newRow);
}

// Deprecated direct call, redirected if somehow called manually
function addProductRow() {
  openProductSelectModalForEdit();
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
    const prodInventories = Array.from($$(".editProdInventory")).map(
      (input) => parseFloat(input.value) || 0
    );
    const prodIds = Array.from($$(".editProdId")).map((input) => input.value);

    const products = prodNames.map((name, i) => ({
      name,
      presentation: prodPresentations[i],
      quantity: prodQuantities[i],
      inventory: prodInventories[i],
      id: prodIds[i]
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

    // Si el modal de detalles está abierto, refrescarlo
    if ($("#orderDetailsModal").style.display === "block") {
      showOrderDetails(orderDocId);
    }

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
// Export modal removed - now only direct image export in order details
function exportOrder(orderId) {
  // Redirect to show order details which has the export button
  showOrderDetails(orderId);
}

function closeExportModal() {
  // Modal removed - function kept for compatibility
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
      row.innerHTML = `
        <td style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9; color: #334155;">${prod.name}</td>
        <td style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9; color: #475569;">${prod.presentation}</td>
        <td style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #1e293b; font-weight: 700;">${prod.quantity}</td>
      `;
      tBody.appendChild(row);
    });
  }

  ticket.style.display = "block";
  ticket.style.left = "0"; // Move to visible area temporarily if needed, or keep off-screen but ensure rendered
  // Some browsers struggle with off-screen rendering. Let's try keeping it offscreen but ensuring display block works.
  // Actually, standard practice for clean shot is often to ensure it's "visible" to the DOM engine.
  // Let's keep the user's logic but add useCORS.
  ticket.style.left = "50%";
  ticket.style.top = "50%";
  ticket.style.transform = "translate(-50%, -50%)";
  ticket.style.zIndex = "-1000"; // Ensure it's behind if we don't want it seen, or zIndex 9999 if we want it on top (it blocks view).
  // The original code centered it on screen?
  // "ticket.style.left = "50%"; ticket.style.top = "50%";" implied it might overlay everything.
  // Converting to image happens fast.

  // Sanitize fileName to avoid issues with slashes in dates
  const safeFileName = fileName.replace(/\//g, "-");

  // Allow a brief render cycle
  setTimeout(() => {
    html2canvas(ticket, {
      scale: 1,
      useCORS: true,
      allowTaint: true,
      logging: false
    })
      .then((canvas) => {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/jpeg", 0.6);
        link.download = `${safeFileName}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch((err) => {
        console.error(err);
        Swal.fire({
          icon: "error",
          title: "Error al exportar",
          text: "No se pudo exportar la imagen: " + (err.message || err)
        });
      })
      .finally(() => {
        ticket.style.display = "none";
        ticket.style.left = "-9999px";
        ticket.style.top = "-9999px";
        ticket.style.transform = "none";
      });
  }, 100);
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

    // Attach listener to initial invoice input
    const initialInput = document.querySelector(".invoice-entry .invoice-total-input");
    if (initialInput) {
      initialInput.addEventListener("input", updateInvoiceTotals);
      initialInput.dataset.listenerAdded = "true";
    }

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
      <div>
        <label><strong>Total Factura:</strong></label>
        <input type="number" class="invoice-total-input" placeholder="0.00" step="0.01" />
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
  let grandTotalInvoices = 0;
  let grandTotalProducts = 0;

  // Calcular total de productos
  const rows = $$("#confirmOrderProducts tr");
  rows.forEach((_, idx) => {
    const val = parseFloat(document.getElementById(`totalPerProduct${idx}`).textContent) || 0;
    grandTotalProducts += val;
  });

  const invoiceTotalsList = $("#invoiceTotalsList");
  invoiceTotalsList.innerHTML = "";

  const invoiceEntries = document.querySelectorAll(".invoice-entry");

  invoiceEntries.forEach((entry, index) => {
    const val = parseFloat(entry.querySelector(".invoice-total-input")?.value) || 0;
    grandTotalInvoices += val;

    // Add listener to update totals on input change (if not already added)
    const input = entry.querySelector(".invoice-total-input");
    if (input && !input.dataset.listenerAdded) {
      input.addEventListener("input", updateInvoiceTotals);
      input.dataset.listenerAdded = "true";
    }

    const invoiceNumber = entry.querySelector(".invoice-number").value || `Factura ${index + 1}`;
    invoiceTotalsList.innerHTML += `
      <div style="margin-bottom: 0.5rem;">
        <strong>${invoiceNumber}:</strong> Q<span class="invoice-total">${val.toFixed(2)}</span>
      </div>
    `;
  });

  $("#grandTotal").innerHTML = `
    Productos: Q${grandTotalProducts.toFixed(2)} <br>
    Facturas: Q${grandTotalInvoices.toFixed(2)} <br>
    <span style="color: ${Math.abs(grandTotalProducts - grandTotalInvoices) < 0.01 ? 'green' : 'red'}">
      Diferencia: Q${(grandTotalProducts - grandTotalInvoices).toFixed(2)}
    </span>
  `;
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
        <div>
          <label><strong>Total Factura:</strong></label>
          <input type="number" class="invoice-total-input" placeholder="0.00" step="0.01" />
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
    let sumInvoiceTotals = 0;
    const invoices = Array.from(invoiceEntries).map(entry => {
      const val = parseFloat(entry.querySelector(".invoice-total-input")?.value) || 0;
      sumInvoiceTotals += val;
      return {
        invoiceNumber: entry.querySelector(".invoice-number").value,
        invoiceDate: entry.querySelector(".invoice-date").value || new Date().toISOString().split('T')[0],
        total: val
      };
    }).filter(invoice => invoice.invoiceNumber);

    // Validar totales
    const validationRows = $$("#confirmOrderProducts tr");
    let totalProductos = 0;
    validationRows.forEach((_, i) => {
      totalProductos += parseFloat(document.getElementById(`totalPerProduct${i}`).textContent) || 0;
    });

    if (Math.abs(sumInvoiceTotals - totalProductos) > 0.05) {
      const { isConfirmed } = await Swal.fire({
        title: "Totales no coinciden",
        text: `Total Facturas (Q${sumInvoiceTotals.toFixed(2)}) difiere del Total Productos (Q${totalProductos.toFixed(2)}). ¿Desea continuar de todos modos?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, continuar",
        cancelButtonText: "Corregir"
      });
      if (!isConfirmed) return;
    }

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

    // Crear entradas en Cuentas por Pagar
    try {
      const batch = db.batch();
      invoicesList.forEach((inv) => {
        const facturaRef = db.collection('facturas_pagar').doc();
        const fechaEmision = new Date(inv.invoiceDate);
        const fechaVencimiento = new Date(fechaEmision);
        fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

        batch.set(facturaRef, {
          numeroFactura: inv.invoiceNumber,
          pedidoId: orderId,
          orderId: orderData.orderId,
          proveedorId: orderData.providerName,
          proveedorNombre: orderData.providerName,
          fechaEmision: inv.invoiceDate,
          fechaVencimiento: fechaVencimiento.toISOString().split('T')[0],
          total: inv.total,
          saldoPendiente: inv.total,
          estado: 'pendiente',
          empresaId: orderData.sucursalId,
          sucursalId: orderData.sucursalId,
          fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
      console.log("Facturas creadas en Cuentas por Pagar");
    } catch (err) {
      console.error("Error al crear facturas en Cuentas por Pagar:", err);
      // No bloqueamos el flujo principal si esto falla, pero avisamos
      Swal.fire({ icon: "warning", title: "Advertencia", text: "Pedido guardado, pero hubo un error al generar las cuentas por pagar." });
    }

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

      // Agregar botón de generar constancia si no existe
      let btnReceipt = document.getElementById("btnGenerateReceipt");
      if (!btnReceipt) {
        btnReceipt = document.createElement("button");
        btnReceipt.id = "btnGenerateReceipt";
        btnReceipt.textContent = "Generar Constancia";
        btnReceipt.style.marginTop = "1rem";
        btnReceipt.style.marginLeft = "1rem";
        $("#receivedOrderDetails").parentNode.appendChild(btnReceipt);
      }
      // Actualizar el listener (clonar para limpiar anteriores)
      const newBtn = btnReceipt.cloneNode(true);
      btnReceipt.parentNode.replaceChild(newBtn, btnReceipt);
      newBtn.addEventListener("click", () => generateReceiptImage(order));

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
    exportReceptionLastEditHidden.textContent = `Pedido editado el: ${editDate.toLocaleString()} por: ${order.lastEditedBy || "N/A"
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

function generateReceiptImage(order) {
  const container = document.getElementById("receiptExportContainer");
  if (!container) {
    Swal.fire({ icon: "error", title: "Error", text: "Plantilla de constancia no encontrada." });
    return;
  }

  // Populate Header
  document.getElementById("receiptDate").textContent = new Date().toLocaleDateString();

  // Populate Info
  document.getElementById("receiptProvider").textContent = order.providerName || "N/A";
  document.getElementById("receiptOrderId").textContent = order.orderId || "N/A";
  document.getElementById("receiptSucursal").textContent = order.sucursalName || "N/A";

  let invoiceNums = "No ingresado";
  if (order.invoices && order.invoices.length > 0) {
    invoiceNums = order.invoices.map(i => i.invoiceNumber).join(", ");
  } else if (order.invoiceNumber) {
    invoiceNums = order.invoiceNumber;
  }
  document.getElementById("receiptInvoiceNumbers").textContent = invoiceNums;

  // Populate Table
  const tbody = document.getElementById("receiptTableBody");
  tbody.innerHTML = "";

  if (order.receivedProducts) {
    order.receivedProducts.forEach(prod => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #eee";
      tr.innerHTML = `
        <td style="padding: 10px 15px; color: #555;">${prod.name}</td>
        <td style="padding: 10px 15px; color: #555;">${prod.presentation}</td>
        <td style="padding: 10px 15px; text-align: center; color: #555;">${prod.receivedQuantity}</td>
        <td style="padding: 10px 15px; text-align: right; color: #555;">Q${Number(prod.unitPrice).toFixed(2)}</td>
        <td style="padding: 10px 15px; text-align: right; color: #555;">Q${Number(prod.totalPerProduct).toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Populate Total
  const total = order.invoiceTotal ? Number(order.invoiceTotal).toFixed(2) : "0.00";
  document.getElementById("receiptGrandTotal").textContent = total;

  // Show and Export
  container.style.display = "block";

  html2canvas(container, { scale: 2 }).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `Constancia_Recepcion_${order.orderId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    container.style.display = "none";
  }).catch(err => {
    console.error(err);
    Swal.fire({ icon: "error", title: "Error", text: "No se pudo generar la constancia." });
    container.style.display = "none";
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
        // Actualiza la vista automáticamente gracias al onSnapshot
      } catch (err) {
        Swal.fire({ icon: "error", title: "Error", text: err.message });
      }
    }
  });
}

/**********************************************************
 * CONFIGURACIÓN PROMEDIOS
 **********************************************************/
async function initUsageAverageModalControls() {
  try {
    // Sucursales
    const sucSel = document.getElementById('avgSucursalSelect');
    if (!sucSel) return;
    sucSel.innerHTML = '';
    if (userRole === 'administrador') {
      const snapSuc = await db.collection('sucursales').get();
      const defOpt = document.createElement('option');
      defOpt.value = '';
      defOpt.textContent = '-- Selecciona una Sucursal --';
      defOpt.disabled = true; defOpt.selected = true;
      sucSel.appendChild(defOpt);
      snapSuc.forEach(doc => {
        const d = doc.data();
        const o = document.createElement('option');
        o.value = doc.id; o.textContent = d.name;
        sucSel.appendChild(o);
      });
    } else {
      const o = document.createElement('option');
      o.value = userSucursalId; o.textContent = "Mi Sucursal";
      sucSel.appendChild(o);
      sucSel.disabled = true;
    }

    // Proveedores
    const provSel = document.getElementById('avgProviderSelect');
    provSel.innerHTML = '';
    const snapProv = await db.collection('providers').get();
    const defP = document.createElement('option');
    defP.value = '';
    defP.textContent = '-- Selecciona un Proveedor --';
    defP.disabled = true; defP.selected = true;
    provSel.appendChild(defP);
    snapProv.forEach(doc => {
      const d = doc.data();
      const o = document.createElement('option');
      o.value = doc.id; o.textContent = d.name;
      provSel.appendChild(o);
    });
  } catch (e) {
    console.error("Error initUsageAverageModalControls", e);
  }
}

function showUsageAverageModal() {
  const m = document.getElementById('usageAverageModal');
  if (!m) return;
  m.style.display = 'block';
  // Preseleccionar sucursal si no admin
  const sucSel = document.getElementById('avgSucursalSelect');
  if (sucSel && userRole !== 'administrador') {
    sucSel.value = userSucursalId;
  }
}

function closeUsageAverageModal() {
  const m = document.getElementById('usageAverageModal');
  if (!m) return;
  m.style.display = 'none';
}

async function loadProductsForAverage(providerId) {
  if (!providerId) return;
  try {
    const sucSel = document.getElementById('avgSucursalSelect');
    const sucursalIdSel = sucSel?.value || userSucursalId;
    const tbody = document.getElementById('usageAverageTable').querySelector('tbody');
    tbody.innerHTML = '';
    const snap = await db.collection('products').where('providerId', '==', providerId).get();
    for (const doc of snap.docs) {
      const prod = doc.data();
      const tr = tbody.insertRow();
      tr.setAttribute('data-id', doc.id);
      tr.innerHTML = `
        <td>${escapeHtml(prod.name || '')}</td>
        <td>${escapeHtml(prod.presentation || '')}</td>
        <td><input type="number" min="0" step="1" class="avg-input" placeholder="0" /></td>
      `;
      // Cargar valor existente
      const avg = await fetchUsageAverageValueForPedidos(sucursalIdSel, providerId, doc.id);
      const input = tr.querySelector('.avg-input');
      if (avg != null) input.value = Number(avg);
    }
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'Error al cargar productos: ' + e.message });
  }
}

function filterAvgProducts() {
  const v = (document.getElementById('avgProductSearch')?.value || '').toLowerCase();
  const tbody = document.getElementById('usageAverageTable').querySelector('tbody');
  const rows = tbody.getElementsByTagName('tr');
  for (let i = 0; i < rows.length; i++) {
    const nameTd = rows[i].getElementsByTagName('td')[0];
    const txt = (nameTd?.textContent || '').toLowerCase();
    rows[i].style.display = txt.indexOf(v) > -1 ? '' : 'none';
  }
}

async function saveUsageAverages() {
  const sucursalIdSel = document.getElementById('avgSucursalSelect')?.value || userSucursalId;
  const providerIdSel = document.getElementById('avgProviderSelect')?.value || '';
  if (!sucursalIdSel) {
    Swal.fire({ icon: 'warning', title: 'Sucursal requerida', text: 'Seleccione una sucursal.' });
    return;
  }
  if (!providerIdSel) {
    Swal.fire({ icon: 'warning', title: 'Proveedor requerido', text: 'Seleccione un proveedor.' });
    return;
  }
  const tbody = document.getElementById('usageAverageTable').querySelector('tbody');
  const rows = tbody.getElementsByTagName('tr');
  const batch = db.batch();
  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    const productId = rows[i].getAttribute('data-id');
    const input = rows[i].querySelector('.avg-input');
    const val = Number(input?.value || 0);
    const docId = `${sucursalIdSel}__${providerIdSel}__${productId}`;
    const ref = db.collection('usageAverages').doc(docId);
    if (val > 0) {
      batch.set(ref, {
        sucursalId: sucursalIdSel,
        providerId: providerIdSel,
        productId,
        weeklyAverage: Math.round(val),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      count++;
    } else {
      // Si es 0, eliminamos el doc para limpiar
      batch.delete(ref);
    }
  }
  try {
    await batch.commit();
    Swal.fire({ icon: 'success', title: 'Guardado', text: `Promedios guardados (${count}).` });
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'Error al guardar promedios: ' + e.message });
  }
}