// ======================================================================== 
//             CONFIGURACIÓN DE FIREBASE E INICIALIZACIÓN
// ========================================================================

const firebaseConfig = {
  apiKey: "AIzaSyBNalkMiZuqQ-APbvRQC2MmF_hACQR0F3M",
  authDomain: "logisticdb-2e63c.firebaseapp.com",
  projectId: "logisticdb-2e63c",
  storageBucket: "logisticdb-2e63c.appspot.com",
  messagingSenderId: "917523682093",
  appId: "1:917523682093:web:6b03fcce4dd509ecbe79a4"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ========================================================================
//     VARIABLES GLOBALES PARA USUARIO, ROL, SUCURSAL, LOGO, ETC.
// ========================================================================
let userSucursalId = null;
let loggedInUsername = null;
let userRole = null;          // Para almacenar el rol (administrador/usuario)
let userPermissions = {};     // Para almacenar los permisos (canChangeStatus, etc.)
let logoBase64 = "";          // Para almacenar el logo en base64 si lo usas en PDF

// ========================================================================
//     OBTENER USUARIO LOGUEADO, SUCURSALID, ROL Y PERMISOS (AL CARGAR LA PÁGINA)
// ========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Inicializar datos del usuario (username, rol, sucursal, permisos)
  await initUserAndSucursal();

  // 2. Si es administrador, mostrar el contenedor del filtro y cargar sucursales
  if (userRole === "administrador") {
    document.getElementById("adminFilterContainer").style.display = "block";
    loadSucursalesForAdmin();
  }

  // 3. Cargar pedidos (pendientes, en proceso, completados)
  loadPendingOrdersAdmin();
  loadInProcessOrdersAdmin();
  loadCompletedOrdersAdmin();

  // 4. Cargar el logo (si deseas usarlo en PDF)
  loadLogo();
});

// ========================================================================
//     FUNCIÓN PARA OBTENER USERNAME, SUCURSALID, ROL Y PERMISOS
// ========================================================================
async function initUserAndSucursal() {
  // Suponemos que el username del usuario logueado se almacena en localStorage
  loggedInUsername = localStorage.getItem("usuarioLogueado");
  if (!loggedInUsername) {
    Swal.fire({
      icon: "warning",
      title: "No hay usuario logueado",
      text: "Redirigiendo a la pantalla de login...",
      confirmButtonText: "Ok"
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
    const userSnapshot = await db
      .collection("usuarios")
      .where("username", "==", loggedInUsername)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      Swal.fire({
        icon: "error",
        title: "Usuario no encontrado",
        text: "Inicia sesión nuevamente.",
        confirmButtonText: "Ok"
      }).then(() => {
        window.location.href = "login.html";
      });
      return;
    }

    const userDoc = userSnapshot.docs[0].data();
    userSucursalId = userDoc.sucursalId;
    userRole = userDoc.rol;
    userPermissions = userDoc.permisos || {};
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al obtener datos del usuario",
      text: error.message,
      confirmButtonText: "Ok"
    });
  }
}

// ========================================================================
//         FUNCIÓN PARA MOSTRAR EL SELECT DE SUCURSALES (ADMIN)
// ========================================================================
async function loadSucursalesForAdmin() {
  const sucursalSelect = document.getElementById("sucursalFilter");
  sucursalSelect.innerHTML = `<option value="all">Todas las sucursales</option>`;

  try {
    const sucursalesSnap = await db.collection("sucursales").get();
    sucursalesSnap.forEach(doc => {
      const data = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;         
      option.textContent = data.name;
      sucursalSelect.appendChild(option);
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al cargar sucursales",
      text: error.message,
      confirmButtonText: "Ok"
    });
  }
}

// ========================================================================
//        FUNCIÓN PARA RECARGAR LOS PEDIDOS TRAS CAMBIAR DE SUCURSAL
// ========================================================================
function reloadOrders() {
  loadPendingOrdersAdmin();
  loadInProcessOrdersAdmin();
  loadCompletedOrdersAdmin();
}

// ========================================================================
//     FUNCIÓN PARA CARGAR LOGO (SI LO USAS EN LOS REPORTES PDF)
// ========================================================================
function loadLogo() {
  const img = new Image();
  img.src = "logo.png"; // Asegúrate de que el logo.png esté en la ubicación correcta
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
    Swal.fire({
      icon: "error",
      title: "Error al cargar el logo",
      text: "Asegúrate de que la imagen (logo.png) esté en la carpeta correcta.",
      confirmButtonText: "Ok"
    });
  };
}

// ========================================================================
//         BOTONES / FUNCIONES GENERALES DE PESTAÑAS Y NAVEGACIÓN
// ========================================================================
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
  window.location.href = "INDEX.html"; // Asegúrate de que la ruta sea correcta
}

// ========================================================================
//  CARGAR PEDIDOS (PENDIENTES, EN PROCESO, COMPLETADOS) CON FILTRO
// ========================================================================
async function loadPendingOrdersAdmin() {
  try {
    let query = db.collection("orders").where("status", "==", "pending");

    if (userRole === "administrador") {
      const selectedSucursalId = document.getElementById("sucursalFilter").value;
      if (selectedSucursalId !== "all") {
        query = query.where("sucursalId", "==", selectedSucursalId);
      }
    } else {
      query = query.where("sucursalId", "==", userSucursalId);
    }

    const ordersSnapshot = await query.get();
    const pendingOrdersAdminCards = document.getElementById("pendingOrdersAdminCards");
    pendingOrdersAdminCards.innerHTML = "";

    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      const card = createOrderCard(doc.id, order, "pending");
      pendingOrdersAdminCards.appendChild(card);
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al cargar pedidos pendientes",
      text: error.message,
      confirmButtonText: "Ok"
    });
  }
}

async function loadInProcessOrdersAdmin() {
  try {
    let query = db.collection("orders").where("status", "in", [
      "pedidoTomado",
      "caminoABodega",
      "pedidoEnBodega",
      "caminoATienda"
    ]);

    if (userRole === "administrador") {
      const selectedSucursalId = document.getElementById("sucursalFilter").value;
      if (selectedSucursalId !== "all") {
        query = query.where("sucursalId", "==", selectedSucursalId);
      }
    } else {
      query = query.where("sucursalId", "==", userSucursalId);
    }

    const ordersSnapshot = await query.get();
    const inProcessOrdersAdminCards = document.getElementById("inProcessOrdersAdminCards");
    inProcessOrdersAdminCards.innerHTML = "";

    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      const card = createOrderCard(doc.id, order, "inProcess");
      inProcessOrdersAdminCards.appendChild(card);
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al cargar pedidos en proceso",
      text: error.message,
      confirmButtonText: "Ok"
    });
  }
}

