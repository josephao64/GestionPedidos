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
  //     OBTENER USUARIO LOGUEADO, SUCURSAL Y ROL (AL CARGAR LA PÁGINA)
  // ========================================================================
  document.addEventListener("DOMContentLoaded", async () => {
    // 1. Inicializamos datos del usuario (username, rol, sucursal, permisos)
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
  //        FUNCIÓN PARA OBTENER USERNAME, SUCURSALID, ROL Y PERMISOS
  // ========================================================================
  async function initUserAndSucursal() {
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
      Swal.fire({
        icon: "error",
        title: "Error al cargar el logo",
        text: "Asegúrate de que la imagen (logo.png) esté en la carpeta correcta.",
        confirmButtonText: "Ok"
      });
    };
  }
  
  // ========================================================================
  //        BOTONES / FUNCIONES GENERALES DE PESTAÑAS Y NAVEGACIÓN
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
    window.location.href = "INDEX.html";
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
      let query = db.collection("orders").where("status", "==", "inProcess");
  
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
      `;
      if (userRole === "administrador" || userPermissions.canChangeStatus) {
        cardHTML += `
          <button onclick="openChangeStatusModal('${orderDocId}')">Cambiar Estado</button>
        `;
      }
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
  
    // Cambiar estado => pending -> inProcess (admin o canChangeStatus)
    if (status === "pending") {
      if (userRole === "administrador" || userPermissions.canChangeStatus) {
        cardHTML += `
          <button onclick="changeOrderStatus('${orderDocId}', 'inProcess')">Marcar como en Proceso</button>
        `;
      }
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
              Fecha: ${receipt.date} |
              Descripción: ${receipt.description} |
              Total: Q${receipt.total}
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
  //           ELIMINAR RECIBO DE UN PEDIDO
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
  //       MOSTRAR DETALLES DEL PEDIDO EN UN MODAL
  // ========================================================================
  function showOrderDetails(orderId) {
    db.collection("orders")
      .doc(orderId)
      .get()
      .then((doc) => {
        if (doc.exists) {
          const order = doc.data();
          let orderDetailsHTML = `
            <p>ID Pedido: ${order.orderId}</p>
            <p>Proveedor: ${order.providerName}</p>
            <p>Sucursal: ${order.sucursalName}</p>
            <p>Fecha: ${order.orderDate}</p>
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
            <p>ID Pedido: ${order.orderId}</p>
            <p>Proveedor: ${order.providerName}</p>
            <p>Sucursal: ${order.sucursalName}</p>
            <p>Fecha: <input type="date" id="editOrderDate" value="${order.orderDate}"></p>
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
                <td><input type="number" value="${product.quantity}" id="editProductQuantity${index}"></td>
                <td><button onclick="deleteProductRow(${index})">Eliminar</button></td>
              </tr>
            `;
          });
          editOrderHTML += `
              </tbody>
            </table>
            <button onclick="addProductRow()">Agregar Producto</button>
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
        <td><input type="number" id="editProductQuantity${index}"></td>
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
      name: document.getElementById(`editProductName${index}`).value,
      presentation: document.getElementById(`editProductPresentation${index}`).value,
      quantity: parseInt(document.getElementById(`editProductQuantity${index}`).value, 10)
    }));
  
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
    const orderId =
      document.getElementById("exportModal").dataset.orderId ||
      document.getElementById("exportOrderId").value;
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
      <p><strong>Descripción:</strong> ${order.description || "N/A"}</p>
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
    doc.text(`Recibo de Pedido ID: ${order.orderId}`, 100, 35, { align: "center" });
  
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
  //         CONFIRMAR RECEPCIÓN DE PEDIDO (CUANDO status='inProcess')
  // ========================================================================
  function confirmOrder(orderId) {
    // Ya no limitamos a admin o canChangeStatus, todos pueden
    db.collection("orders")
      .doc(orderId)
      .get()
      .then((doc) => {
        if (doc.exists) {
          const order = doc.data();
          let confirmOrderHTML = `
            <input type="hidden" id="confirmOrderId" value="${orderId}">
            <p>ID Pedido: ${order.orderId}</p>
            <p>Proveedor: ${order.providerName}</p>
            <p>Sucursal: ${order.sucursalName}</p>
            <p>Fecha: ${order.orderDate}</p>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Presentación</th>
                  <th>Cantidad Pedido</th>
                  <th>Cantidad Recibida</th>
                  <th>Comentarios</th>
                </tr>
              </thead>
              <tbody id="confirmOrderProducts">
          `;
          order.products.forEach((product, index) => {
            const receivedProduct =
              order.receivedProducts && order.receivedProducts[index]
                ? order.receivedProducts[index]
                : {};
            const receivedQuantity =
              receivedProduct.receivedQuantity !== undefined
                ? receivedProduct.receivedQuantity
                : product.quantity;
            const comments = receivedProduct.comments || "";
            confirmOrderHTML += `
              <tr>
                <td>${product.name}</td>
                <td>${product.presentation}</td>
                <td>${product.quantity}</td>
                <td>
                  <input type="number" id="receivedQuantity${index}"
                         value="${receivedQuantity}"
                         min="0" max="${product.quantity}">
                </td>
                <td><input type="text" id="productComments${index}" value="${comments}"></td>
              </tr>
            `;
          });
          confirmOrderHTML += `
              </tbody>
            </table>
          `;
          document.getElementById("confirmOrderDetails").innerHTML = confirmOrderHTML;
          document.getElementById("confirmOrderModal").style.display = "block";
        }
      })
      .catch((error) => {
        Swal.fire({
          icon: "error",
          title: "Error al confirmar pedido",
          text: error.message
        });
      });
  }
  
  function closeConfirmOrderModal() {
    document.getElementById("confirmOrderDetails").innerHTML = "";
    document.getElementById("confirmOrderModal").style.display = "none";
  }
  
  async function saveConfirmedOrder() {
    const orderId = document.getElementById("confirmOrderId").value;
    const productRows = document.querySelectorAll("#confirmOrderProducts tr");
    const receivedProducts = Array.from(productRows).map((row, index) => {
      const receivedQuantity = document.getElementById(`receivedQuantity${index}`).value;
      const comments = document.getElementById(`productComments${index}`).value;
      return {
        receivedQuantity: parseInt(receivedQuantity, 10),
        comments: comments.trim()
      };
    });
  
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
  
      const updatedReceivedProducts = order.products.map((product, index) => ({
        name: product.name,
        presentation: product.presentation,
        quantity: product.quantity,
        receivedQuantity: receivedProducts[index].receivedQuantity,
        comments: receivedProducts[index].comments
      }));
  
      await db.collection("orders").doc(orderId).update({
        receivedProducts: updatedReceivedProducts
      });
  
      Swal.fire({
        icon: "success",
        title: "Recepción guardada",
        text: "Cantidades recibidas y comentarios guardados exitosamente."
      });
  
      // Preguntar si desea generar/compartir la imagen de la recepción
      Swal.fire({
        title: "¿Deseas compartir o descargar la recepción en imagen?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Sí, compartir/descargar",
        cancelButtonText: "No, gracias"
      }).then(async (result) => {
        if (result.isConfirmed) {
          await shareReceptionImage(orderId);
        }
      });
  
      closeConfirmOrderModal();
      reloadOrders(); 
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al guardar recepción",
        text: error.message
      });
    }
  }
  
  // ========================================================================
  //       MOSTRAR DETALLES DEL PEDIDO RECIBIDO (PEDIDOS COMPLETADOS)
  // ========================================================================
  function showReceivedOrder(orderId) {
    db.collection("orders")
      .doc(orderId)
      .get()
      .then((doc) => {
        if (doc.exists) {
          const order = doc.data();
          let receivedOrderHTML = `
            <p>ID Pedido: ${order.orderId}</p>
            <p>Proveedor: ${order.providerName}</p>
            <p>Sucursal: ${order.sucursalName}</p>
            <p>Fecha: ${order.orderDate}</p>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Presentación</th>
                  <th>Cantidad Pedido</th>
                  <th>Cantidad Recibida</th>
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
                  <td>${product.comments}</td>
                </tr>
              `;
            });
          } else {
            receivedOrderHTML += `
              <tr>
                <td colspan="5">No se han ingresado cantidades recibidas.</td>
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
        return "Pedidos Pendientes";
      case "inProcess":
        return "Pedidos en Proceso";
      case "completed":
        return "Pedidos Completados";
      default:
        return "Estado Desconocido";
    }
  }
  
  async function changeOrderStatus(orderId, newStatus) {
    if (!(userRole === "administrador" || userPermissions.canChangeStatus)) {
      Swal.fire({
        icon: "warning",
        title: "Sin Permiso",
        text: "No tienes permiso para cambiar este pedido de estado."
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
      reloadOrders();
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al cambiar estado",
        text: error.message
      });
    }
  }
  
  // ========================================================================
  //          GENERAR RECIBO MANUAL
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
        date: receiptDate,
        description: receiptDescription,
        total: receiptTotal,
        sucursalName: order.sucursalName,
        orderId: order.orderId,
        products: []
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
  
            <label for="autoReceiptPrice${index}">Precio (Q):</label>
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
          }
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
  
  async function saveAutomaticReceipt() {
    const generateAutomaticReceiptModal = document.getElementById("generateAutomaticReceiptModal");
    const orderId = generateAutomaticReceiptModal.dataset.orderId;
  
    const receiptDate = document.getElementById("autoReceiptDate").value;
    const receiptDescription = document.getElementById("autoReceiptDescription").value.trim();
  
    let calculatedTotal = 0;
  
    if (!receiptDate || !receiptDescription) {
      Swal.fire({
        icon: "error",
        title: "Campos incompletos",
        text: "Completa la fecha y la descripción del recibo."
      });
      return;
    }
  
    const selectedProducts = [];
    const productsContainer = document.getElementById("autoReceiptProductsContainer");
    const productDivs = productsContainer.getElementsByClassName("auto-receipt-product");
  
    for (let i = 0; i < productDivs.length; i++) {
      const checkbox = productDivs[i].querySelector('input[type="checkbox"]');
      const receivedQuantityInput = productDivs[i].querySelector('input[name="autoReceiptReceivedQuantity"]');
      const priceInput = productDivs[i].querySelector('input[name="autoReceiptPrice"]');
  
      if (checkbox.checked) {
        const productName = checkbox.value;
        const receivedQuantity = parseInt(receivedQuantityInput.value, 10);
        const price = parseFloat(priceInput.value);
  
        if (isNaN(receivedQuantity) || receivedQuantity < 0) {
          Swal.fire({
            icon: "error",
            title: "Cantidad inválida",
            text: `Cantidad recibida inválida para "${productName}".`
          });
          return;
        }
        if (isNaN(price) || price < 0) {
          Swal.fire({
            icon: "error",
            title: "Precio inválido",
            text: `Precio inválido para "${productName}".`
          });
          return;
        }
  
        calculatedTotal += price * receivedQuantity;
  
        selectedProducts.push({
          name: productName,
          receivedQuantity: receivedQuantity,
          price: price
        });
      }
    }
  
    if (selectedProducts.length === 0) {
      Swal.fire({
        icon: "info",
        title: "Sin productos seleccionados",
        text: "No se ha seleccionado ningún producto para el recibo."
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
        date: receiptDate,
        description: receiptDescription,
        total: parseFloat(calculatedTotal.toFixed(2)),
        sucursalName: order.sucursalName,
        orderId: order.orderId,
        products: selectedProducts
      };
  
      const receiptsRef = db.collection("orders").doc(orderId).collection("receipts");
      await receiptsRef.add(newReceipt);
  
      Swal.fire({
        icon: "success",
        title: "Recibo automático guardado",
        text: `Total calculado: Q${calculatedTotal.toFixed(2)}`
      });
      closeGenerateAutomaticReceiptModal();
  
      // Refrescamos
      loadCompletedOrdersAdmin();
      loadReceipts(
        orderId,
        document.querySelector(`.order-card button[onclick="openGenerateAutomaticReceiptModal('${orderId}')"]`)?.parentElement
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
      doc.text(`Recibo de Pedido ID: ${receipt.orderId}`, 100, 35, {
        align: "center",
      });
  
      doc.setFontSize(12);
      doc.text(`Fecha: ${receipt.date}`, 10, 55);
      doc.text(`Sucursal: ${receipt.sucursalName}`, 10, 65);
      doc.text(`Descripción: ${receipt.description}`, 10, 75);
  
      if (receipt.products && receipt.products.length > 0) {
        const tableColumn = ["Producto", "Cantidad Recibida", "Precio (Q)"];
        const tableRows = [];
        receipt.products.forEach((product) => {
          tableRows.push([
            product.name,
            product.receivedQuantity,
            product.price !== undefined ? `Q${product.price}` : "N/A"
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
      doc.text(`Total: Q${receipt.total}`, 140, finalY + 10);
  
      const safeSucursal = receipt.sucursalName.replace(/\s+/g, "_");
      const safeDescription = receipt.description.replace(/\s+/g, "_");
      const safeDate = receipt.date.replace(/\s+/g, "_");
  
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
  //           NUEVO: GENERAR / COMPARTIR IMAGEN DE LA RECEPCIÓN
  // ========================================================================
  async function shareReceptionImage(orderId) {
    try {
      // 1) Obtenemos el pedido para tener la info de la recepción
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
  
      // 2) Creamos un contenedor temporal con la info recibida
      const tempDiv = document.createElement("div");
      tempDiv.style.padding = "20px";
      tempDiv.style.backgroundColor = "#fff";
      tempDiv.innerHTML = `
        <h2>Recepción de Pedido</h2>
        <p><strong>ID Pedido:</strong> ${order.orderId}</p>
        <p><strong>Proveedor:</strong> ${order.providerName}</p>
        <p><strong>Sucursal:</strong> ${order.sucursalName}</p>
        <p><strong>Fecha:</strong> ${order.orderDate}</p>
        <table border="1" cellpadding="10" cellspacing="0">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th>Producto</th>
              <th>Presentación</th>
              <th>Cantidad Pedida</th>
              <th>Cantidad Recibida</th>
              <th>Comentarios</th>
            </tr>
          </thead>
          <tbody>
            ${
              order.receivedProducts && order.receivedProducts.length > 0
                ? order.receivedProducts.map(rp => `
                    <tr>
                      <td>${rp.name}</td>
                      <td>${rp.presentation}</td>
                      <td>${rp.quantity}</td>
                      <td>${rp.receivedQuantity}</td>
                      <td>${rp.comments || ''}</td>
                    </tr>
                  `).join("")
                : `<tr><td colspan="5">No se han registrado cantidades recibidas.</td></tr>`
            }
          </tbody>
        </table>
      `;
      document.body.appendChild(tempDiv);
  
      // 3) Generamos la imagen usando html2canvas
      const canvas = await html2canvas(tempDiv);
      const imageData = canvas.toDataURL("image/png");
  
      // 4) Eliminamos el DIV temporal
      document.body.removeChild(tempDiv);
  
      // 5) Ofrecemos compartir o descargar la imagen
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Recepción de Pedido",
            text: "Mira la recepción de este pedido.",
            files: [dataURLtoFile(imageData, `Recepcion_${order.orderId}.png`)]
          });
        } catch (err) {
          // Fallback: descargamos la imagen
          downloadImage(imageData, `Recepcion_${order.orderId}.png`);
        }
      } else {
        // Si no soporta share, descargamos la imagen
        downloadImage(imageData, `Recepcion_${order.orderId}.png`);
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error al generar/compartir imagen",
        text: error.message
      });
    }
  }
  
  // Función auxiliar para convertir base64 a File
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
  