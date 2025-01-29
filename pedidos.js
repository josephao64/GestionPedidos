/********************************************************** 
 * CONFIGURACIÓN DE FIREBASE
 **********************************************************/
const firebaseConfig = {
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
  if (userRole === "administrador") {
    document.getElementById("adminFilterContainer").style.display = "block";
    loadSucursalesForAdmin();
    loadProvidersForAdmin();
  }
  loadLogo();
  setupRealTimeInProcessListener();
  setupRealTimeCompletedListener();
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
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

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
 * loadLogo
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
  img.onerror = function () {
    console.error("No se pudo cargar el logo.png");
  };
}

/**********************************************************
 * Navegación y Tabs
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
 * Real-Time Listeners
 **********************************************************/
function setupRealTimeInProcessListener() {
  const inProcessStatuses = [
    "pending",
    "pedidoTomado",
    "pedidoEnBodega",
    "bodegaEnvioPedido",
    "caminoATienda"
  ];
  let query = db.collection("orders").where("status", "in", inProcessStatuses);
  if (userRole !== "administrador") {
    query = query.where("sucursalId", "==", userSucursalId);
  }
  query.onSnapshot(() => {
    loadInProcessOrders();
  });
}

function setupRealTimeCompletedListener() {
  let query = db.collection("orders").where("status", "==", "sucursalRecibioPedido");
  if (userRole !== "administrador") {
    query = query.where("sucursalId", "==", userSucursalId);
  }
  query.onSnapshot(() => {
    loadCompletedOrders();
  });
}

/**********************************************************
 * Cargar Pedidos en Proceso
 **********************************************************/
async function loadInProcessOrders() {
  try {
    const cont = document.getElementById("inProcessOrdersAdminCards");
    cont.innerHTML = "";
    const idSearch = document.getElementById("idSearchInput")?.value?.trim();
    const inProcessStatuses = [
      "pending",
      "pedidoTomado",
      "pedidoEnBodega",
      "bodegaEnvioPedido",
      "caminoATienda"
    ];
    let query;
    if (idSearch) {
      query = db.collection("orders").where("orderId", "==", idSearch);
    } else {
      query = db.collection("orders").where("status", "in", inProcessStatuses);
    }
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
      if (inProcessStatuses.includes(order.status)) {
        const card = createOrderCard(doc.id, order);
        cont.appendChild(card);
      }
    });
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * Cargar Pedidos Completados
 **********************************************************/
async function loadCompletedOrders() {
  try {
    const contCards = document.getElementById("completedOrdersAdminCards");
    if (contCards) contCards.innerHTML = "";
    const idSearch = document.getElementById("idSearchInput")?.value?.trim();
    let query;
    if (idSearch) {
      query = db.collection("orders")
        .where("status", "==", "sucursalRecibioPedido")
        .where("orderId", "==", idSearch);
    } else {
      query = db.collection("orders")
        .where("status", "==", "sucursalRecibioPedido");
    }
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
      if (order.status === "sucursalRecibioPedido") {
        const card = createOrderCard(doc.id, order);
        contCards.appendChild(card);
      }
    });
  } catch (error) {
    Swal.fire({ icon: "error", title: "Error", text: error.message });
  }
}

/**********************************************************
 * Crear Tarjeta del Pedido
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
    <button onclick="showOrderDetails('${orderDocId}')">Mostrar Pedido</button>
  `;
  if (order.status === "pending" && userRole !== "administrador") {
    html += `<h2 style="color: red;">El pedido aún no ha sido tomado por el proveedor</h2>`;
  }
  if (order.status === "pending" && userRole === "administrador") {
    html += `
      <button onclick="markOrderAsTaken('${orderDocId}')">Pedido Tomado por Proveedor</button>
      <button onclick="deleteOrder('${orderDocId}')">Eliminar Pedido</button>
    `;
  }
  if (userRole === "administrador" || userPermissions.canEditOrder) {
    html += `<button onclick="editOrder('${orderDocId}')">Editar Pedido</button>`;
  }
  if (userRole === "administrador") {
    html += `<button onclick="exportOrder('${orderDocId}')">Exportar Pedido</button>`;
  }
  if (userRole === "administrador" || userPermissions.canDeleteOrder) {
    html += `<button onclick="deleteOrder('${orderDocId}')">Eliminar Pedido</button>`;
  }
  if (order.destination === "Bodega" && order.status === "bodegaEnvioPedido") {
    html += `<button onclick="confirmOrder('${orderDocId}')">Ingresar Cantidades</button>`;
  }
  if (order.destination === "Tienda" && order.status === "caminoATienda") {
    html += `<button onclick="confirmOrder('${orderDocId}')">Ingresar Cantidades</button>`;
  }
  if (order.status === "sucursalRecibioPedido") {
    html += `<button onclick="showReceivedOrder('${orderDocId}')">Mostrar Pedido Recibido</button>`;
  }
  card.innerHTML = html;
  return card;
}

/**********************************************************
 * Generar Barra de Progreso
 **********************************************************/