async function loadCompletedOrdersAdmin() {
  try {
    let query = db.collection("orders").where("status", "==", "completed");

    if (userRole === "administrador") {
      const selectedSucursalId = document.getElementById("sucursalFilter").value;
      if (selectedSucursalId !== "all") {
        query = query.where("sucursalId", "==", selectedSucursalId);
      }
    } else {
      query = query.where("sucursalId", "==", userSucursalId);
    }

    const ordersSnapshot = await query.get();
    const completedOrdersAdminCards = document.getElementById("completedOrdersAdminCards");
    completedOrdersAdminCards.innerHTML = "";

    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      const card = createOrderCard(doc.id, order, "completed");
      completedOrdersAdminCards.appendChild(card);
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al cargar pedidos completados",
      text: error.message,
      confirmButtonText: "Ok"
    });
  }
}

// ========================================================================
//   CREAR TARJETA DE PEDIDO (PARA CADA ESTADO) + CARGAR RECIBOS
// ========================================================================
function createOrderCard(orderDocId, order, status) {
  const card = document.createElement("div");
  card.className = "order-card";

  let cardHTML = `
    <h3>Pedido ID: ${order.orderId}</h3>
    <p>Proveedor: ${order.providerName}</p>
    <p>Sucursal: ${order.sucursalName}</p>
    <p>Fecha: ${order.orderDate}</p>
    <div class="order-status">
      ${generateProgressBar(order.status)}
    </div>
    <button onclick="showOrderDetails('${orderDocId}')">Mostrar Pedido</button>
  `;

  // Habilitamos "Ingresar Cantidades Recibidas" también para usuarios normales:
  if (status === "inProcess") {
    cardHTML += `
      <button onclick="confirmOrder('${orderDocId}')">Ingresar Cantidades Recibidas</button>
    `;
    if (userRole === "administrador" || userPermissions.canChangeStatus) {
      cardHTML += `
        <button onclick="markOrderAsCompleted('${orderDocId}')">Marcar como Completado</button>
      `;
    }
  }

  // Status 'completed'
  if (status === "completed") {
    cardHTML += `
      <button onclick="showReceivedOrder('${orderDocId}')">Mostrar Pedido Recibido</button>
      <button onclick="openChangeStatusModal('${orderDocId}')">Cambiar Estado</button>
    `;
  }

  // Editar pedido => admin o canEditOrder
  if (userRole === "administrador" || userPermissions.canEditOrder) {
    cardHTML += `<button onclick="editOrder('${orderDocId}')">Editar Pedido</button>`;
  }

  // Exportar pedido => a todos (o solo admin, depende tu lógica)
  cardHTML += `<button onclick="exportOrder('${orderDocId}')">Exportar Pedido</button>`;

  // Eliminar pedido => admin o canDeleteOrder
  if (userRole === "administrador" || userPermissions.canDeleteOrder) {
    cardHTML += `<button onclick="deleteOrder('${orderDocId}')">Eliminar Pedido</button>`;
  }

  // Recibos Manual/Automático
  cardHTML += `
    <button class="generate-manual-receipt" onclick="openGenerateReceiptModal('${orderDocId}')">
      Generar Recibo Manual
    </button>
    <button class="generate-automatic-receipt" onclick="openGenerateAutomaticReceiptModal('${orderDocId}')">
      Generar Recibo Automático
    </button>
    <div id="receiptsContainer${orderDocId}" class="receiptsContainer"></div>
  `;

  card.innerHTML = cardHTML;
  loadReceipts(orderDocId, card);
  return card;
}

// ========================================================================
//   FUNCIÓN PARA GENERAR LA BARRA DE PROGRESO DEL ESTADO DEL PEDIDO
// ========================================================================
function generateProgressBar(currentStatus) {
  const statuses = [
    { key: "pending", label: "Pendiente" },
    { key: "pedidoTomado", label: "Pedido Tomado" },
    { key: "caminoABodega", label: "Camino a Bodega" },
    { key: "pedidoEnBodega", label: "Pedido en Bodega" },
    { key: "caminoATienda", label: "Camino a Tienda" },
    { key: "completed", label: "Completado" }
  ];

  let progressHTML = `<div class="progress-container">`;
  statuses.forEach((status, index) => {
    let stepClass = "";
    const currentIndex = statuses.findIndex(s => s.key === currentStatus);
    if (index < currentIndex) {
      stepClass = "completed";
    } else if (index === currentIndex) {
      stepClass = "current";
    }

    progressHTML += `
      <div class="progress-step ${stepClass}">
        <div class="step-number">${index + 1}</div>
        <div class="step-label">${status.label}</div>
      </div>
    `;

    if (index < statuses.length - 1) {
      progressHTML += `<div class="progress-line ${index < currentIndex ? "completed" : ""}"></div>`;
    }
  });
  progressHTML += `</div>`;
  return progressHTML;
}

// ========================================================================
//  CARGAR RECIBOS EXISTENTES (SI LOS HAY) Y APLICAR PERMISO PARA ELIMINAR
// ========================================================================
async function loadReceipts(orderId, cardElement) {
  try {
    const receiptsSnapshot = await db
      .collection("orders")
      .doc(orderId)
      .collection("receipts")
      .get();

    let receiptsHTML = `<h4>Recibos Generados:</h4>`;
    if (!receiptsSnapshot.empty) {
      receiptsHTML += `<ul>`;
      receiptsSnapshot.forEach((doc, index) => {
        const receipt = doc.data();
        receiptsHTML += `
          <li>
            <strong>Recibo ${index + 1}:</strong>
            Fecha: ${receipt.invoiceDate || receipt.date} |
            Número de Factura: ${receipt.invoiceNumber || "N/A"} |
            Descripción: ${receipt.description || "N/A"} |
            Total: Q${receipt.total || receipt.invoiceTotal || "N/A"}
            <button class="download-receipt"
                    onclick="downloadReceipt('${orderId}', '${doc.id}')">Descargar
            </button>
        `;
        // Eliminar Recibo => admin o canDeleteReceipt
        if (userRole === "administrador" || userPermissions.canDeleteReceipt) {
          receiptsHTML += `
            <button class="delete-receipt"
                    onclick="deleteReceipt('${orderId}', '${doc.id}')">Eliminar
            </button>
          `;
        }
        receiptsHTML += `</li>`;
      });
      receiptsHTML += `</ul>`;
    } else {
      receiptsHTML += `<p>No se han generado recibos para este pedido.</p>`;
    }
    document.getElementById(`receiptsContainer${orderId}`).innerHTML = receiptsHTML;
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al cargar recibos",
      text: error.message,
      confirmButtonText: "Ok"
    });
  }
}

