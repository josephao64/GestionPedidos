/* inventario.js */

// Configuración de Firebase
var firebaseConfig = {
    apiKey: "AIzaSyBNalkMiZuqQ-APbvRQC2MmF_hACQR0F3M",
    authDomain: "logisticdb-2e63c.firebaseapp.com",
    projectId: "logisticdb-2e63c",
    storageBucket: "logisticdb-2e63c.appspot.com",
    messagingSenderId: "917523682093",
    appId: "1:917523682093:web:6b03fcce4dd509ecbe79a4"
  };
  firebase.initializeApp(firebaseConfig);
  var db = firebase.firestore();
  
  /* =========================
     FUNCIONES DE UTILIDAD
  ============================*/
  function closeModal(modalId) {
    var modalEl = document.getElementById(modalId);
    if (modalEl.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    var modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    } else {
      new bootstrap.Modal(modalEl).hide();
    }
  }
  
  function showSection(section) {
    document.getElementById("productsSection").style.display = "none";
    document.getElementById("movementsSection").style.display = "none";
    document.getElementById("adjustmentsSection").style.display = "none";
    document.getElementById("invoicesSection").style.display = "none";
    document.getElementById("reportsSection").style.display = "none";
  
    if (section === "products") {
      document.getElementById("productsSection").style.display = "block";
      loadProducts();
    } else if (section === "movements") {
      document.getElementById("movementsSection").style.display = "block";
      loadMovements();
    } else if (section === "adjustments") {
      document.getElementById("adjustmentsSection").style.display = "block";
    } else if (section === "invoices") {
      document.getElementById("invoicesSection").style.display = "block";
      loadInvoices();
    } else if (section === "reports") {
      document.getElementById("reportsSection").style.display = "block";
      populateReportProducts();
    }
  }
  
  /* =========================
     GESTIÓN DE PRODUCTOS
     (Se usa el campo numérico "idNum" para mostrar un ID entero)
  ============================*/
  function showAddProductForm() {
    document.getElementById("productModalLabel").textContent = "Agregar Producto";
    document.getElementById("productId").value = "";
    document.getElementById("productName").value = "";
    document.getElementById("productDescription").value = "";
    document.getElementById("productUnit").value = "";
    document.getElementById("productStock").value = "";
    document.getElementById("productStockMin").value = "";
  }
  
  async function saveProduct() {
    try {
      var id = document.getElementById("productId").value;
      var name = document.getElementById("productName").value;
      var description = document.getElementById("productDescription").value;
      var unit = document.getElementById("productUnit").value;
      var stock = parseInt(document.getElementById("productStock").value) || 0;
      var stockMin = parseInt(document.getElementById("productStockMin").value) || 0;
  
      if (!name) throw new Error("El nombre del producto es obligatorio.");
  
      // Si es nuevo, asignar un número entero único (ejemplo: Date.now())
      var idNum = id ? null : Date.now();
  
      var productData = {
        name: name,
        description: description,
        unit: unit,
        stock: stock,
        stockMin: stockMin
      };
  
      if (!id) {
        productData.idNum = idNum;
        await db.collection("inventoryProducts").add(productData);
      } else {
        await db.collection("inventoryProducts").doc(id).update(productData);
      }
  
      closeModal("productModal");
      loadProducts();
      populateProductSelects();
    } catch (error) {
      console.error("Error al guardar producto:", error);
      alert("Error al guardar producto: " + error.message);
    }
  }
  
  async function loadProducts() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let tbody = document.getElementById("productsTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
      snapshot.forEach(doc => {
        let product = doc.data();
        let row = tbody.insertRow();
        row.insertCell(0).textContent = product.idNum ? product.idNum : "-";
        row.insertCell(1).textContent = product.name;
        row.insertCell(2).textContent = product.unit;
        row.insertCell(3).textContent = product.stock;
        row.insertCell(4).textContent = product.stockMin;
        row.insertCell(5).innerHTML = `
          <button class="btn btn-sm btn-primary" onclick="editProduct('${doc.id}')">
            <i class="fa-solid fa-edit"></i> Editar
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct('${doc.id}')">
            <i class="fa-solid fa-trash"></i> Eliminar
          </button>`;
      });
    } catch (error) {
      console.error("Error al cargar productos:", error);
      alert("Error al cargar productos: " + error.message);
    }
  }
  
  function filterProducts() {
    var input = document.getElementById("productSearchInput");
    var filter = input.value.toUpperCase();
    var table = document.getElementById("productsTable");
    var tr = table.getElementsByTagName("tr");
    for (var i = 1; i < tr.length; i++) {
      let cells = tr[i].getElementsByTagName("td");
      if (cells.length > 0) {
        let text = cells[0].textContent + " " + cells[1].textContent;
        tr[i].style.display = text.toUpperCase().indexOf(filter) > -1 ? "" : "none";
      }
    }
  }
  
  async function editProduct(id) {
    try {
      let doc = await db.collection("inventoryProducts").doc(id).get();
      if (doc.exists) {
        let product = doc.data();
        document.getElementById("productModalLabel").textContent = "Editar Producto";
        document.getElementById("productId").value = id;
        document.getElementById("productName").value = product.name;
        document.getElementById("productDescription").value = product.description;
        document.getElementById("productUnit").value = product.unit;
        document.getElementById("productStock").value = product.stock;
        document.getElementById("productStockMin").value = product.stockMin;
      } else {
        alert("Producto no encontrado.");
      }
    } catch (error) {
      console.error("Error al cargar producto:", error);
      alert("Error al cargar producto: " + error.message);
    }
  }
  
  async function deleteProduct(id) {
    if (confirm("¿Estás seguro de eliminar este producto?")) {
      try {
        await db.collection("inventoryProducts").doc(id).delete();
        loadProducts();
        populateProductSelects();
      } catch (error) {
        console.error("Error al eliminar producto:", error);
        alert("Error al eliminar producto: " + error.message);
      }
    }
  }
  
  async function populateProductSelects() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let movementSelect = document.getElementById("movementProductSelect");
      let adjustmentSelect = document.getElementById("adjustmentProductSelect");
      let reportSelect = document.getElementById("reportProduct");
      if (movementSelect) movementSelect.innerHTML = "";
      if (adjustmentSelect) adjustmentSelect.innerHTML = "";
      if (reportSelect) reportSelect.innerHTML = "";
      snapshot.forEach(doc => {
        let option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.data().name;
        if (movementSelect) movementSelect.appendChild(option);
        if (adjustmentSelect) adjustmentSelect.appendChild(option.cloneNode(true));
        if (reportSelect) reportSelect.appendChild(option.cloneNode(true));
      });
    } catch (error) {
      console.error("Error al cargar productos para selects:", error);
    }
  }
  
  /* =========================
     MOVIMIENTOS
  ============================*/
  function showAddMovementForm() {
    document.getElementById("movementId").value = "";
    populateProductSelects();
    document.getElementById("movementQuantity").value = "";
    document.getElementById("movementUser").value = "";
    document.getElementById("movementReason").value = "";
    document.getElementById("movementComments").value = "";
    document.getElementById("movementModalLabel").textContent = "Registrar Movimiento";
  }
  
  async function saveMovement() {
    try {
      let movementId = document.getElementById("movementId").value;
      let productId = document.getElementById("movementProductSelect").value;
      let type = document.getElementById("movementType").value;
      let quantity = parseFloat(document.getElementById("movementQuantity").value);
      let user = document.getElementById("movementUser").value;
      let reason = document.getElementById("movementReason").value;
      let comments = document.getElementById("movementComments").value;
  
      if (isNaN(quantity) || quantity <= 0)
        throw new Error("La cantidad debe ser un número positivo.");
  
      let productRef = db.collection("inventoryProducts").doc(productId);
      let productDoc = await productRef.get();
      let product = productDoc.exists ? productDoc.data() : null;
  
      if (movementId) {
        // Edición: revertir efecto del movimiento anterior y aplicar el nuevo
        let oldMovementDoc = await db.collection("inventoryMovements").doc(movementId).get();
        if (!oldMovementDoc.exists) throw new Error("Movimiento no encontrado");
        let oldMovement = oldMovementDoc.data();
        let oldEffect = (oldMovement.type === "entrada" || oldMovement.type === "ajuste") ? oldMovement.quantity : -oldMovement.quantity;
        let newEffect = (type === "entrada" || type === "ajuste") ? quantity : -quantity;
        let diff = newEffect - oldEffect;
        if (product) {
          let newStock = product.stock + diff;
          if (newStock < 0) throw new Error("No hay suficiente stock para la actualización.");
          await productRef.update({ stock: newStock });
        }
        await db.collection("inventoryMovements").doc(movementId).update({
          type: type,
          quantity: quantity,
          date: firebase.firestore.FieldValue.serverTimestamp(),
          user: user,
          reason: reason,
          comments: comments
        });
      } else {
        // Nuevo movimiento
        if (product) {
          let newStock = product.stock;
          if (type === "entrada" || type === "ajuste") {
            newStock += quantity;
          } else if (type === "salida") {
            newStock -= quantity;
            if (newStock < 0) throw new Error("No hay suficiente stock para realizar esta salida.");
          }
          await productRef.update({ stock: newStock });
        }
        await db.collection("inventoryMovements").add({
          productId: productId,
          type: type,
          quantity: quantity,
          date: firebase.firestore.FieldValue.serverTimestamp(),
          user: user,
          reason: reason,
          comments: comments
        });
      }
      closeModal("movementModal");
      loadProducts();
      loadMovements();
    } catch (error) {
      console.error("Error al registrar/actualizar movimiento:", error);
      alert("Error al registrar/actualizar movimiento: " + error.message);
    }
  }
  
  async function loadMovements() {
    try {
      let snapshot = await db.collection("inventoryMovements").orderBy("date", "desc").get();
      let tbody = document.getElementById("movementsTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
      for (let doc of snapshot.docs) {
        let m = doc.data();
        let productDoc = await db.collection("inventoryProducts").doc(m.productId).get();
        let productName = productDoc.exists ? productDoc.data().name : "Producto no encontrado";
        let row = tbody.insertRow();
        row.insertCell(0).textContent = productName;
        row.insertCell(1).textContent = m.type;
        row.insertCell(2).textContent = m.quantity;
        let dateStr = m.date ? m.date.toDate().toLocaleString() : "";
        row.insertCell(3).textContent = dateStr;
        row.insertCell(4).textContent = m.user;
        row.insertCell(5).textContent = m.reason;
        row.insertCell(6).textContent = m.comments;
        row.insertCell(7).innerHTML = `
          <button class="btn btn-sm btn-primary" onclick="editMovement('${doc.id}')">
            <i class="fa-solid fa-edit"></i> Editar
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteMovement('${doc.id}')">
            <i class="fa-solid fa-trash"></i> Eliminar
          </button>`;
      }
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
      alert("Error al cargar movimientos: " + error.message);
    }
  }
  
  async function editMovement(movementId) {
    try {
      let doc = await db.collection("inventoryMovements").doc(movementId).get();
      if (doc.exists) {
        let m = doc.data();
        document.getElementById("movementId").value = movementId;
        document.getElementById("movementProductSelect").value = m.productId;
        document.getElementById("movementType").value = m.type;
        document.getElementById("movementQuantity").value = m.quantity;
        document.getElementById("movementUser").value = m.user;
        document.getElementById("movementReason").value = m.reason;
        document.getElementById("movementComments").value = m.comments;
        document.getElementById("movementModalLabel").textContent = "Editar Movimiento";
        new bootstrap.Modal(document.getElementById("movementModal")).show();
      } else {
        alert("Movimiento no encontrado.");
      }
    } catch (error) {
      console.error("Error al cargar movimiento:", error);
      alert("Error al cargar movimiento: " + error.message);
    }
  }
  
  async function deleteMovement(movementId) {
    if (!confirm("¿Estás seguro de eliminar este movimiento?")) return;
    try {
      let doc = await db.collection("inventoryMovements").doc(movementId).get();
      if (!doc.exists) throw new Error("Movimiento no encontrado");
      let m = doc.data();
      let effect = (m.type === "entrada" || m.type === "ajuste") ? m.quantity : -m.quantity;
      let productRef = db.collection("inventoryProducts").doc(m.productId);
      let productDoc = await productRef.get();
      if (productDoc.exists) {
        let product = productDoc.data();
        let newStock = product.stock - effect;
        await productRef.update({ stock: newStock });
      }
      await db.collection("inventoryMovements").doc(movementId).delete();
      loadMovements();
      loadProducts();
    } catch (error) {
      console.error("Error al eliminar movimiento:", error);
      alert("Error al eliminar movimiento: " + error.message);
    }
  }
  
  /* =========================
     REAJUSTES
  ============================*/
  function showAdjustmentModal() {
    populateProductSelects();
    document.getElementById("adjustmentQuantity").value = "";
    document.getElementById("adjustmentUser").value = "";
    document.getElementById("adjustmentReason").value = "";
    new bootstrap.Modal(document.getElementById("adjustmentModal")).show();
  }
  
  async function saveAdjustment() {
    try {
      let productId = document.getElementById("adjustmentProductSelect").value;
      let adjustment = parseFloat(document.getElementById("adjustmentQuantity").value);
      let user = document.getElementById("adjustmentUser").value;
      let reason = document.getElementById("adjustmentReason").value;
  
      if (isNaN(adjustment))
        throw new Error("La cantidad de ajuste debe ser un número.");
  
      let productRef = db.collection("inventoryProducts").doc(productId);
      let productDoc = await productRef.get();
      if (!productDoc.exists) throw new Error("Producto no encontrado");
      let product = productDoc.data();
      let newStock = product.stock + adjustment;
      await productRef.update({ stock: newStock });
  
      await db.collection("inventoryMovements").add({
        productId: productId,
        type: "ajuste",
        quantity: adjustment,
        date: firebase.firestore.FieldValue.serverTimestamp(),
        user: user,
        reason: reason,
        comments: "Ajuste de inventario"
      });
  
      closeModal("adjustmentModal");
      loadProducts();
      loadMovements();
    } catch (error) {
      console.error("Error al realizar reajuste:", error);
      alert("Error al realizar reajuste: " + error.message);
    }
  }
  
  /* =========================
     IMPORTAR PRODUCTOS DESDE CATÁLOGO
  ============================*/
  async function showCatalogModal() {
    try {
      let snapshot = await db.collection("products").get();
      let tbody = document.getElementById("catalogProductsTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
      snapshot.forEach(doc => {
        let product = doc.data();
        let row = tbody.insertRow();
        row.insertCell(0).textContent = product.idNum ? product.idNum : doc.id;
        row.insertCell(1).textContent = product.name;
        row.insertCell(2).innerHTML = `<button class="btn btn-sm btn-primary" onclick="importProduct('${doc.id}')">Importar</button>`;
      });
      new bootstrap.Modal(document.getElementById("catalogModal")).show();
    } catch (error) {
      console.error("Error al cargar catálogo de productos:", error);
      alert("Error al cargar catálogo: " + error.message);
    }
  }
  
  function filterCatalogProducts() {
    var input = document.getElementById("catalogSearchInput");
    var filter = input.value.toUpperCase();
    var table = document.getElementById("catalogProductsTable");
    var tr = table.getElementsByTagName("tr");
    for (var i = 1; i < tr.length; i++) {
      let td = tr[i].getElementsByTagName("td")[1];
      if (td) {
        let txtValue = td.textContent || td.innerText;
        tr[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
      }
    }
  }
  
  async function importProduct(productId) {
    try {
      let doc = await db.collection("products").doc(productId).get();
      if (!doc.exists) throw new Error("Producto no encontrado en el catálogo.");
      let prod = doc.data();
  
      let invQuery = await db.collection("inventoryProducts").where("productRef", "==", productId).get();
      if (!invQuery.empty) {
        alert("El producto ya está cargado en el inventario.");
        return;
      }
  
      let newProduct = {
        name: prod.name,
        description: prod.description || "",
        unit: prod.presentation || "",
        stock: 0,
        stockMin: 0,
        idNum: prod.idNum ? prod.idNum : Date.now(),
        productRef: productId
      };
  
      await db.collection("inventoryProducts").add(newProduct);
      alert("Producto importado exitosamente.");
      closeModal("catalogModal");
      loadProducts();
      populateProductSelects();
    } catch (error) {
      console.error("Error al importar producto:", error);
      alert("Error al importar producto: " + error.message);
    }
  }
  
  /* =========================
     FACTURAS Y PROVEEDORES
  ============================*/
  // Cargar proveedores desde la colección "providers"
  async function populateProviders() {
    try {
      let snapshot = await db.collection("providers").get();
      let supplierSelect = document.getElementById("invoiceSupplier");
      if (supplierSelect) {
        supplierSelect.innerHTML = "";
        snapshot.forEach(doc => {
          let option = document.createElement("option");
          option.value = doc.data().name;
          option.textContent = doc.data().name;
          supplierSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
    }
  }
  
  // Cargar productos para el select de factura
  async function populateInvoiceProductSelect() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let invoiceSelect = document.getElementById("invoiceProductSelect");
      if (invoiceSelect) {
        invoiceSelect.innerHTML = "";
        snapshot.forEach(doc => {
          let option = document.createElement("option");
          option.value = doc.id;
          option.textContent = doc.data().name;
          invoiceSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Error al cargar productos para facturas:", error);
    }
  }
  
  function showAddInvoiceForm() {
    document.getElementById("invoiceNumber").value = "";
    document.getElementById("invoiceDate").value = "";
    populateProviders();
    populateInvoiceProductSelect();
    document.getElementById("invoiceQuantity").value = "";
    document.getElementById("invoiceUnitPrice").value = "";
    document.getElementById("invoiceTotal").value = "";
    new bootstrap.Modal(document.getElementById("invoiceModal")).show();
  }
  
  // Actualiza el total (cantidad × precio)
  function updateInvoiceTotal() {
    let qty = parseFloat(document.getElementById("invoiceQuantity").value) || 0;
    let price = parseFloat(document.getElementById("invoiceUnitPrice").value) || 0;
    document.getElementById("invoiceTotal").value = (qty * price).toFixed(2);
  }
  
  async function saveInvoice() {
    try {
      let invoiceNumber = document.getElementById("invoiceNumber").value;
      let invoiceDate = document.getElementById("invoiceDate").value;
      let invoiceSupplier = document.getElementById("invoiceSupplier").value;
      let invoiceProductId = document.getElementById("invoiceProductSelect").value;
      let invoiceQuantity = parseFloat(document.getElementById("invoiceQuantity").value);
      let invoiceUnitPrice = parseFloat(document.getElementById("invoiceUnitPrice").value);
      let invoiceTotal = parseFloat(document.getElementById("invoiceTotal").value);
  
      if (!invoiceNumber || !invoiceDate || !invoiceSupplier || !invoiceProductId ||
          isNaN(invoiceQuantity) || invoiceQuantity <= 0 ||
          isNaN(invoiceUnitPrice) || invoiceUnitPrice <= 0) {
        throw new Error("Todos los campos son obligatorios y deben ser números positivos.");
      }
  
      // Verificar si ya existe una factura con el mismo número
      let duplicateQuery = await db.collection("invoices").where("invoiceNum", "==", invoiceNumber).get();
      if (!duplicateQuery.empty) {
        throw new Error("La factura con este número ya existe.");
      }
  
      // Para evitar el problema de la fecha, se parsea manualmente la cadena "YYYY-MM-DD"
      let parts = invoiceDate.split("-");
      let localInvoiceDate = new Date(parts[0], parts[1] - 1, parts[2]);
  
      let invoiceData = {
        invoiceNum: invoiceNumber,
        date: localInvoiceDate,
        supplier: invoiceSupplier,
        productId: invoiceProductId,
        quantity: invoiceQuantity,
        unitPrice: invoiceUnitPrice,
        total: invoiceTotal
      };
      await db.collection("invoices").add(invoiceData);
  
      // Actualizar el stock del producto (factura como entrada)
      let productRef = db.collection("inventoryProducts").doc(invoiceProductId);
      let productDoc = await productRef.get();
      if (!productDoc.exists) throw new Error("Producto no encontrado.");
      let product = productDoc.data();
      let newStock = product.stock + invoiceQuantity;
      await productRef.update({ stock: newStock });
  
      // Registrar movimiento de entrada por factura
      await db.collection("inventoryMovements").add({
        productId: invoiceProductId,
        type: "entrada",
        quantity: invoiceQuantity,
        date: firebase.firestore.FieldValue.serverTimestamp(),
        user: "Factura",
        reason: "Factura de proveedor: " + invoiceSupplier,
        comments: "Factura ingresada el " + invoiceDate
      });
  
      alert("Factura agregada y entrada de producto registrada.");
      closeModal("invoiceModal");
      loadProducts();
      loadMovements();
      loadInvoices();
      populateProductSelects();
    } catch (error) {
      console.error("Error al guardar factura:", error);
      alert("Error al guardar factura: " + error.message);
    }
  }
  
  async function loadInvoices() {
    try {
      let snapshot = await db.collection("invoices").orderBy("date", "desc").get();
      let tbody = document.getElementById("invoicesTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
      snapshot.forEach(async doc => {
        let inv = doc.data();
        let row = tbody.insertRow();
        row.insertCell(0).textContent = inv.invoiceNum ? inv.invoiceNum : "-";
        row.insertCell(1).textContent = inv.date ? new Date(inv.date.seconds * 1000).toLocaleDateString() : "";
        row.insertCell(2).textContent = inv.supplier;
        let productDoc = await db.collection("inventoryProducts").doc(inv.productId).get();
        let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
        row.insertCell(3).textContent = productName;
        row.insertCell(4).textContent = inv.quantity;
        row.insertCell(5).textContent = "Q." + inv.unitPrice;
        row.insertCell(6).textContent = "Q." + inv.total;
        row.insertCell(7).innerHTML = `
          <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${doc.id}')">
            <i class="fa-solid fa-trash"></i> Eliminar
          </button>
          <button class="btn btn-sm btn-secondary" onclick="exportInvoiceImage('${doc.id}')">
            <i class="fa-solid fa-file-export"></i> Exportar
          </button>`;
      });
    } catch (error) {
      console.error("Error al cargar facturas:", error);
      alert("Error al cargar facturas: " + error.message);
    }
  }
  
  async function deleteInvoice(invoiceId) {
    if (!confirm("¿Estás seguro de eliminar esta factura?")) return;
    try {
      let invDoc = await db.collection("invoices").doc(invoiceId).get();
      if (!invDoc.exists) throw new Error("Factura no encontrada");
      let inv = invDoc.data();
      let productRef = db.collection("inventoryProducts").doc(inv.productId);
      let productDoc = await productRef.get();
      if (!productDoc.exists) throw new Error("Producto no encontrado");
      let product = productDoc.data();
      let newStock = product.stock - inv.quantity;
      await productRef.update({ stock: newStock });
      await db.collection("invoices").doc(invoiceId).delete();
      loadInvoices();
      loadProducts();
    } catch (error) {
      console.error("Error al eliminar factura:", error);
      alert("Error al eliminar factura: " + error.message);
    }
  }
  
  /* =========================
     EXPORTAR FACTURA COMO IMAGEN CON DISEÑO REAL
     (Se muestra el símbolo "Q." para precios)
  ============================*/
  async function exportInvoiceImage(invoiceId) {
    try {
      let invDoc = await db.collection("invoices").doc(invoiceId).get();
      if (!invDoc.exists) throw new Error("Factura no encontrada");
      let inv = invDoc.data();
      let productDoc = await db.collection("inventoryProducts").doc(inv.productId).get();
      let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
      
      // Llenar el contenedor de factura con datos y diseño real
      document.getElementById("exportInvoiceNum").textContent = inv.invoiceNum ? inv.invoiceNum : "-";
      document.getElementById("exportInvoiceDate").textContent = inv.date ? new Date(inv.date.seconds * 1000).toLocaleDateString() : "";
      document.getElementById("exportInvoiceSupplier").textContent = inv.supplier;
      document.getElementById("exportInvoiceProduct").textContent = productName;
      document.getElementById("exportInvoiceQuantity").textContent = inv.quantity;
      document.getElementById("exportInvoiceUnitPrice").textContent = inv.unitPrice;
      document.getElementById("exportInvoiceTotal").textContent = inv.total;
      
      let exportContainer = document.getElementById("exportInvoiceContainer");
      exportContainer.style.display = "block";
      
      html2canvas(exportContainer).then(canvas => {
        let link = document.createElement("a");
        let now = new Date();
        let fileName = "Factura_" + now.toISOString().slice(0,10) + ".png";
        link.download = fileName;
        link.href = canvas.toDataURL("image/png");
        link.click();
        exportContainer.style.display = "none";
      });
    } catch (error) {
      console.error("Error al exportar factura:", error);
      alert("Error al exportar factura: " + error.message);
    }
  }
  
  /* =========================
     EXPORTAR FACTURAS REGISTRADAS COMO IMAGEN
  ============================*/
  async function exportInvoicesImage() {
    try {
      // Obtener todas las facturas y llenar el contenedor oculto
      let snapshot = await db.collection("invoices").orderBy("date", "desc").get();
      let tbody = document.getElementById("exportInvoicesBody");
      tbody.innerHTML = "";
      for (let doc of snapshot.docs) {
        let inv = doc.data();
        let productDoc = await db.collection("inventoryProducts").doc(inv.productId).get();
        let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
        let row = document.createElement("tr");
        let cellNum = document.createElement("td");
        cellNum.textContent = inv.invoiceNum ? inv.invoiceNum : "-";
        let cellDate = document.createElement("td");
        cellDate.textContent = inv.date ? new Date(inv.date.seconds * 1000).toLocaleDateString() : "";
        let cellSupplier = document.createElement("td");
        cellSupplier.textContent = inv.supplier;
        let cellProduct = document.createElement("td");
        cellProduct.textContent = productName;
        let cellQty = document.createElement("td");
        cellQty.textContent = inv.quantity;
        let cellUnit = document.createElement("td");
        cellUnit.textContent = "Q." + inv.unitPrice;
        let cellTotal = document.createElement("td");
        cellTotal.textContent = "Q." + inv.total;
        row.appendChild(cellNum);
        row.appendChild(cellDate);
        row.appendChild(cellSupplier);
        row.appendChild(cellProduct);
        row.appendChild(cellQty);
        row.appendChild(cellUnit);
        row.appendChild(cellTotal);
        tbody.appendChild(row);
      }
      let exportContainer = document.getElementById("exportInvoicesContainer");
      exportContainer.style.display = "block";
      html2canvas(exportContainer).then(canvas => {
        let link = document.createElement("a");
        let now = new Date();
        let fileName = "Facturas_" + now.toISOString().slice(0,10) + ".png";
        link.download = fileName;
        link.href = canvas.toDataURL("image/png");
        link.click();
        exportContainer.style.display = "none";
      });
    } catch (error) {
      console.error("Error al exportar facturas:", error);
      alert("Error al exportar facturas: " + error.message);
    }
  }
  
  /* =========================
     REPORTE DE PRODUCTO
  ============================*/
  function populateReportProducts() {
    db.collection("inventoryProducts").get().then(snapshot => {
      let select = document.getElementById("reportProduct");
      select.innerHTML = "";
      snapshot.forEach(doc => {
        let option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.data().name;
        select.appendChild(option);
      });
    });
  }
  
  async function generateProductReport() {
    try {
      let productId = document.getElementById("reportProduct").value;
      let startDateInput = document.getElementById("reportStartDate").value;
      let endDateInput = document.getElementById("reportEndDate").value;
      if (!startDateInput || !endDateInput) {
        alert("Por favor, seleccione ambas fechas.");
        return;
      }
      let startDate = new Date(startDateInput);
      let endDate = new Date(endDateInput);
      endDate.setHours(23, 59, 59, 999);
  
      let productDoc = await db.collection("inventoryProducts").doc(productId).get();
      if (!productDoc.exists) {
        alert("Producto no encontrado.");
        return;
      }
      let product = productDoc.data();
      let currentStock = product.stock;
  
      let sumAfterStart = 0;
      let snapshotAfterStart = await db.collection("inventoryMovements")
        .where("productId", "==", productId)
        .where("date", ">", startDate)
        .get();
      snapshotAfterStart.forEach(doc => {
        let m = doc.data();
        if (m.type === "entrada" || m.type === "ajuste") {
          sumAfterStart += m.quantity;
        } else if (m.type === "salida") {
          sumAfterStart -= m.quantity;
        }
      });
      let initialStock = currentStock - sumAfterStart;
  
      document.getElementById("reportTitle").textContent = "Reporte de " + product.name;
      document.getElementById("reportProductInfo").textContent =
        "Producto: " + product.name + " | Stock Actual: " + currentStock;
      document.getElementById("reportDateRange").textContent =
        "Período: " + startDateInput + " - " + endDateInput;
  
      let query = db.collection("inventoryMovements")
        .where("productId", "==", productId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .orderBy("date", "asc");
      let snapshotPeriod = await query.get();
  
      let runningStock = initialStock;
      let tbody = document.querySelector("#reportTable tbody");
      tbody.innerHTML = "";
      let chartData = { labels: [], data: [] };
  
      snapshotPeriod.forEach(doc => {
        let m = doc.data();
        if (m.type === "entrada" || m.type === "ajuste") {
          runningStock += m.quantity;
        } else if (m.type === "salida") {
          runningStock -= m.quantity;
        }
        let row = tbody.insertRow();
        row.insertCell(0).textContent = m.type;
        row.insertCell(1).textContent = m.quantity;
        row.insertCell(2).textContent = runningStock;
        let dateStr = m.date ? m.date.toDate().toLocaleString() : "";
        row.insertCell(3).textContent = dateStr;
        row.insertCell(4).textContent = m.user;
        row.insertCell(5).textContent = m.reason;
        row.insertCell(6).textContent = m.comments;
        chartData.labels.push(m.date ? m.date.toDate().toLocaleDateString() : "");
        chartData.data.push(runningStock);
      });
  
      if (snapshotPeriod.empty) {
        alert("No se encontraron movimientos para este producto en el rango de fechas seleccionado.");
      }
  
      let ctx = document.getElementById("reportChart").getContext("2d");
      if (window.reportChart && typeof window.reportChart.destroy === "function") {
        window.reportChart.destroy();
      }
      window.reportChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: chartData.labels,
          datasets: [{
            label: "Stock",
            data: chartData.data,
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            fill: true
          }]
        },
        options: { responsive: true }
      });
    } catch (error) {
      console.error("Error al generar reporte de producto:", error);
      alert("Error al generar reporte: " + error.message);
    }
  }
  
  function exportReportCSV() {
    var csv = [];
    var rows = document.querySelectorAll("#reportTable tr");
    for (var i = 0; i < rows.length; i++) {
      var row = [], cols = rows[i].querySelectorAll("td, th");
      for (var j = 0; j < cols.length; j++) {
        row.push('"' + cols[j].innerText + '"');
      }
      csv.push(row.join(","));
    }
    var csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
    var downloadLink = document.createElement("a");
    downloadLink.download = "reporte_producto.csv";
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
  
  function exportReportImage() {
    html2canvas(document.getElementById("reportModal")).then(canvas => {
      let link = document.createElement("a");
      link.download = "reporte_producto.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  }
  
  /* =========================
     EXPORTAR STOCK (PRODUCTOS)
  ============================*/
  async function exportProductsStockImage() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let tbody = document.getElementById("exportProductsBody");
      tbody.innerHTML = "";
      snapshot.forEach(doc => {
        let product = doc.data();
        let row = document.createElement("tr");
        let cellName = document.createElement("td");
        cellName.textContent = product.name;
        let cellStock = document.createElement("td");
        cellStock.textContent = product.stock;
        row.appendChild(cellName);
        row.appendChild(cellStock);
        tbody.appendChild(row);
      });
      let now = new Date();
      document.getElementById("exportHeader").textContent = "REPORTE STOCK DE BODEGA - " + now.toLocaleDateString();
      let exportContainer = document.getElementById("exportProductsContainer");
      exportContainer.style.display = "block";
      html2canvas(exportContainer).then(canvas => {
        let link = document.createElement("a");
        let fileName = "Stock_" + now.toISOString().slice(0,10) + ".png";
        link.download = fileName;
        link.href = canvas.toDataURL("image/png");
        link.click();
        exportContainer.style.display = "none";
      });
    } catch (error) {
      console.error("Error al exportar stock de productos:", error);
      alert("Error al exportar stock: " + error.message);
    }
  }
  
  /* =========================
     EXPORTAR FACTURA COMO IMAGEN CON DISEÑO REAL
     (Se muestra el símbolo "Q." para precios)
  ============================*/
  async function exportInvoiceImage(invoiceId) {
    try {
      let invDoc = await db.collection("invoices").doc(invoiceId).get();
      if (!invDoc.exists) throw new Error("Factura no encontrada");
      let inv = invDoc.data();
      let productDoc = await db.collection("inventoryProducts").doc(inv.productId).get();
      let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
      
      // Llenar el contenedor de factura con datos y diseño real
      document.getElementById("exportInvoiceNum").textContent = inv.invoiceNum ? inv.invoiceNum : "-";
      document.getElementById("exportInvoiceDate").textContent = inv.date ? new Date(inv.date.seconds * 1000).toLocaleDateString() : "";
      document.getElementById("exportInvoiceSupplier").textContent = inv.supplier;
      document.getElementById("exportInvoiceProduct").textContent = productName;
      document.getElementById("exportInvoiceQuantity").textContent = inv.quantity;
      document.getElementById("exportInvoiceUnitPrice").textContent = inv.unitPrice;
      document.getElementById("exportInvoiceTotal").textContent = inv.total;
      
      let exportContainer = document.getElementById("exportInvoiceContainer");
      exportContainer.style.display = "block";
      
      html2canvas(exportContainer).then(canvas => {
        let link = document.createElement("a");
        let now = new Date();
        let fileName = "Factura_" + now.toISOString().slice(0,10) + ".png";
        link.download = fileName;
        link.href = canvas.toDataURL("image/png");
        link.click();
        exportContainer.style.display = "none";
      });
    } catch (error) {
      console.error("Error al exportar factura:", error);
      alert("Error al exportar factura: " + error.message);
    }
  }
  
  /* =========================
     EXPORTAR FACTURAS REGISTRADAS COMO IMAGEN
  ============================*/
  async function exportInvoicesImage() {
    try {
      // Consultar todas las facturas registradas
      let snapshot = await db.collection("invoices").orderBy("date", "desc").get();
      let tbody = document.getElementById("exportInvoicesBody");
      tbody.innerHTML = "";
      for (let doc of snapshot.docs) {
        let inv = doc.data();
        let productDoc = await db.collection("inventoryProducts").doc(inv.productId).get();
        let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
        let row = document.createElement("tr");
        let cellNum = document.createElement("td");
        cellNum.textContent = inv.invoiceNum ? inv.invoiceNum : "-";
        let cellDate = document.createElement("td");
        cellDate.textContent = inv.date ? new Date(inv.date.seconds * 1000).toLocaleDateString() : "";
        let cellSupplier = document.createElement("td");
        cellSupplier.textContent = inv.supplier;
        let cellProduct = document.createElement("td");
        cellProduct.textContent = productName;
        let cellQty = document.createElement("td");
        cellQty.textContent = inv.quantity;
        let cellUnit = document.createElement("td");
        cellUnit.textContent = "Q." + inv.unitPrice;
        let cellTotal = document.createElement("td");
        cellTotal.textContent = "Q." + inv.total;
        row.appendChild(cellNum);
        row.appendChild(cellDate);
        row.appendChild(cellSupplier);
        row.appendChild(cellProduct);
        row.appendChild(cellQty);
        row.appendChild(cellUnit);
        row.appendChild(cellTotal);
        tbody.appendChild(row);
      }
      let exportContainer = document.getElementById("exportInvoicesContainer");
      exportContainer.style.display = "block";
      html2canvas(exportContainer).then(canvas => {
        let link = document.createElement("a");
        let now = new Date();
        let fileName = "Facturas_" + now.toISOString().slice(0,10) + ".png";
        link.download = fileName;
        link.href = canvas.toDataURL("image/png");
        link.click();
        exportContainer.style.display = "none";
      });
    } catch (error) {
      console.error("Error al exportar facturas:", error);
      alert("Error al exportar facturas: " + error.message);
    }
  }
  
  /* =========================
     REPORTE DE PRODUCTO
  ============================*/
  function populateReportProducts() {
    db.collection("inventoryProducts").get().then(snapshot => {
      let select = document.getElementById("reportProduct");
      select.innerHTML = "";
      snapshot.forEach(doc => {
        let option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.data().name;
        select.appendChild(option);
      });
    });
  }
  
  async function generateProductReport() {
    try {
      let productId = document.getElementById("reportProduct").value;
      let startDateInput = document.getElementById("reportStartDate").value;
      let endDateInput = document.getElementById("reportEndDate").value;
      if (!startDateInput || !endDateInput) {
        alert("Por favor, seleccione ambas fechas.");
        return;
      }
      let startDate = new Date(startDateInput);
      let endDate = new Date(endDateInput);
      endDate.setHours(23, 59, 59, 999);
  
      let productDoc = await db.collection("inventoryProducts").doc(productId).get();
      if (!productDoc.exists) {
        alert("Producto no encontrado.");
        return;
      }
      let product = productDoc.data();
      let currentStock = product.stock;
  
      let sumAfterStart = 0;
      let snapshotAfterStart = await db.collection("inventoryMovements")
        .where("productId", "==", productId)
        .where("date", ">", startDate)
        .get();
      snapshotAfterStart.forEach(doc => {
        let m = doc.data();
        if (m.type === "entrada" || m.type === "ajuste") {
          sumAfterStart += m.quantity;
        } else if (m.type === "salida") {
          sumAfterStart -= m.quantity;
        }
      });
      let initialStock = currentStock - sumAfterStart;
  
      document.getElementById("reportTitle").textContent = "Reporte de " + product.name;
      document.getElementById("reportProductInfo").textContent =
        "Producto: " + product.name + " | Stock Actual: " + currentStock;
      document.getElementById("reportDateRange").textContent =
        "Período: " + startDateInput + " - " + endDateInput;
  
      let query = db.collection("inventoryMovements")
        .where("productId", "==", productId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .orderBy("date", "asc");
      let snapshotPeriod = await query.get();
  
      let runningStock = initialStock;
      let tbody = document.querySelector("#reportTable tbody");
      tbody.innerHTML = "";
      let chartData = { labels: [], data: [] };
  
      snapshotPeriod.forEach(doc => {
        let m = doc.data();
        if (m.type === "entrada" || m.type === "ajuste") {
          runningStock += m.quantity;
        } else if (m.type === "salida") {
          runningStock -= m.quantity;
        }
        let row = tbody.insertRow();
        row.insertCell(0).textContent = m.type;
        row.insertCell(1).textContent = m.quantity;
        row.insertCell(2).textContent = runningStock;
        let dateStr = m.date ? m.date.toDate().toLocaleString() : "";
        row.insertCell(3).textContent = dateStr;
        row.insertCell(4).textContent = m.user;
        row.insertCell(5).textContent = m.reason;
        row.insertCell(6).textContent = m.comments;
        chartData.labels.push(m.date ? m.date.toDate().toLocaleDateString() : "");
        chartData.data.push(runningStock);
      });
  
      if (snapshotPeriod.empty) {
        alert("No se encontraron movimientos para este producto en el rango de fechas seleccionado.");
      }
  
      let ctx = document.getElementById("reportChart").getContext("2d");
      if (window.reportChart && typeof window.reportChart.destroy === "function") {
        window.reportChart.destroy();
      }
      window.reportChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: chartData.labels,
          datasets: [{
            label: "Stock",
            data: chartData.data,
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            fill: true
          }]
        },
        options: { responsive: true }
      });
    } catch (error) {
      console.error("Error al generar reporte de producto:", error);
      alert("Error al generar reporte: " + error.message);
    }
  }
  
  function exportReportCSV() {
    var csv = [];
    var rows = document.querySelectorAll("#reportTable tr");
    for (var i = 0; i < rows.length; i++) {
      var row = [], cols = rows[i].querySelectorAll("td, th");
      for (var j = 0; j < cols.length; j++) {
        row.push('"' + cols[j].innerText + '"');
      }
      csv.push(row.join(","));
    }
    var csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
    var downloadLink = document.createElement("a");
    downloadLink.download = "reporte_producto.csv";
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
  
  function exportReportImage() {
    html2canvas(document.getElementById("reportModal")).then(canvas => {
      let link = document.createElement("a");
      link.download = "reporte_producto.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  }
  
  /* =========================
     EXPORTAR STOCK (PRODUCTOS)
  ============================*/
  async function exportProductsStockImage() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let tbody = document.getElementById("exportProductsBody");
      tbody.innerHTML = "";
      snapshot.forEach(doc => {
        let product = doc.data();
        let row = document.createElement("tr");
        let cellName = document.createElement("td");
        cellName.textContent = product.name;
        let cellStock = document.createElement("td");
        cellStock.textContent = product.stock;
        row.appendChild(cellName);
        row.appendChild(cellStock);
        tbody.appendChild(row);
      });
      let now = new Date();
      document.getElementById("exportHeader").textContent = "REPORTE STOCK DE BODEGA - " + now.toLocaleDateString();
      let exportContainer = document.getElementById("exportProductsContainer");
      exportContainer.style.display = "block";
      html2canvas(exportContainer).then(canvas => {
        let link = document.createElement("a");
        let fileName = "Stock_" + now.toISOString().slice(0,10) + ".png";
        link.download = fileName;
        link.href = canvas.toDataURL("image/png");
        link.click();
        exportContainer.style.display = "none";
      });
    } catch (error) {
      console.error("Error al exportar stock de productos:", error);
      alert("Error al exportar stock: " + error.message);
    }
  }
  
  /* =========================
     EXPORTAR FACTURA COMO IMAGEN CON DISEÑO REAL
     (Se muestra el símbolo "Q." para precios)
  ============================*/
  async function exportInvoiceImage(invoiceId) {
    try {
      let invDoc = await db.collection("invoices").doc(invoiceId).get();
      if (!invDoc.exists) throw new Error("Factura no encontrada");
      let inv = invDoc.data();
      let productDoc = await db.collection("inventoryProducts").doc(inv.productId).get();
      let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
      
      // Llenar el contenedor de factura con datos y diseño real
      document.getElementById("exportInvoiceNum").textContent = inv.invoiceNum ? inv.invoiceNum : "-";
      document.getElementById("exportInvoiceDate").textContent = inv.date ? new Date(inv.date.seconds * 1000).toLocaleDateString() : "";
      document.getElementById("exportInvoiceSupplier").textContent = inv.supplier;
      document.getElementById("exportInvoiceProduct").textContent = productName;
      document.getElementById("exportInvoiceQuantity").textContent = inv.quantity;
      document.getElementById("exportInvoiceUnitPrice").textContent = inv.unitPrice;
      document.getElementById("exportInvoiceTotal").textContent = inv.total;
      
      let exportContainer = document.getElementById("exportInvoiceContainer");
      exportContainer.style.display = "block";
      
      html2canvas(exportContainer).then(canvas => {
        let link = document.createElement("a");
        let now = new Date();
        let fileName = "Factura_" + now.toISOString().slice(0,10) + ".png";
        link.download = fileName;
        link.href = canvas.toDataURL("image/png");
        link.click();
        exportContainer.style.display = "none";
      });
    } catch (error) {
      console.error("Error al exportar factura:", error);
      alert("Error al exportar factura: " + error.message);
    }
  }
  
  /* =========================
     EXPORTAR FACTURAS REGISTRADAS COMO IMAGEN
  ============================*/
  async function exportInvoicesImage() {
    try {
      // Obtener todas las facturas
      let snapshot = await db.collection("invoices").orderBy("date", "desc").get();
      let tbody = document.getElementById("exportInvoicesBody");
      tbody.innerHTML = "";
      for (let doc of snapshot.docs) {
        let inv = doc.data();
        let productDoc = await db.collection("inventoryProducts").doc(inv.productId).get();
        let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
        let row = document.createElement("tr");
        let cellNum = document.createElement("td");
        cellNum.textContent = inv.invoiceNum ? inv.invoiceNum : "-";
        let cellDate = document.createElement("td");
        cellDate.textContent = inv.date ? new Date(inv.date.seconds * 1000).toLocaleDateString() : "";
        let cellSupplier = document.createElement("td");
        cellSupplier.textContent = inv.supplier;
        let cellProduct = document.createElement("td");
        cellProduct.textContent = productName;
        let cellQty = document.createElement("td");
        cellQty.textContent = inv.quantity;
        let cellUnit = document.createElement("td");
        cellUnit.textContent = "Q." + inv.unitPrice;
        let cellTotal = document.createElement("td");
        cellTotal.textContent = "Q." + inv.total;
        row.appendChild(cellNum);
        row.appendChild(cellDate);
        row.appendChild(cellSupplier);
        row.appendChild(cellProduct);
        row.appendChild(cellQty);
        row.appendChild(cellUnit);
        row.appendChild(cellTotal);
        tbody.appendChild(row);
      }
      let exportContainer = document.getElementById("exportInvoicesContainer");
      exportContainer.style.display = "block";
      html2canvas(exportContainer).then(canvas => {
        let link = document.createElement("a");
        let now = new Date();
        let fileName = "Facturas_" + now.toISOString().slice(0,10) + ".png";
        link.download = fileName;
        link.href = canvas.toDataURL("image/png");
        link.click();
        exportContainer.style.display = "none";
      });
    } catch (error) {
      console.error("Error al exportar facturas:", error);
      alert("Error al exportar facturas: " + error.message);
    }
  }
  
  /* =========================
     REPORTE DE PRODUCTO
  ============================*/
  function populateReportProducts() {
    db.collection("inventoryProducts").get().then(snapshot => {
      let select = document.getElementById("reportProduct");
      select.innerHTML = "";
      snapshot.forEach(doc => {
        let option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.data().name;
        select.appendChild(option);
      });
    });
  }
  
  async function generateProductReport() {
    try {
      let productId = document.getElementById("reportProduct").value;
      let startDateInput = document.getElementById("reportStartDate").value;
      let endDateInput = document.getElementById("reportEndDate").value;
      if (!startDateInput || !endDateInput) {
        alert("Por favor, seleccione ambas fechas.");
        return;
      }
      let startDate = new Date(startDateInput);
      let endDate = new Date(endDateInput);
      endDate.setHours(23, 59, 59, 999);
  
      let productDoc = await db.collection("inventoryProducts").doc(productId).get();
      if (!productDoc.exists) {
        alert("Producto no encontrado.");
        return;
      }
      let product = productDoc.data();
      let currentStock = product.stock;
  
      let sumAfterStart = 0;
      let snapshotAfterStart = await db.collection("inventoryMovements")
        .where("productId", "==", productId)
        .where("date", ">", startDate)
        .get();
      snapshotAfterStart.forEach(doc => {
        let m = doc.data();
        if (m.type === "entrada" || m.type === "ajuste") {
          sumAfterStart += m.quantity;
        } else if (m.type === "salida") {
          sumAfterStart -= m.quantity;
        }
      });
      let initialStock = currentStock - sumAfterStart;
  
      document.getElementById("reportTitle").textContent = "Reporte de " + product.name;
      document.getElementById("reportProductInfo").textContent =
        "Producto: " + product.name + " | Stock Actual: " + currentStock;
      document.getElementById("reportDateRange").textContent =
        "Período: " + startDateInput + " - " + endDateInput;
  
      let query = db.collection("inventoryMovements")
        .where("productId", "==", productId)
        .where("date", ">=", startDate)
        .where("date", "<=", endDate)
        .orderBy("date", "asc");
      let snapshotPeriod = await query.get();
  
      let runningStock = initialStock;
      let tbody = document.querySelector("#reportTable tbody");
      tbody.innerHTML = "";
      let chartData = { labels: [], data: [] };
  
      snapshotPeriod.forEach(doc => {
        let m = doc.data();
        if (m.type === "entrada" || m.type === "ajuste") {
          runningStock += m.quantity;
        } else if (m.type === "salida") {
          runningStock -= m.quantity;
        }
        let row = tbody.insertRow();
        row.insertCell(0).textContent = m.type;
        row.insertCell(1).textContent = m.quantity;
        row.insertCell(2).textContent = runningStock;
        let dateStr = m.date ? m.date.toDate().toLocaleString() : "";
        row.insertCell(3).textContent = dateStr;
        row.insertCell(4).textContent = m.user;
        row.insertCell(5).textContent = m.reason;
        row.insertCell(6).textContent = m.comments;
        chartData.labels.push(m.date ? m.date.toDate().toLocaleDateString() : "");
        chartData.data.push(runningStock);
      });
  
      if (snapshotPeriod.empty) {
        alert("No se encontraron movimientos para este producto en el rango de fechas seleccionado.");
      }
  
      let ctx = document.getElementById("reportChart").getContext("2d");
      if (window.reportChart && typeof window.reportChart.destroy === "function") {
        window.reportChart.destroy();
      }
      window.reportChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: chartData.labels,
          datasets: [{
            label: "Stock",
            data: chartData.data,
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            fill: true
          }]
        },
        options: { responsive: true }
      });
    } catch (error) {
      console.error("Error al generar reporte de producto:", error);
      alert("Error al generar reporte: " + error.message);
    }
  }
  
  function exportReportCSV() {
    var csv = [];
    var rows = document.querySelectorAll("#reportTable tr");
    for (var i = 0; i < rows.length; i++) {
      var row = [], cols = rows[i].querySelectorAll("td, th");
      for (var j = 0; j < cols.length; j++) {
        row.push('"' + cols[j].innerText + '"');
      }
      csv.push(row.join(","));
    }
    var csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
    var downloadLink = document.createElement("a");
    downloadLink.download = "reporte_producto.csv";
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
  
  function exportReportImage() {
    html2canvas(document.getElementById("reportModal")).then(canvas => {
      let link = document.createElement("a");
      link.download = "reporte_producto.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  }
  
  /* =========================
     INICIALIZACIÓN DE LA PÁGINA
  ============================*/
  window.onload = function() {
    showSection("products");
    populateProductSelects();
  };
  