function generateProgressBar(order) {
  const dest = order.destination || "Bodega";
  if (dest === "Tienda") {
    const tiendaFlow = [
      { key: "pending",            label: "Pendiente" },
      { key: "pedidoTomado",       label: "Pedido Tomado" },
      { key: "caminoATienda",      label: "En Camino a Tienda" },
      { key: "sucursalRecibioPedido", label: "Sucursal Recibió Pedido" }
    ];
    return createProgressBarHTML(tiendaFlow, order.status);
  } else {
    const bodegaFlow = [
      { key: "pending",            label: "Pendiente" },
      { key: "pedidoTomado",       label: "Pedido Tomado" },
      { key: "pedidoEnBodega",     label: "Pedido en Bodega" },
      { key: "bodegaEnvioPedido",  label: "Bodega Envío Pedido" },
      { key: "sucursalRecibioPedido", label: "Sucursal Recibió Pedido" }
    ];
    return createProgressBarHTML(bodegaFlow, order.status);
  }
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
  db.collection("orders").doc(orderId).get()
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
        order.products.forEach(prod => {
          html += `
            <tr>
              <td>${prod.name}</td>
              <td>${prod.presentation}</td>
              <td>${prod.quantity}</td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      }
      if (order.status === "pending" && userRole === "administrador") {
        html += `
          <button onclick="editOrder('${orderId}')">Editar Pedido</button>
          <button onclick="exportOrder('${orderId}')">Exportar Pedido</button>
        `;
      }
      html += `
        <button onclick="exportAsImageDirect('${orderId}')">Exportar Pedido como Imagen</button>
      `;
      if (order.receivedProducts && order.receivedProducts.length > 0) {
        html += `
          <button onclick="exportReception('${orderId}')">Exportar Recepción de Pedido</button>
        `;
      }
      document.getElementById("orderDetails").innerHTML = html;
      document.getElementById("orderDetailsModal").style.display = "block";
      const exportImageButton = document.getElementById("exportOrderImageButton");
      if (exportImageButton) {
        exportImageButton.onclick = function() {
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
 * editOrder / closeEditOrderModal
 **********************************************************/
function editOrder(orderId) {
  db.collection("orders").doc(orderId).get()
    .then(docSnap => {
      if (!docSnap.exists) {
        Swal.fire({ icon: "error", title: "Pedido no encontrado" });
        return;
      }
      const order = docSnap.data();
      let formHTML = `
        <input type="hidden" id="editOrderId" value="${orderId}">
        <p><strong>ID Pedido:</strong> ${order.orderId}</p>
        <p><strong>Destino:</strong> ${order.destination || "No definido"}</p>
      `;
      document.getElementById("editOrderDetails").innerHTML = formHTML;
      document.getElementById("editOrderModal").style.display = "block";
    })
    .catch(err => {
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    });
}

function closeEditOrderModal() {
  document.getElementById("editOrderDetails").innerHTML = "";
  document.getElementById("editOrderModal").style.display = "none";
}

/**********************************************************
 * exportOrder (Imagen, Excel)
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
      Swal.fire({ icon: "warning", title: "Deshabilitado", text: "Exportar a PDF no disponible." });
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
    exportAsImage(order, fileName);
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
  if (!exportOrderIdHidden || !exportProviderHidden || !exportSucursalHidden ||
      !exportFechaHidden || !exportLastEditHidden || !exportLogoImg || !tBody) {
    Swal.fire({ icon: "error", title: "Error", text: "Elementos de exportación no encontrados." });
    return;
  }
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
  if (logoBase64) {
    exportLogoImg.src = logoBase64;
  } else {
    exportLogoImg.src = "logo.png";
  }
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
  hiddenDiv.style.display = "block";
  hiddenDiv.style.left = "50%";
  hiddenDiv.style.top = "50%";
  hiddenDiv.style.transform = "translate(-50%, -50%)";
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
    })
    .finally(() => {
      hiddenDiv.style.display = "none";
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
    ws_data.push(["Última Edición", editDate]);
    ws_data.push([]);
  }
  ws_data.push(["Producto", "Presentación", "Cantidad"]);
  if (order.products) {
    order.products.forEach((prod) => {
      ws_data.push([prod.name, prod.presentation, prod.quantity]);
    });
  }
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Pedido");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**********************************************************
 * confirmOrder
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
  document.getElementById("exportReceptionButtonContainer").style.display = "none";
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
    if (!noInvoice) {
      if (!invoiceNumberField || !invoiceDateField) {
        Swal.fire({
          icon: "warning",
          title: "Faltan datos de factura",
          text: "Ingresa la factura o marca 'No se ingresó la factura'."
        });
        return;
      }
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
      if (qRecibida > qPedida) {
        Swal.fire({
          icon: "error",
          title: "Cantidad inválida",
          text: `No puedes recibir más de lo pedido para el producto: ${originalProd.name}`
        });
        return;
      }
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
    let pendingInvoice = false;
    if (noInvoice) {
      pendingInvoice = true;
    }
    const invoiceTotalValue = Number(totalFactura.toFixed(2));
    if (mismatchedQuantities || pendingInvoice) {
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
        return; 
      }
      await db.collection("orders").doc(orderId).update({
        invoiceNumber: pendingInvoice ? "" : invoiceNumberField,
        invoiceDate: pendingInvoice ? "" : invoiceDateField,
        pendingInvoice,
        receivedProducts,
        invoiceTotal: invoiceTotalValue,
        mismatchedQuantities,
        mismatchComment: reason
      });
      Swal.fire({
        icon: "success",
        title: "Recepción Guardada con Faltantes/Comentario",
        text: `El pedido se mantiene en proceso. Total Factura: Q${invoiceTotalValue}`
      });
      closeConfirmOrderModal();
      return;
    }
    await db.collection("orders").doc(orderId).update({
      invoiceNumber: invoiceNumberField,
      invoiceDate: invoiceDateField,
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
      text: `Todo coincide y se ingresó factura. Total Factura: Q${invoiceTotalValue}`
    });
    if (userRole !== "administrador") {
      document.getElementById("exportReceptionButtonContainer").style.display = "block";
    }
    closeConfirmOrderModal();
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
      if (userRole !== "administrador") {
        document.getElementById("exportReceivedOrderImageButtonContainer").style.display = "block";
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
  document.getElementById("exportReceivedOrderImageButtonContainer").style.display = "none";
}

/**********************************************************
 * exportReception / exportReceptionAsImage / ...
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

function exportAsReceptionImage(order, fileName) {
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
  if (!exportReceptionOrderIdHidden ||
      !exportReceptionProviderHidden ||
      !exportReceptionSucursalHidden ||
      !exportReceptionOrderDateHidden ||
      !exportReceptionInvoiceNumberHidden ||
      !exportReceptionInvoiceDateHidden ||
      !exportReceptionInvoiceTotalHidden ||
      !exportReceptionLastEditHidden ||
      !exportReceptionLogoImg ||
      !exportReceptionTBody) {
    Swal.fire({ icon: "error", title: "Error", text: "Elementos de exportación no encontrados." });
    return;
  }
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
  if (logoBase64) {
    exportReceptionLogoImg.src = logoBase64;
  } else {
    exportReceptionLogoImg.src = "logo.png";
  }
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
      tdAdver.textContent = prod.receivedQuantity < prod.quantity
        ? "Cantidad recibida menor a la pedida."
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
    })
    .finally(() => {
      hiddenDiv.style.display = "none";
      hiddenDiv.style.left = "-9999px";
      hiddenDiv.style.top = "-9999px";
      hiddenDiv.style.transform = "none";
    });
}

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
      exportAsReceptionImage(order, fileName);
    })
    .catch(error => {
      Swal.fire({ icon: "error", title: "Error al exportar", text: error.message });
    });
}