// ========================================================================
//                ELIMINAR RECIBO DE UN PEDIDO
// ========================================================================
async function deleteReceipt(orderId, receiptId) {
  Swal.fire({
    title: "¿Estás seguro?",
    text: "Se eliminará este recibo permanentemente.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await db
          .collection("orders")
          .doc(orderId)
          .collection("receipts")
          .doc(receiptId)
          .delete();
        Swal.fire({
          icon: "success",
          title: "Recibo eliminado",
          text: "El recibo ha sido eliminado exitosamente.",
        });
        loadReceipts(orderId, null);
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error al eliminar recibo",
          text: error.message
        });
      }
    }
  });
}

// ========================================================================
//                ELIMINAR PEDIDO (Y SUS RECIBOS)
// ========================================================================
async function deleteOrder(orderId) {
  Swal.fire({
    title: "¿Eliminar Pedido?",
    text: "Se eliminará el pedido y todos sus recibos. Esta acción es irreversible.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar"
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const receiptsSnapshot = await db
          .collection("orders")
          .doc(orderId)
          .collection("receipts")
          .get();
        const batch = db.batch();
        receiptsSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });

        const orderRef = db.collection("orders").doc(orderId);
        batch.delete(orderRef);
        await batch.commit();

        Swal.fire({
          icon: "success",
          title: "Pedido eliminado",
          text: "Se ha eliminado el pedido y sus recibos exitosamente.",
        });

        reloadOrders();
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error al eliminar pedido",
          text: error.message
        });
      }
    }
  });
}

// ========================================================================
//               MARCAR PEDIDO COMO COMPLETADO
// ========================================================================
async function markOrderAsCompleted(orderId) {
  Swal.fire({
    title: "¿Marcar como completado?",
    text: "Este pedido pasará a estado 'Completado'.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí, completar",
    cancelButtonText: "Cancelar"
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await db.collection("orders").doc(orderId).update({ status: "completed" });
        Swal.fire({
          icon: "success",
          title: "Pedido completado",
          text: "El pedido ha pasado a estado completado.",
        });
        reloadOrders();
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error al cambiar estado",
          text: error.message
        });
      }
    }
  });
}

// ========================================================================
//        MOSTRAR DETALLES DEL PEDIDO EN UN MODAL
// ========================================================================
function showOrderDetails(orderId) {
  db.collection("orders")
    .doc(orderId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const order = doc.data();
        let orderDetailsHTML = `
          <p><strong>ID Pedido:</strong> ${order.orderId}</p>
          <p><strong>Proveedor:</strong> ${order.providerName}</p>
          <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
          <p><strong>Fecha de Pedido:</strong> ${order.orderDate}</p>
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
        order.products.forEach((product) => {
          orderDetailsHTML += `
            <tr>
              <td>${product.name}</td>
              <td>${product.presentation}</td>
              <td>${product.quantity}</td>
            </tr>
          `;
        });
        orderDetailsHTML += `
            </tbody>
          </table>
        `;
        document.getElementById("orderDetails").innerHTML = orderDetailsHTML;
        document.getElementById("orderDetailsModal").style.display = "block";
        document.getElementById("exportOrderId").value = orderId;
      }
    })
    .catch((error) => {
      Swal.fire({
        icon: "error",
        title: "Error al mostrar detalles",
        text: error.message
      });
    });
}

function closeOrderDetailsModal() {
  document.getElementById("orderDetails").innerHTML = "";
  document.getElementById("orderDetailsModal").style.display = "none";
}

// ========================================================================
//                     EDITAR PEDIDO
// ========================================================================
function editOrder(orderId) {
  db.collection("orders")
    .doc(orderId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const order = doc.data();
        let editOrderHTML = `
          <input type="hidden" id="editOrderId" value="${orderId}">
          <p><strong>ID Pedido:</strong> ${order.orderId}</p>
          <p><strong>Proveedor:</strong> ${order.providerName}</p>
          <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
          <p><strong>Fecha de Pedido:</strong> <input type="date" id="editOrderDate" value="${order.orderDate}"></p>
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
        order.products.forEach((product, index) => {
          editOrderHTML += `
            <tr>
              <td><input type="text" value="${product.name}" id="editProductName${index}"></td>
              <td><input type="text" value="${product.presentation}" id="editProductPresentation${index}"></td>
              <td><input type="number" value="${product.quantity}" id="editProductQuantity${index}" min="1"></td>
              <td><button onclick="deleteProductRow(${index})">Eliminar</button></td>
            </tr>
          `;
        });
        editOrderHTML += `
            </tbody>
          </table>
          <button onclick="addProductRow()">Agregar Producto</button><br><br>
          <button onclick="saveEditedOrder()">Guardar Cambios</button>
        `;
        document.getElementById("editOrderDetails").innerHTML = editOrderHTML;
        document.getElementById("editOrderModal").style.display = "block";
      }
    })
    .catch((error) => {
      Swal.fire({
        icon: "error",
        title: "Error al editar pedido",
        text: error.message
      });
    });
}

function closeEditOrderModal() {
  document.getElementById("editOrderDetails").innerHTML = "";
  document.getElementById("editOrderModal").style.display = "none";
}

function addProductRow() {
  const index = document.querySelectorAll("#editOrderProducts tr").length;
  const newRow = `
    <tr>
      <td><input type="text" id="editProductName${index}"></td>
      <td><input type="text" id="editProductPresentation${index}"></td>
      <td><input type="number" id="editProductQuantity${index}" min="1"></td>
      <td><button onclick="deleteProductRow(${index})">Eliminar</button></td>
    </tr>
  `;
  document.getElementById("editOrderProducts").insertAdjacentHTML("beforeend", newRow);
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
  const productRows = document.querySelectorAll("#editOrderProducts tr");
  const products = Array.from(productRows).map((row, index) => ({
    name: document.getElementById(`editProductName${index}`).value.trim(),
    presentation: document.getElementById(`editProductPresentation${index}`).value.trim(),
    quantity: parseInt(document.getElementById(`editProductQuantity${index}`).value, 10)
  }));

  // Validar que todos los campos estén llenos y sean válidos
  for (let i = 0; i < products.length; i++) {
    if (!products[i].name || !products[i].presentation || isNaN(products[i].quantity) || products[i].quantity <= 0) {
      Swal.fire({
        icon: "error",
        title: "Campos Inválidos",
        text: `Por favor, completa todos los campos correctamente para el producto ${i + 1}.`
      });
      return;
    }
  }

  try {
    await db.collection("orders").doc(orderId).update({
      orderDate: orderDate,
      products: products
    });
    Swal.fire({
      icon: "success",
      title: "Pedido actualizado",
      text: "Los cambios se han guardado exitosamente."
    });
    closeEditOrderModal();
    reloadOrders();
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al guardar cambios",
      text: error.message
    });
  }
}

// ========================================================================
//    EXPORTAR PEDIDO (IMAGEN, PDF, EXCEL)
// ========================================================================
function exportOrder(orderId) {
  document.getElementById("exportModal").style.display = "block";
  document.getElementById("exportModal").dataset.orderId = orderId;
}

function closeExportModal() {
  document.getElementById("exportModal").style.display = "none";
}

async function exportAs(format) {
  const exportModal = document.getElementById("exportModal");
  const orderId = exportModal.dataset.orderId;
  try {
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (orderDoc.exists) {
      const order = orderDoc.data();
      const fileName = `Pedido_${order.providerName}_${order.orderId}_${order.orderDate}`;
      if (format === "image") {
        exportAsImage(order, fileName);
      } else if (format === "pdf") {
        exportAsPDF(order, fileName);
      } else if (format === "excel") {
        exportAsExcel(order, fileName);
      }
    }
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al exportar pedido",
      text: error.message
    });
  }
  closeExportModal();
}

// ------------------ Exportar como Imagen -------------------
function exportAsImage(order, fileName) {
  const element = document.createElement("div");
  element.style.padding = "20px";
  element.style.backgroundColor = "#fff";
  element.innerHTML = `
    <h2>Detalles del Pedido</h2>
    <p><strong>ID Pedido:</strong> ${order.orderId}</p>
    <p><strong>Proveedor:</strong> ${order.providerName}</p>
    <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
    <p><strong>Fecha:</strong> ${order.orderDate}</p>
    <table border="1" cellpadding="10" cellspacing="0">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="padding: 10px;">Producto</th>
          <th style="padding: 10px;">Presentación</th>
          <th style="padding: 10px;">Cantidad</th>
        </tr>
      </thead>
      <tbody>
        ${order.products
          .map(
            (product) => `
          <tr>
            <td style="padding: 10px;">${product.name}</td>
            <td style="padding: 10px;">${product.presentation}</td>
            <td style="padding: 10px;">${product.quantity}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
  document.body.appendChild(element);

  html2canvas(element).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imgData;
    link.download = `${fileName}.png`;
    link.click();
    document.body.removeChild(element);
  });
}

// ------------------ Exportar como PDF -------------------
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
  doc.text(`Sucursal: ${order.sucursalName}`, 10, 65);
  doc.text(`Descripción: ${order.description || "N/A"}`, 10, 75);

  const tableColumn = ["Producto", "Presentación", "Cantidad"];
  const tableRows = [];
  order.products.forEach((product) => {
    tableRows.push([product.name, product.presentation, product.quantity]);
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

// ------------------ Exportar como Excel -------------------
function exportAsExcel(order, fileName) {
  const wb = XLSX.utils.book_new();
  const ws_data = [
    ["ID Pedido", order.orderId],
    ["Proveedor", order.providerName],
    ["Sucursal", order.sucursalName],
    ["Fecha", order.orderDate],
    ["Descripción", order.description || "N/A"],
    [],
    ["Producto", "Presentación", "Cantidad"]
  ];
  order.products.forEach((product) => {
    ws_data.push([product.name, product.presentation, product.quantity]);
  });
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "Pedido");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

// ========================================================================
//        CONFIRMAR RECEPCIÓN DE PEDIDO CON FACTURA
// ========================================================================
async function confirmOrder(orderId) {
  try {
    const docSnap = await db.collection("orders").doc(orderId).get();
    if (!docSnap.exists) {
      Swal.fire({
        icon: "error",
        title: "Pedido no encontrado",
        text: "No se encontró el pedido en la base de datos."
      });
      return;
    }
    const order = docSnap.data();

    // Verificar si ya existe una recepción para este pedido
    const receiptsSnapshot = await db.collection("orders").doc(orderId).collection("receipts").orderBy("timestamp", "desc").limit(1).get();
    let existingReceipt = null;
    if (!receiptsSnapshot.empty) {
      existingReceipt = receiptsSnapshot.docs[0].data();
    }

    // Rellenar los campos de información del pedido en el modal
    document.getElementById("confirmOrderId").value = orderId;
    document.getElementById("orderIdDisplay").textContent = order.orderId;
    document.getElementById("providerNameDisplay").textContent = order.providerName;
    document.getElementById("sucursalNameDisplay").textContent = order.sucursalName;
    document.getElementById("orderDateDisplay").textContent = order.orderDate;

    // Rellenar los campos de factura si ya existe una recepción
    if (existingReceipt) {
      document.getElementById("invoiceNumber").value = existingReceipt.invoiceNumber || "";
      document.getElementById("invoiceDate").value = existingReceipt.invoiceDate || "";
    } else {
      document.getElementById("invoiceNumber").value = "";
      document.getElementById("invoiceDate").value = "";
    }

    // Generar las filas de productos en la tabla
    const productsContainer = document.getElementById("confirmOrderProducts");
    productsContainer.innerHTML = ""; // Limpiar contenido previo

    order.products.forEach((product, index) => {
      const receivedProduct =
        existingReceipt && existingReceipt.receivedProducts && existingReceipt.receivedProducts[index]
          ? existingReceipt.receivedProducts[index]
          : {};
      const receivedQuantity =
        receivedProduct.receivedQuantity !== undefined
          ? receivedProduct.receivedQuantity
          : 0;
      const unitPrice =
        receivedProduct.unitPrice !== undefined
          ? receivedProduct.unitPrice
          : 0;
      const totalPerProduct =
        receivedProduct.totalPerProduct !== undefined
          ? receivedProduct.totalPerProduct
          : 0;
      const comments = receivedProduct.comments || "";

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${product.name}</td>
        <td>${product.presentation}</td>
        <td>${product.quantity}</td>
        <td>
          <input type="number" id="receivedQuantity${index}"
                 value="${receivedQuantity}"
                 min="0" max="${product.quantity}">
        </td>
        <td>
          <input type="number" id="unitPrice${index}"
                 value="${unitPrice}"
                 step="0.01" min="0">
        </td>
        <td>Q<span id="totalPerProduct${index}">${totalPerProduct.toFixed(2)}</span></td>
        <td><input type="text" id="productComments${index}" value="${comments}"></td>
      `;

      productsContainer.appendChild(row);
    });

    // Inicializar el total de la factura
    calculateInvoiceTotal(order.products.length);

    // Agregar event listeners para actualizar totales al cambiar cantidad o precio
    order.products.forEach((product, index) => {
      const receivedQuantityInput = document.getElementById(`receivedQuantity${index}`);
      const unitPriceInput = document.getElementById(`unitPrice${index}`);

      receivedQuantityInput.addEventListener("input", () => {
        updateTotalPerProduct(index, product.quantity);
      });

      unitPriceInput.addEventListener("input", () => {
        updateTotalPerProduct(index, product.quantity);
      });
    });

    // Mostrar el modal de confirmación
    document.getElementById("confirmOrderModal").style.display = "block";
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al confirmar pedido",
      text: error.message
    });
  }
}

// Función para actualizar el total por producto
function updateTotalPerProduct(index, maxQuantity) {
  const receivedQuantityInput = document.getElementById(`receivedQuantity${index}`);
  const unitPriceInput = document.getElementById(`unitPrice${index}`);
  const totalPerProductSpan = document.getElementById(`totalPerProduct${index}`);

  let receivedQuantity = parseInt(receivedQuantityInput.value, 10);
  let unitPrice = parseFloat(unitPriceInput.value);

  if (isNaN(receivedQuantity) || receivedQuantity < 0) {
    receivedQuantity = 0;
    receivedQuantityInput.value = receivedQuantity;
  }
  if (receivedQuantity > maxQuantity) {
    receivedQuantity = maxQuantity;
    receivedQuantityInput.value = receivedQuantity;
  }
  if (isNaN(unitPrice) || unitPrice < 0) {
    unitPrice = 0;
    unitPriceInput.value = unitPrice.toFixed(2);
  }

  const totalPerProduct = receivedQuantity * unitPrice;
  totalPerProductSpan.textContent = totalPerProduct.toFixed(2);

  // Actualizar el total de la factura
  calculateInvoiceTotal(document.querySelectorAll("#confirmOrderProducts tr").length);
}

// Función para calcular y mostrar el total de la factura
function calculateInvoiceTotal(numberOfProducts) {
  let invoiceTotal = 0;
  for (let i = 0; i < numberOfProducts; i++) {
    const totalPerProduct = parseFloat(document.getElementById(`totalPerProduct${i}`).textContent);
    if (!isNaN(totalPerProduct)) {
      invoiceTotal += totalPerProduct;
    }
  }
  document.getElementById("invoiceTotal").textContent = invoiceTotal.toFixed(2);
}

async function saveConfirmedOrder() {
  const orderId = document.getElementById("confirmOrderId").value;

  // Obtener los valores de los campos de factura
  const invoiceNumber = document.getElementById("invoiceNumber").value.trim();
  const invoiceDate = document.getElementById("invoiceDate").value;

  // Validar que los campos no estén vacíos
  if (!invoiceNumber) {
    Swal.fire({
      icon: "error",
      title: "Número de Factura Vacío",
      text: "Por favor, ingresa el número de factura."
    });
    return;
  }

  if (!invoiceDate) {
    Swal.fire({
      icon: "error",
      title: "Fecha de Factura Vacía",
      text: "Por favor, ingresa la fecha de factura."
    });
    return;
  }

  // Validar que invoiceNumber sea un número positivo
  const invoiceNumberInt = parseInt(invoiceNumber, 10);
  if (isNaN(invoiceNumberInt) || invoiceNumberInt <= 0) {
    Swal.fire({
      icon: "error",
      title: "Número de Factura Inválido",
      text: "El número de factura debe ser un número positivo."
    });
    return;
  }

  // Obtener las cantidades recibidas, precios y comentarios
  const productRows = document.querySelectorAll("#confirmOrderProducts tr");
  const receivedProducts = Array.from(productRows).map((row, index) => {
    const receivedQuantity = parseInt(document.getElementById(`receivedQuantity${index}`).value, 10);
    const unitPrice = parseFloat(document.getElementById(`unitPrice${index}`).value);
    const totalPerProduct = parseFloat(document.getElementById(`totalPerProduct${index}`).textContent);
    const comments = document.getElementById(`productComments${index}`).value.trim();
    return {
      name: row.cells[0].textContent,
      presentation: row.cells[1].textContent,
      quantity: parseInt(row.cells[2].textContent, 10),
      receivedQuantity: isNaN(receivedQuantity) ? 0 : receivedQuantity,
      unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
      totalPerProduct: isNaN(totalPerProduct) ? 0 : totalPerProduct,
      comments: comments
    };
  });

  // Validar las cantidades recibidas y precios
  for (let product of receivedProducts) {
    if (isNaN(product.receivedQuantity) || product.receivedQuantity < 0 || product.receivedQuantity > product.quantity) {
      Swal.fire({
        icon: "error",
        title: "Cantidad Recibida Inválida",
        text: `La cantidad recibida para "${product.name}" es inválida. Debe ser un número entre 0 y ${product.quantity}.`
      });
      return;
    }
    if (isNaN(product.unitPrice) || product.unitPrice < 0) {
      Swal.fire({
        icon: "error",
        title: "Precio por Unidad Inválido",
        text: `El precio por unidad para "${product.name}" es inválido. Debe ser un número positivo.`
      });
      return;
    }
  }

  try {
    // Crear una nueva recepción en la subcolección 'receipts' usando los datos introducidos por el usuario
    const invoiceTotal = parseFloat(document.getElementById("invoiceTotal").textContent);

    const newReceipt = {
      invoiceNumber: invoiceNumberInt,
      invoiceDate: invoiceDate,
      receivedProducts: receivedProducts,
      invoiceTotal: invoiceTotal,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("orders").doc(orderId).collection("receipts").add(newReceipt);

    // Actualizar el estado del pedido a 'caminoATienda' si es necesario
    // Dependiendo de tu flujo, podrías querer avanzar automáticamente al siguiente estado
    // Aquí, dejaremos que el administrador lo cambie manualmente

    Swal.fire({
      icon: "success",
      title: "Recepción Guardada",
      text: "Las cantidades recibidas y los detalles de la factura se han guardado correctamente."
    });

    closeConfirmOrderModal();
    reloadOrders();

    // Mostrar automáticamente la ventana de exportar imagen
    shareReceptionImage(orderId);

  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al Guardar Recepción",
      text: error.message
    });
  }
}

// ========================================================================
//      MOSTRAR DETALLES DEL PEDIDO RECIBIDO (PEDIDOS COMPLETADOS)
// ========================================================================
function showReceivedOrder(orderId) {
  db.collection("orders")
    .doc(orderId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const order = doc.data();
        let receivedOrderHTML = `
          <p><strong>ID Pedido:</strong> ${order.orderId}</p>
          <p><strong>Proveedor:</strong> ${order.providerName}</p>
          <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
          <p><strong>Fecha de Pedido:</strong> ${order.orderDate}</p>
          <p><strong>Número de Factura:</strong> ${order.invoiceNumber || "N/A"}</p>
          <p><strong>Fecha de Factura:</strong> ${order.invoiceDate || "N/A"}</p>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Presentación</th>
                <th>Cantidad Pedido</th>
                <th>Cantidad Recibida</th>
                <th>Precio por Unidad (Q)</th>
                <th>Total (Q)</th>
                <th>Comentarios</th>
              </tr>
            </thead>
            <tbody>
        `;
        if (order.receivedProducts && order.receivedProducts.length > 0) {
          order.receivedProducts.forEach((product) => {
            receivedOrderHTML += `
              <tr>
                <td>${product.name}</td>
                <td>${product.presentation}</td>
                <td>${product.quantity}</td>
                <td>${product.receivedQuantity}</td>
                <td>${product.unitPrice !== undefined ? `Q${product.unitPrice.toFixed(2)}` : "N/A"}</td>
                <td>${product.totalPerProduct !== undefined ? `Q${product.totalPerProduct.toFixed(2)}` : "N/A"}</td>
                <td>${product.comments}</td>
              </tr>
            `;
          });
          receivedOrderHTML += `
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5" style="text-align: right;"><strong>Total de la Factura:</strong></td>
                <td colspan="2"><strong>Q${order.invoiceTotal.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          `;
        } else {
          receivedOrderHTML += `
            <tr>
              <td colspan="7">No se han ingresado cantidades recibidas.</td>
            </tr>
          `;
        }
        receivedOrderHTML += `
            </tbody>
          </table>
        `;
        document.getElementById("receivedOrderDetails").innerHTML = receivedOrderHTML;
        document.getElementById("receivedOrderModal").style.display = "block";
      }
    })
    .catch((error) => {
      Swal.fire({
        icon: "error",
        title: "Error al mostrar detalles",
        text: error.message
      });
    });
}

function closeReceivedOrderModal() {
  document.getElementById("receivedOrderDetails").innerHTML = "";
  document.getElementById("receivedOrderModal").style.display = "none";
}

// ========================================================================
//         CAMBIAR ESTADO DEL PEDIDO MANUALMENTE
// ========================================================================
function openChangeStatusModal(orderId) {
  if (!(userRole === "administrador" || userPermissions.canChangeStatus)) {
    Swal.fire({
      icon: "warning",
      title: "Sin Permiso",
      text: "No tienes permiso para cambiar el estado de este pedido."
    });
    return;
  }
  const changeStatusModal = document.getElementById("changeStatusModal");
  changeStatusModal.style.display = "block";
  changeStatusModal.dataset.orderId = orderId;
}

function closeChangeStatusModal() {
  const changeStatusModal = document.getElementById("changeStatusModal");
  changeStatusModal.style.display = "none";
  changeStatusModal.dataset.orderId = "";
}

async function changeOrderStatusManually(newStatus) {
  const changeStatusModal = document.getElementById("changeStatusModal");
  const orderId = changeStatusModal.dataset.orderId;
  if (!orderId) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo identificar el pedido."
    });
    return;
  }
  try {
    await db.collection("orders").doc(orderId).update({ status: newStatus });
    Swal.fire({
      icon: "success",
      title: "Estado cambiado",
      text: `El pedido se movió a "${getStatusText(newStatus)}".`
    });
    closeChangeStatusModal();
    reloadOrders();
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al cambiar estado",
      text: error.message
    });
  }
}

function getStatusText(status) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "pedidoTomado":
      return "Pedido Tomado";
    case "caminoABodega":
      return "Camino a Bodega";
    case "pedidoEnBodega":
      return "Pedido en Bodega";
    case "caminoATienda":
      return "Camino a Tienda";
    case "completed":
      return "Completado";
    default:
      return "Estado Desconocido";
  }
}

// ========================================================================
//        GENERAR RECIBO MANUAL
// ========================================================================
function openGenerateReceiptModal(orderId) {
  const generateReceiptModal = document.getElementById("generateReceiptModal");
  generateReceiptModal.style.display = "block";
  generateReceiptModal.dataset.orderId = orderId;

  db.collection("orders")
    .doc(orderId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const order = doc.data();
        document.getElementById("receiptSucursalName").innerText = order.sucursalName;
        document.getElementById("receiptOrderId").value = order.orderId;
      }
    })
    .catch((error) => {
      Swal.fire({
        icon: "error",
        title: "Error al obtener pedido",
        text: error.message
      });
    });
}

function closeGenerateReceiptModal() {
  const generateReceiptModal = document.getElementById("generateReceiptModal");
  generateReceiptModal.style.display = "none";
  generateReceiptModal.dataset.orderId = "";
  document.getElementById("receiptForm").reset();
}

async function saveReceipt() {
  const generateReceiptModal = document.getElementById("generateReceiptModal");
  const orderId = generateReceiptModal.dataset.orderId;

  const receiptDate = document.getElementById("receiptDate").value;
  const receiptDescription = document.getElementById("receiptDescription").value.trim();
  const receiptTotal = parseFloat(document.getElementById("receiptTotal").value);

  if (!receiptDate || !receiptDescription || isNaN(receiptTotal)) {
    Swal.fire({
      icon: "error",
      title: "Campos incompletos",
      text: "Completa la fecha, descripción y total del recibo."
    });
    return;
  }

  try {
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      Swal.fire({
        icon: "error",
        title: "Pedido no existe",
        text: "No se encontró el pedido en la base de datos."
      });
      return;
    }
    const order = orderDoc.data();

    const newReceipt = {
      invoiceNumber: parseInt(document.getElementById("receiptOrderId").value, 10), // Suponiendo que orderId es el número de factura
      invoiceDate: receiptDate,
      description: receiptDescription,
      total: receiptTotal,
      sucursalName: order.sucursalName,
      orderId: order.orderId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    const receiptsRef = db.collection("orders").doc(orderId).collection("receipts");
    await receiptsRef.add(newReceipt);

    Swal.fire({
      icon: "success",
      title: "Recibo manual guardado",
      text: "El recibo se guardó exitosamente."
    });
    closeGenerateReceiptModal();

    // Refrescamos
    loadCompletedOrdersAdmin();
    loadReceipts(
      orderId,
      document.querySelector(`.order-card button[onclick="openGenerateReceiptModal('${orderId}')"]`)?.parentElement
    );
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al guardar recibo",
      text: error.message
    });
  }
}

// ========================================================================
//      GENERAR RECIBO AUTOMÁTICO (SIN CAMPO TOTAL, FILTRA PRODUCTOS)
// ========================================================================
function openGenerateAutomaticReceiptModal(orderId) {
  const generateAutomaticReceiptModal = document.getElementById("generateAutomaticReceiptModal");
  generateAutomaticReceiptModal.style.display = "block";
  generateAutomaticReceiptModal.dataset.orderId = orderId;

  db.collection("orders")
    .doc(orderId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const order = doc.data();
        document.getElementById("autoReceiptSucursalName").innerText = order.sucursalName;
        document.getElementById("autoReceiptOrderId").value = order.orderId;
      }
    })
    .catch((error) => {
      Swal.fire({
        icon: "error",
        title: "Error al obtener pedido",
        text: error.message
      });
    });

  loadAutomaticReceiptProducts(orderId);
}

function closeGenerateAutomaticReceiptModal() {
  const generateAutomaticReceiptModal = document.getElementById("generateAutomaticReceiptModal");
  generateAutomaticReceiptModal.style.display = "none";
  generateAutomaticReceiptModal.dataset.orderId = "";
  document.getElementById("automaticReceiptForm").reset();
  document.getElementById("autoReceiptProductsContainer").innerHTML = "";
}

async function loadAutomaticReceiptProducts(orderId) {
  try {
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      Swal.fire({
        icon: "error",
        title: "Pedido no existe",
        text: "No se encontró el pedido en la base de datos."
      });
      return;
    }
    const order = orderDoc.data();
    const products = order.products || [];

    const productsContainer = document.getElementById("autoReceiptProductsContainer");
    productsContainer.innerHTML = "";

    if (products.length === 0) {
      productsContainer.innerHTML = "<p>No hay productos para este pedido.</p>";
      return;
    }

    products.forEach((product, index) => {
      productsContainer.innerHTML += `
        <div class="auto-receipt-product">
          <input 
            type="checkbox" 
            id="autoReceiptProduct${index}" 
            name="autoReceiptProduct" 
            value="${product.name}"
          >
          <label for="autoReceiptProduct${index}">
            ${product.name} (${product.presentation}) - Cantidad Pedida: ${product.quantity}
          </label><br>

          <label for="autoReceiptReceivedQuantity${index}">Cantidad Recibida:</label>
          <input 
            type="number" 
            id="autoReceiptReceivedQuantity${index}" 
            name="autoReceiptReceivedQuantity" 
            min="0" 
            max="${product.quantity}" 
            disabled
          >
          <br><br>

          <label for="autoReceiptPrice${index}">Precio por Unidad (Q):</label>
          <input 
            type="number" 
            id="autoReceiptPrice${index}" 
            name="autoReceiptPrice"
            step="0.01" 
            min="0" 
            disabled
          >
          <br><br>
        </div>
      `;
    });

    // Añadir eventos para habilitar/deshabilitar los campos
    products.forEach((product, index) => {
      const checkbox = document.getElementById(`autoReceiptProduct${index}`);
      const receivedQuantityInput = document.getElementById(`autoReceiptReceivedQuantity${index}`);
      const priceInput = document.getElementById(`autoReceiptPrice${index}`);

      checkbox.addEventListener("change", () => {
        const checked = checkbox.checked;
        receivedQuantityInput.disabled = !checked;
        priceInput.disabled = !checked;
        if (!checked) {
          receivedQuantityInput.value = "";
          priceInput.value = "";
          // No hay total por producto en este modal
        }
      });

      receivedQuantityInput.addEventListener("input", () => {
        calculateInvoiceTotalAutomatic();
      });

      priceInput.addEventListener("input", () => {
        calculateInvoiceTotalAutomatic();
      });
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al cargar productos",
      text: error.message
    });
  }
}

// Función para calcular y mostrar el total de la factura en recibo automático
function calculateInvoiceTotalAutomatic() {
  let invoiceTotal = 0;
  const productDivs = document.getElementsByClassName("auto-receipt-product");
  for (let i = 0; i < productDivs.length; i++) {
    const checkbox = document.getElementById(`autoReceiptProduct${i}`);
    if (checkbox.checked) {
      const receivedQuantity = parseInt(document.getElementById(`autoReceiptReceivedQuantity${i}`).value, 10) || 0;
      const unitPrice = parseFloat(document.getElementById(`autoReceiptPrice${i}`).value) || 0;
      invoiceTotal += receivedQuantity * unitPrice;
    }
  }
  // Puedes mostrar el total en el formulario de recibo automático si lo deseas
  // Por ejemplo:
  // document.getElementById("autoReceiptTotal").textContent = invoiceTotal.toFixed(2);
}

// ========================================================================
//        DESCARGAR RECIBO COMO PDF (CON PRECIO, SI APLICA)
// ========================================================================
async function downloadReceipt(orderId, receiptId) {
  try {
    const receiptDoc = await db
      .collection("orders")
      .doc(orderId)
      .collection("receipts")
      .doc(receiptId)
      .get();
    if (!receiptDoc.exists) {
      Swal.fire({
        icon: "error",
        title: "Recibo no existe",
        text: "No se encontró este recibo en la base de datos."
      });
      return;
    }
    const receipt = receiptDoc.data();

    if (!logoBase64) {
      Swal.fire({
        icon: "warning",
        title: "Logo no disponible",
        text: "El logo aún no se ha cargado. Intenta nuevamente en unos segundos."
      });
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.addImage(logoBase64, "PNG", 10, 10, 66, 20);

    doc.setFontSize(16);
    doc.text(`Recibo de Pedido ID: ${receipt.orderId}`, 105, 35, {
      align: "center",
    });

    doc.setFontSize(12);
    doc.text(`Fecha: ${receipt.invoiceDate || receipt.date}`, 10, 55);
    doc.text(`Sucursal: ${receipt.sucursalName}`, 10, 65);
    doc.text(`Descripción: ${receipt.description}`, 10, 75);

    if (receipt.receivedProducts && receipt.receivedProducts.length > 0) {
      const tableColumn = ["Producto", "Presentación", "Cantidad Recibida", "Precio por Unidad (Q)", "Total (Q)"];
      const tableRows = [];
      receipt.receivedProducts.forEach((product) => {
        tableRows.push([
          product.name,
          product.presentation,
          product.receivedQuantity,
          product.unitPrice !== undefined ? `Q${product.unitPrice.toFixed(2)}` : "N/A",
          product.totalPerProduct !== undefined ? `Q${product.totalPerProduct.toFixed(2)}` : "N/A"
        ]);
      });

      doc.autoTable({
        startY: 85,
        head: [tableColumn],
        body: tableRows,
        theme: "grid",
        headStyles: { fillColor: [60, 141, 188] },
        styles: { fontSize: 10 },
      });
    }

    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 85;
    doc.text(`Total de la Factura: Q${receipt.invoiceTotal.toFixed(2)}`, 140, finalY + 10);

    const safeSucursal = receipt.sucursalName.replace(/\s+/g, "_");
    const safeDescription = receipt.description.replace(/\s+/g, "_");
    const safeDate = (receipt.invoiceDate || receipt.date).replace(/\s+/g, "_");

    const pdfFileName = `Recibo_${safeSucursal}_${safeDate}_${safeDescription}.pdf`;
    doc.save(pdfFileName);
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al descargar recibo",
      text: error.message
    });
  }
}

// ========================================================================
//   NUEVO: GENERAR IMAGEN DE LA RECEPCIÓN CON OPCIÓN COMPARTIR / DESCARGAR
// ========================================================================
async function shareReceptionImage(orderId) {
  try {
    // 1) Obtener el pedido para tener la info de la recepción
    const docSnap = await db.collection("orders").doc(orderId).get();
    if (!docSnap.exists) {
      Swal.fire({
        icon: "error",
        title: "Pedido no encontrado",
        text: "No se encontró el pedido para generar la imagen."
      });
      return;
    }
    const order = docSnap.data();

    // Obtener la última recepción
    const receiptsSnapshot = await db.collection("orders").doc(orderId).collection("receipts").orderBy("timestamp", "desc").limit(1).get();
    if (receiptsSnapshot.empty) {
      Swal.fire({
        icon: "info",
        title: "No hay recepción registrada",
        text: "No se ha registrado una recepción para este pedido."
      });
      return;
    }
    const receipt = receiptsSnapshot.docs[0].data();

    // 2) Crear un contenedor temporal con la info recibida
    const tempDiv = document.createElement("div");
    tempDiv.style.padding = "20px";
    tempDiv.style.backgroundColor = "#fff";
    tempDiv.innerHTML = `
      <h2>Recepción de Pedido</h2>
      <p><strong>ID Pedido:</strong> ${order.orderId}</p>
      <p><strong>Proveedor:</strong> ${order.providerName}</p>
      <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
      <p><strong>Fecha:</strong> ${order.orderDate}</p>
      <p><strong>Número de Factura:</strong> ${receipt.invoiceNumber || "N/A"}</p>
      <p><strong>Fecha de Factura:</strong> ${receipt.invoiceDate || "N/A"}</p>
      <table border="1" cellpadding="10" cellspacing="0">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th>Producto</th>
            <th>Presentación</th>
            <th>Cantidad Pedida</th>
            <th>Cantidad Recibida</th>
            <th>Precio por Unidad (Q)</th>
            <th>Total (Q)</th>
            <th>Comentarios</th>
          </tr>
        </thead>
        <tbody>
          ${
            receipt.receivedProducts && receipt.receivedProducts.length > 0
              ? receipt.receivedProducts.map(rp => `
                  <tr>
                    <td>${rp.name}</td>
                    <td>${rp.presentation}</td>
                    <td>${rp.quantity}</td>
                    <td>${rp.receivedQuantity}</td>
                    <td>${rp.unitPrice !== undefined ? `Q${rp.unitPrice.toFixed(2)}` : "N/A"}</td>
                    <td>${rp.totalPerProduct !== undefined ? `Q${rp.totalPerProduct.toFixed(2)}` : "N/A"}</td>
                    <td>${rp.comments || ''}</td>
                  </tr>
                `).join("")
              : `<tr><td colspan="7">No se han registrado cantidades recibidas.</td></tr>`
          }
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="text-align: right;"><strong>Total de la Factura:</strong></td>
            <td colspan="2"><strong>Q${receipt.invoiceTotal.toFixed(2)}</strong></td>
          </tr>
        </tfoot>
      </table>
    `;
    document.body.appendChild(tempDiv);

    // 3) Generar la imagen usando html2canvas
    const canvas = await html2canvas(tempDiv);
    const imageData = canvas.toDataURL("image/png");

    // 4) Eliminar el DIV temporal
    document.body.removeChild(tempDiv);

    // 5) Ofrecer dos opciones: Compartir o Descargar
    Swal.fire({
      title: "Recepción generada",
      text: "Selecciona una opción",
      icon: "question",
      showDenyButton: true,
      confirmButtonText: "Compartir",
      denyButtonText: "Descargar"
    }).then(async (result) => {
      if (result.isConfirmed) {
        // Intentar compartir (Web Share API)
        if (navigator.share) {
          try {
            // Convertir la dataURL en un File para compartir
            const fileToShare = dataURLtoFile(imageData, `Recepcion_${order.orderId}.png`);
            await navigator.share({
              title: "Recepción de Pedido",
              text: "Detalle de la recepción",
              files: [fileToShare]
            });
          } catch (err) {
            // Si falla la compartición, realizar descarga como fallback
            Swal.fire({
              icon: "info",
              title: "No se pudo compartir",
              text: "Descargando la imagen en su lugar."
            });
            downloadImage(imageData, `Recepcion_${order.orderId}.png`);
          }
        } else {
          // Si no está disponible navigator.share, forzar descarga
          Swal.fire({
            icon: "info",
            title: "Compartir no soportado",
            text: "Descargando la imagen en su lugar."
          });
          downloadImage(imageData, `Recepcion_${order.orderId}.png`);
        }
      } else if (result.isDenied) {
        // Descargar la imagen
        downloadImage(imageData, `Recepcion_${order.orderId}.png`);
      }
    });

  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error al generar imagen",
      text: error.message
    });
  }
}

// Función auxiliar para convertir base64 a File (usado en navigator.share)
function dataURLtoFile(dataUrl, fileName) {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], fileName, { type: mime });
}

// Función auxiliar para forzar descarga de la imagen en desktop
function downloadImage(dataUrl, fileName) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ========================================================================
//         CERRAR MODAL DE CONFIRMACIÓN DE PEDIDO
// ========================================================================
window.closeConfirmOrderModal = function() {
  // Resetear campos de factura
  document.getElementById("invoiceNumber").value = "";
  document.getElementById("invoiceDate").value = "";

  // Limpiar información del pedido
  document.getElementById("orderIdDisplay").textContent = "";
  document.getElementById("providerNameDisplay").textContent = "";
  document.getElementById("sucursalNameDisplay").textContent = "";
  document.getElementById("orderDateDisplay").textContent = "";

  // Limpiar filas de productos
  document.getElementById("confirmOrderProducts").innerHTML = "";

  // Resetear total de la factura
  document.getElementById("invoiceTotal").textContent = "0.00";

  // Ocultar el modal
  document.getElementById("confirmOrderModal").style.display = "none";
};

// ========================================================================
//               CAMBIAR ESTADO DEL PEDIDO DIRECTAMENTE
// ========================================================================
/**
 * Cambia el estado de un pedido directamente desde un botón.
 * @param {string} orderId - ID del documento del pedido en Firestore.
 * @param {string} newStatus - Nuevo estado a asignar (por ejemplo, 'pedidoTomado').
 */
async function changeOrderStatus(orderId, newStatus) {
  // Obtener el texto legible del estado
  const statusText = getStatusText(newStatus);

  // Confirmación con el usuario antes de cambiar el estado
  Swal.fire({
    title: `¿Marcar como ${statusText}?`,
    text: `Este pedido pasará a estado "${statusText}".`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sí, cambiar",
    cancelButtonText: "Cancelar"
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        // Actualizar el estado del pedido en Firestore
        await db.collection("orders").doc(orderId).update({ status: newStatus });

        // Notificar al usuario sobre el éxito de la operación
        Swal.fire({
          icon: "success",
          title: "Estado cambiado",
          text: `El pedido ha sido marcado como "${statusText}".`
        });

        // Recargar la lista de pedidos para reflejar el cambio
        reloadOrders();
      } catch (error) {
        // Manejar errores durante la actualización
        Swal.fire({
          icon: "error",
          title: "Error al cambiar estado",
          text: error.message
        });
      }
    }
  });
}
