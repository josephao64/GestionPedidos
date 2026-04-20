/* inventario.js */

/* =========================
   CONFIGURACIÓN DE FIREBASE
============================*/
// db se hereda de window.db inicializado en connection.js (no redeclarar)
if (!window.db) {
  console.error("❌ Firebase no ha sido inicializado. Asegúrate de incluir connection.js");
}
// Usamos el 'db' global directamente

/* =========================
   ESTADO GLOBAL
============================*/
var currentBodegaId = null;

async function initBodegas() {
  await loadBodegasForSelector();
}

async function loadBodegasForSelector() {
  try {
    let selector = document.getElementById("globalBodegaSelector");
    let snapshot = await db.collection("bodegas").orderBy("createdAt", "asc").get();
    selector.innerHTML = "";

    let optPrincipal = document.createElement("option");
    optPrincipal.value = "principal";
    optPrincipal.textContent = "Bodega Principal";
    selector.appendChild(optPrincipal);

    snapshot.forEach(doc => {
      let option = document.createElement("option");
      option.value = doc.id;
      option.textContent = doc.data().name + (doc.data().location ? ` (${doc.data().location})` : "");
      selector.appendChild(option);
    });

    // Restaurar selección anterior o usar primera
    if (currentBodegaId && document.querySelector(`#globalBodegaSelector option[value="${currentBodegaId}"]`)) {
      selector.value = currentBodegaId;
    } else {
      currentBodegaId = "principal";
      selector.value = currentBodegaId;
    }
  } catch (error) {
    console.error("Error cargando bodegas:", error);
  }
}

function onBodegaChange() {
  currentBodegaId = document.getElementById("globalBodegaSelector").value;
  // Recargar vistas actuales
  if (document.getElementById("productsSection").style.display === "block") loadProducts();
  if (document.getElementById("movementsSection").style.display === "block") {
    if (typeof loadMovements === "function") loadMovements();
  }
  if (document.getElementById("invoicesSection").style.display === "block") loadInvoices();
  if (document.getElementById("transfersSection").style.display === "block") loadTransfers();
  // Actualizar selects de productos
  populateProductSelects();
}

/* =========================
   GESTIÓN DE BODEGAS (CRUD)
============================*/
function showAddBodegaForm() {
  document.getElementById("bodegaModalLabel").textContent = "Añadir Bodega";
  document.getElementById("bodegaId").value = "";
  document.getElementById("bodegaName").value = "";
  document.getElementById("bodegaLocation").value = "";
}

async function saveBodega() {
  try {
    let id = document.getElementById("bodegaId").value;
    let name = document.getElementById("bodegaName").value.trim();
    let location = document.getElementById("bodegaLocation").value.trim();

    if (!name) throw new Error("El nombre de la bodega es obligatorio.");

    let data = {
      name: name,
      location: location,
    };

    if (id) {
      await db.collection("bodegas").doc(id).update(data);
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("bodegas").add(data);
    }

    closeModal("bodegaModal");
    await loadBodegasForSelector(); // actualiza selector arriba
    loadBodegasTable(); // actualiza tabla en seccion bodegas
  } catch (error) {
    console.error("Error al guardar bodega:", error);
    alert("Error al guardar bodega: " + error.message);
  }
}

async function loadBodegasTable() {
  try {
    let snapshot = await db.collection("bodegas").orderBy("createdAt", "asc").get();
    let tbody = document.getElementById("bodegasTable").querySelector("tbody");
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
      let b = doc.data();
      let row = tbody.insertRow();
      row.insertCell(0).textContent = b.name;
      row.insertCell(1).textContent = b.location || "-";
      row.insertCell(2).innerHTML = `
        <button class="btn btn-sm btn-primary" onclick="editBodega('${doc.id}')">
          <i class="fa-solid fa-edit"></i>
        </button>
      `;
    });
  } catch (error) {
    console.error("Error cargando tabla bodegas:", error);
  }
}

async function editBodega(id) {
  try {
    let doc = await db.collection("bodegas").doc(id).get();
    if (!doc.exists) return;
    let data = doc.data();
    document.getElementById("bodegaId").value = doc.id;
    document.getElementById("bodegaName").value = data.name;
    document.getElementById("bodegaLocation").value = data.location || "";
    document.getElementById("bodegaModalLabel").textContent = "Editar Bodega";
    new bootstrap.Modal(document.getElementById("bodegaModal")).show();
  } catch (error) {
    console.error("Error editando bodega:", error);
  }
}

/* =========================
   FUNCIONES DE UTILIDAD
============================*/
function closeModal(modalId) {
  var modalEl = document.getElementById(modalId);
  if (modalEl && modalEl.contains(document.activeElement)) {
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
  document.getElementById("bodegasSection").style.display = "none";
  document.getElementById("transfersSection").style.display = "none";
  document.getElementById("movementsSection").style.display = "none";
  document.getElementById("adjustmentsSection").style.display = "none";
  document.getElementById("invoicesSection").style.display = "none";
  document.getElementById("reportsSection").style.display = "none";

  if (section === "products") {
    document.getElementById("productsSection").style.display = "block";
    loadProducts();
  } else if (section === "bodegas") {
    document.getElementById("bodegasSection").style.display = "block";
    loadBodegasTable();
  } else if (section === "transfers") {
    document.getElementById("transfersSection").style.display = "block";
    loadTransfers();
  } else if (section === "movements") {
    document.getElementById("movementsSection").style.display = "block";
    if (typeof loadMovements === "function") loadMovements();
  } else if (section === "adjustments") {
    document.getElementById("adjustmentsSection").style.display = "block";
  } else if (section === "invoices") {
    document.getElementById("invoicesSection").style.display = "block";
    populateSupplierFilter().then(() => loadInvoices());
  } else if (section === "reports") {
    document.getElementById("reportsSection").style.display = "block";
    populateReportProducts();
  }
}

/* =========================
   GESTIÓN DE PRODUCTOS
============================*/
function showAddProductForm() {
  document.getElementById("productModalLabel").textContent = "Agregar Producto";
  document.getElementById("productId").value = "";
  document.getElementById("productName").value = "";
  document.getElementById("productDescription").value = "";
  document.getElementById("productUnit").value = "Unidad";
  document.getElementById("productPrice").value = "";
  document.getElementById("productStock").value = "";
  document.getElementById("productStockMin").value = "";
}

async function saveProduct() {
  try {
    var id = document.getElementById("productId").value;
    var name = document.getElementById("productName").value;
    var description = document.getElementById("productDescription").value;
    var unit = document.getElementById("productUnit").value;
    var price = parseFloat(document.getElementById("productPrice").value) || 0;
    var stock = parseInt(document.getElementById("productStock").value) || 0;
    var stockMin = parseInt(document.getElementById("productStockMin").value) || 0;

    if (!name) throw new Error("El nombre del producto es obligatorio.");

    // Si es nuevo, asignar un número entero único basado en la fecha
    var idNum = id ? null : Date.now();

    var productData = {
      name: name,
      description: description,
      unit: unit,
      price: price,
      stock: stock,
      stockMin: stockMin,
      bodegaId: currentBodegaId
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

/* =========================
   NUEVO PRODUCTO RÁPIDO (CATAÁLOGO) DESDE FACTURA
============================*/
function showQuickProductModal() {
  document.getElementById("qpName").value = "";
  document.getElementById("qpUnit").value = "Unidad";
  document.getElementById("qpStockMin").value = "0";
  // Mostrar modal subyacente
  let quickModal = new bootstrap.Modal(document.getElementById("quickProductModal"), {
    backdrop: 'static'
  });
  quickModal.show();
}

function closeQuickProductModal() {
  let modalEl = document.getElementById("quickProductModal");
  let modalInstance = bootstrap.Modal.getInstance(modalEl);
  if (modalInstance) {
    modalInstance.hide();
  }
}

async function saveQuickProduct() {
  try {
    let name = document.getElementById("qpName").value.trim();
    let unit = document.getElementById("qpUnit").value;
    let stockMin = parseInt(document.getElementById("qpStockMin").value) || 0;

    if (!name) throw new Error("El nombre del producto es obligatorio.");

    let productData = {
      name: name,
      description: "",
      unit: unit,
      price: 0,
      stock: 0,
      stockMin: stockMin,
      bodegaId: currentBodegaId,
      idNum: Date.now()
    };

    let docRef = await db.collection("inventoryProducts").add(productData);

    // Actualizar cache de opciones de productos para factura
    await loadInvoiceProductOptions();

    // Actualizar todos los selects actuales en el modal de factura
    let selects = document.querySelectorAll(".invoice-product");
    selects.forEach(select => {
      let currentValue = select.value;
      if (window.invoiceProductOptions) {
        select.innerHTML = window.invoiceProductOptions;
      }
      select.value = currentValue; // Restaurar selección o quedará en blanco
    });

    closeQuickProductModal();

    // Recargar productos en el fondo si estamos en Bodega
    loadProducts();
    populateProductSelects();

    alert("Producto creado y añadido al catálogo. Ya puedes seleccionarlo en la factura.");
  } catch (error) {
    console.error("Error al crear producto rápido:", error);
    alert("Error al crear producto: " + error.message);
  }
}


async function loadProducts() {
  try {
    if (!currentBodegaId) {
      document.getElementById("productsTable").querySelector("tbody").innerHTML = "";
      return;
    }

    let sortOrderSelect = document.getElementById("productSortOrder");
    let order = sortOrderSelect ? sortOrderSelect.value : "desc";

    let snapshot = await db.collection("inventoryProducts")
      .orderBy("idNum", order).get();

    let tbody = document.getElementById("productsTable").querySelector("tbody");
    tbody.innerHTML = "";
    snapshot.docs.forEach(doc => {
      let product = doc.data();
      let bg = product.bodegaId;
      if (currentBodegaId === "principal") {
        if (bg && bg !== "principal") return;
      } else {
        if (bg !== currentBodegaId) return;
      }

      let row = tbody.insertRow();
      row.insertCell(0).textContent = product.idNum ? product.idNum : "-";
      row.insertCell(1).textContent = product.name;
      row.insertCell(2).textContent = product.unit;
      row.insertCell(3).textContent = "Q. " + (product.price ? parseFloat(product.price).toFixed(2) : "0.00");
      row.insertCell(4).textContent = product.stock;
      row.insertCell(5).textContent = product.stockMin;
      row.insertCell(6).innerHTML = `
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
  var tbody = document.getElementById("productsTable").querySelector("tbody");
  var tr = tbody.getElementsByTagName("tr");
  for (var i = 0; i < tr.length; i++) {
    let cells = tr[i].getElementsByTagName("td");
    let rowText = "";
    for (var j = 0; j < cells.length; j++) {
      rowText += cells[j].textContent + " ";
    }
    tr[i].style.display = rowText.toUpperCase().indexOf(filter) > -1 ? "" : "none";
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
      document.getElementById("productPrice").value = product.price || 0;
      document.getElementById("productStock").value = product.stock;
      document.getElementById("productStockMin").value = product.stockMin;

      new bootstrap.Modal(document.getElementById("productModal")).show();
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
    let movementSelect = document.getElementById("movementProductSelect");
    let adjustmentSelect = document.getElementById("adjustmentProductSelect");
    let reportSelect = document.getElementById("reportProduct");

    if (movementSelect) movementSelect.innerHTML = "";
    if (adjustmentSelect) adjustmentSelect.innerHTML = "";
    if (reportSelect) reportSelect.innerHTML = "";

    window.transferProductOptions = '<option value="">Seleccione producto...</option>';

    if (!currentBodegaId) return;

    let snapshot = await db.collection("inventoryProducts").where("bodegaId", "==", currentBodegaId).get();

    snapshot.forEach(doc => {
      let option = document.createElement("option");
      option.value = doc.id;
      option.textContent = doc.data().name + ` (Stock: ${doc.data().stock})`;
      if (movementSelect) movementSelect.appendChild(option);
      if (adjustmentSelect) adjustmentSelect.appendChild(option.cloneNode(true));
      if (reportSelect) reportSelect.appendChild(option.cloneNode(true));

      window.transferProductOptions += `<option value="${doc.id}">${doc.data().name} (Stock: ${doc.data().stock})</option>`;
    });
  } catch (error) {
    console.error("Error al cargar productos para selects:", error);
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
      comments: "Ajuste de inventario",
      bodegaId: currentBodegaId
    });

    closeModal("adjustmentModal");
    loadProducts();
    if (typeof loadMovements === "function") loadMovements();
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
    let tbody = document.getElementById("catalogProductsTable").querySelector("tbody");
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

    let invQuery = await db.collection("inventoryProducts")
      .where("productRef", "==", productId)
      .get();
    let yaExiste = false;
    invQuery.docs.forEach(d => {
      let bg = d.data().bodegaId;
      if (currentBodegaId === "principal") {
        if (!bg || bg === "principal") yaExiste = true;
      } else {
        if (bg === currentBodegaId) yaExiste = true;
      }
    });

    if (yaExiste) {
      alert("El producto ya está cargado en esta bodega.");
      return;
    }

    let newProduct = {
      name: prod.name,
      description: prod.description || "",
      unit: prod.presentation || "",
      stock: 0,
      stockMin: 0,
      idNum: prod.idNum ? prod.idNum : Date.now(),
      productRef: productId,
      bodegaId: currentBodegaId
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

// NUEVO: llenar el filtro de proveedores (dropdown de filtros)
async function populateSupplierFilter() {
  try {
    const sel = document.getElementById("invoiceFilterSupplier");
    if (!sel) return;
    // Guardar selección actual
    const current = sel.value || "";
    sel.innerHTML = '<option value="">Todos los proveedores</option>';

    let snapshot = await db.collection("providers").get();
    const names = [];
    snapshot.forEach(doc => {
      const name = (doc.data().name || "").trim();
      if (name) names.push(name);
    });
    // ordenar alfabéticamente y únicos
    [...new Set(names)].sort((a, b) => a.localeCompare(b)).forEach(n => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      sel.appendChild(opt);
    });
    // restaurar selección
    sel.value = current;
  } catch (error) {
    console.error("Error al cargar filtro de proveedores:", error);
  }
}

// Opciones de productos para items de factura
async function loadInvoiceProductOptions() {
  try {
    if (!currentBodegaId) return;
    let snapshot = await db.collection("inventoryProducts").get();
    let options = '<option value="">Seleccione el producto</option>';
    snapshot.docs.forEach(doc => {
      let data = doc.data();
      let bg = data.bodegaId;
      if (currentBodegaId === "principal") {
        if (bg && bg !== "principal") return;
      } else {
        if (bg !== currentBodegaId) return;
      }
      options += `<option value="${doc.id}">${data.name}</option>`;
    });
    window.invoiceProductOptions = options;
  } catch (error) {
    console.error("Error al cargar opciones de productos:", error);
  }
}

function showAddInvoiceForm() {
  document.getElementById("invoiceId").value = "";
  document.getElementById("invoiceModalLabel").textContent = "Agregar Factura";
  document.getElementById("invoiceNumber").value = "";
  document.getElementById("invoiceDate").value = "";
  document.getElementById("invoiceCompany").value = "";
  populateProviders();
  loadInvoiceProductOptions().then(() => {
    let tbody = document.querySelector("#invoiceItemsTable tbody");
    tbody.innerHTML = "";
    addInvoiceItem();
  });
  document.getElementById("invoiceOverallTotal").value = "0.00";
  new bootstrap.Modal(document.getElementById("invoiceModal")).show();
}

function addInvoiceItem() {
  let tbody = document.querySelector("#invoiceItemsTable tbody");
  let row = document.createElement("tr");

  // Producto
  let tdProduct = document.createElement("td");
  let select = document.createElement("select");
  select.className = "form-select invoice-product";
  if (window.invoiceProductOptions) {
    select.innerHTML = window.invoiceProductOptions;
  }
  tdProduct.appendChild(select);
  row.appendChild(tdProduct);

  // Cantidad
  let tdQuantity = document.createElement("td");
  let inputQuantity = document.createElement("input");
  inputQuantity.type = "number";
  inputQuantity.className = "form-control invoice-quantity";
  inputQuantity.value = 1;
  inputQuantity.min = 1;
  tdQuantity.appendChild(inputQuantity);
  row.appendChild(tdQuantity);

  // Precio Unitario
  let tdUnitPrice = document.createElement("td");
  let inputUnitPrice = document.createElement("input");
  inputUnitPrice.type = "number";
  inputUnitPrice.className = "form-control invoice-unit-price";
  inputUnitPrice.value = "0.00";
  inputUnitPrice.step = "0.01";
  inputUnitPrice.min = 0;
  tdUnitPrice.appendChild(inputUnitPrice);
  row.appendChild(tdUnitPrice);

  // Total (calculado)
  let tdTotal = document.createElement("td");
  let inputTotal = document.createElement("input");
  inputTotal.type = "number";
  inputTotal.className = "form-control invoice-item-total";
  inputTotal.value = "0.00";
  inputTotal.readOnly = true;
  tdTotal.appendChild(inputTotal);
  row.appendChild(tdTotal);

  // Acciones (eliminar fila)
  let tdActions = document.createElement("td");
  let btnRemove = document.createElement("button");
  btnRemove.type = "button";
  btnRemove.className = "btn btn-danger btn-sm";
  btnRemove.innerHTML = '<i class="fa-solid fa-trash"></i>';
  btnRemove.onclick = function () {
    row.remove();
    updateInvoiceOverallTotal();
  };
  tdActions.appendChild(btnRemove);
  row.appendChild(tdActions);

  // Actualizar total de fila al cambiar cantidad o precio unitario
  inputQuantity.oninput = function () { updateInvoiceItemTotal(row); };
  inputUnitPrice.oninput = function () { updateInvoiceItemTotal(row); };

  tbody.appendChild(row);
  updateInvoiceItemTotal(row);
}

function updateInvoiceItemTotal(row) {
  let quantity = parseFloat(row.querySelector(".invoice-quantity").value) || 0;
  let unitPrice = parseFloat(row.querySelector(".invoice-unit-price").value) || 0;
  let totalField = row.querySelector(".invoice-item-total");
  let total = quantity * unitPrice;
  totalField.value = total.toFixed(2);
  updateInvoiceOverallTotal();
}

function updateInvoiceOverallTotal() {
  let tbody = document.querySelector("#invoiceItemsTable tbody");
  let total = 0;
  tbody.querySelectorAll("tr").forEach(row => {
    let rowTotal = parseFloat(row.querySelector(".invoice-item-total").value) || 0;
    total += rowTotal;
  });
  document.getElementById("invoiceOverallTotal").value = total.toFixed(2);
}

async function saveInvoice() {
  try {
    let invoiceId = document.getElementById("invoiceId").value;
    let invoiceNumber = document.getElementById("invoiceNumber").value;
    let invoiceDate = document.getElementById("invoiceDate").value;
    let invoiceCompany = document.getElementById("invoiceCompany").value;
    let invoiceSupplier = document.getElementById("invoiceSupplier").value;
    if (!invoiceNumber || !invoiceDate || !invoiceCompany || !invoiceSupplier) {
      throw new Error("Todos los campos de la factura son obligatorios.");
    }

    // Parsear la fecha (formato "YYYY-MM-DD")
    let parts = invoiceDate.split("-");
    let localInvoiceDate = new Date(parts[0], parts[1] - 1, parts[2]);

    // Obtener los items de la factura
    let items = [];
    let tbody = document.querySelector("#invoiceItemsTable tbody");
    let rows = tbody.querySelectorAll("tr");
    if (rows.length === 0) {
      throw new Error("Agregue al menos un producto a la factura.");
    }
    for (let row of rows) {
      let productId = row.querySelector(".invoice-product").value;
      let quantity = parseFloat(row.querySelector(".invoice-quantity").value);
      let unitPrice = parseFloat(row.querySelector(".invoice-unit-price").value);
      let total = parseFloat(row.querySelector(".invoice-item-total").value);
      if (!productId || isNaN(quantity) || quantity <= 0 || isNaN(unitPrice) || unitPrice < 0) {
        throw new Error("Verifique los detalles de los productos en la factura.");
      }
      items.push({
        productId: productId,
        quantity: quantity,
        unitPrice: unitPrice,
        total: total
      });
    }

    // Calcular total general
    let overallTotal = items.reduce((sum, item) => sum + item.total, 0);

    // Duplicidad por número (solo para nueva, pero por bodega actual)
    if (!invoiceId) {
      let duplicateQuery = await db.collection("invoices")
        .where("invoiceNum", "==", invoiceNumber)
        .get();
      let exists = false;
      duplicateQuery.docs.forEach(d => {
        let bg = d.data().bodegaId;
        if (currentBodegaId === "principal") {
          if (!bg || bg === "principal") exists = true;
        } else {
          if (bg === currentBodegaId) exists = true;
        }
      });
      if (exists) {
        throw new Error("La factura con este número ya existe en esta bodega.");
      }
    }

    // Actualizar stock y registrar movimientos para cada item (solo para nueva)
    for (let item of items) {
      let productRef = db.collection("inventoryProducts").doc(item.productId);
      let productDoc = await productRef.get();
      if (!productDoc.exists) throw new Error("Producto no encontrado.");
      let product = productDoc.data();
      if (!invoiceId) {
        let newStock = product.stock + item.quantity;
        await productRef.update({ stock: newStock });
        await db.collection("inventoryMovements").add({
          productId: item.productId,
          type: "entrada",
          quantity: item.quantity,
          date: firebase.firestore.FieldValue.serverTimestamp(),
          user: "Factura",
          reason: "Factura de proveedor: " + invoiceSupplier,
          comments: "Factura ingresada el " + invoiceDate,
          bodegaId: currentBodegaId,
          invoiceId: "P" // Placeholder until invoice resolves, or not needed.
        });
      }
    }

    let invoiceData = {
      invoiceNum: invoiceNumber,
      date: localInvoiceDate,
      company: invoiceCompany,
      supplier: invoiceSupplier,
      items: items,
      overallTotal: overallTotal,
      bodegaId: currentBodegaId
    };

    if (invoiceId) {
      await db.collection("invoices").doc(invoiceId).update(invoiceData);
      alert("Factura modificada exitosamente.");
    } else {
      let newInvRef = await db.collection("invoices").add(invoiceData);

      // Update invoiceId tracking internally on movements if it was new
      let movQuery = await db.collection("inventoryMovements")
        .where("invoiceId", "==", "P")
        .where("bodegaId", "==", currentBodegaId).get();
      let batch = db.batch();
      movQuery.forEach(doc => {
        batch.update(doc.ref, { invoiceId: newInvRef.id });
      });
      await batch.commit();

      alert("Factura agregada exitosamente y entrada de productos registrada.");
    }
    closeModal("invoiceModal");
    loadProducts();
    if (typeof loadMovements === "function") loadMovements();
    loadInvoices();
    populateProductSelects();
  } catch (error) {
    console.error("Error al guardar factura:", error);
    alert("Error al guardar factura: " + error.message);
  }
}

/* =========================
   FILTROS DE FACTURAS (NUEVO)
============================*/
function clearInvoiceFilters() {
  const search = document.getElementById("invoiceSearchNumber");
  const company = document.getElementById("invoiceFilterCompany");
  const supplier = document.getElementById("invoiceFilterSupplier");
  const start = document.getElementById("invoiceStartDate");
  const end = document.getElementById("invoiceEndDate");

  if (search) search.value = "";
  if (company) company.value = "";
  if (supplier) supplier.value = "";
  if (start) start.value = "";
  if (end) end.value = "";

  loadInvoices();
}

/**
 *  CARGAR FACTURAS (con búsqueda y filtros)
 */
async function loadInvoices() {
  try {
    // Lectura de controles
    const searchTerm = (document.getElementById("invoiceSearchNumber")?.value || "").trim().toLowerCase();
    const filterCompany = document.getElementById("invoiceFilterCompany")?.value || "";
    const filterSupplier = document.getElementById("invoiceFilterSupplier")?.value || "";
    const groupByCompanyCheckbox = document.getElementById("groupByCompanyCheckbox");
    const groupByCompany = groupByCompanyCheckbox && groupByCompanyCheckbox.checked;

    // Rango de fechas opcional
    const startVal = document.getElementById("invoiceStartDate")?.value;
    const endVal = document.getElementById("invoiceEndDate")?.value;

    if (!currentBodegaId) {
      document.getElementById("invoicesTable").querySelector("tbody").innerHTML = "";
      return;
    }

    let queryRef = db.collection("invoices");

    if (startVal) {
      const p = startVal.split("-");
      const startDate = new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0);
      queryRef = queryRef.where("date", ">=", startDate);
    }
    if (endVal) {
      const p = endVal.split("-");
      const endDate = new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999);
      queryRef = queryRef.where("date", "<=", endDate);
    }

    // Siempre ordenamos por fecha
    queryRef = queryRef.orderBy("date", "desc");

    let snapshot = await queryRef.get();

    let tbody = document.getElementById("invoicesTable").querySelector("tbody");
    tbody.innerHTML = "";

    let actionsHeader = document.getElementById("actionsHeader");

    // Filtrado en cliente por empresa / proveedor / número y bodega
    const filteredDocs = snapshot.docs.filter(d => {
      const inv = d.data();
      let bg = inv.bodegaId || "principal"; // Treat legacy invoices as principal

      console.log(`Invoice ${inv.invoiceNum}: currentBodegaId=${currentBodegaId}, inv.bodegaId=${bg}, Keep: ${currentBodegaId === bg}`);

      if (currentBodegaId !== bg) {
        return false;
      }
      // filtro por empresa
      if (filterCompany && inv.company !== filterCompany) return false;
      // filtro por proveedor
      if (filterSupplier && inv.supplier !== filterSupplier) return false;
      // búsqueda por número (parcial, case-insensitive)
      if (searchTerm) {
        const num = (inv.invoiceNum || "").toString().toLowerCase();
        if (!num.includes(searchTerm)) return false;
      }
      return true;
    });

    if (groupByCompany) {
      actionsHeader.style.display = "none";
      let groups = {};
      for (let doc of filteredDocs) {
        let inv = doc.data();
        let companyName = inv.company || "SIN EMPRESA";
        if (!groups[companyName]) groups[companyName] = [];
        groups[companyName].push({ id: doc.id, data: inv });
      }

      for (let company in groups) {
        let headerRow = tbody.insertRow();
        let headerCell = headerRow.insertCell(0);
        headerCell.colSpan = 6;
        headerCell.style.backgroundColor = "#CEE8FA";
        headerCell.style.fontWeight = "bold";
        headerCell.style.textAlign = "center";
        headerCell.textContent = company.toUpperCase();

        let totalSum = 0;
        for (let item of groups[company]) {
          let inv = item.data;
          let row = tbody.insertRow();
          row.insertCell(0).textContent = inv.invoiceNum ? inv.invoiceNum : "-";

          let cellDate = row.insertCell(1);
          if (inv.date) {
            // inv.date puede ser Timestamp o Date
            let dateObj = inv.date.seconds ? new Date(inv.date.seconds * 1000) : new Date(inv.date);
            cellDate.textContent = dateObj.toLocaleDateString();
          } else {
            cellDate.textContent = "";
          }
          row.insertCell(2).textContent = inv.company || "";
          row.insertCell(3).textContent = inv.supplier || "";

          let itemsCell = row.insertCell(4);
          let itemsDesc = "";
          if (Array.isArray(inv.items)) {
            for (let itm of inv.items) {
              let productDoc = await db.collection("inventoryProducts").doc(itm.productId).get();
              let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
              itemsDesc += `${productName} (${itm.quantity} x Q.${parseFloat(itm.unitPrice).toFixed(2)} = Q.${parseFloat(itm.total).toFixed(2)})<br>`;
            }
          }
          itemsCell.innerHTML = itemsDesc;

          let totalCell = row.insertCell(5);
          let overallTotal = Array.isArray(inv.items) ? inv.overallTotal : inv.total;
          totalCell.textContent = "Q." + parseFloat(overallTotal || 0).toFixed(2);
          totalSum += parseFloat(overallTotal) || 0;
        }
        let totalRow = tbody.insertRow();
        let totalCellLabel = totalRow.insertCell(0);
        totalCellLabel.colSpan = 4;
        totalCellLabel.style.textAlign = "right";
        totalCellLabel.style.fontWeight = "bold";
        totalCellLabel.textContent = "TOTAL " + company.toUpperCase() + ": ";
        let totalCellValue = totalRow.insertCell(1);
        totalCellValue.colSpan = 2;
        totalCellValue.style.fontWeight = "bold";
        totalCellValue.textContent = "Q." + totalSum.toFixed(2);
      }
    } else {
      actionsHeader.style.display = "";
      for (let doc of filteredDocs) {
        let inv = doc.data();
        let row = tbody.insertRow();
        row.insertCell(0).textContent = inv.invoiceNum ? inv.invoiceNum : "-";

        let dateCell = row.insertCell(1);
        if (inv.date) {
          let dateObj = inv.date.seconds ? new Date(inv.date.seconds * 1000) : new Date(inv.date);
          dateCell.textContent = dateObj.toLocaleDateString();
        } else {
          dateCell.textContent = "";
        }

        row.insertCell(2).textContent = inv.company || "";
        row.insertCell(3).textContent = inv.supplier || "";

        let itemsCell = row.insertCell(4);
        let itemsDesc = "";
        if (Array.isArray(inv.items)) {
          for (let itm of inv.items) {
            let productDoc = await db.collection("inventoryProducts").doc(itm.productId).get();
            let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
            itemsDesc += `${productName} (${itm.quantity} x Q.${parseFloat(itm.unitPrice).toFixed(2)} = Q.${parseFloat(itm.total).toFixed(2)})<br>`;
          }
        }
        itemsCell.innerHTML = itemsDesc;

        let totalCell = row.insertCell(5);
        let overallTotal = Array.isArray(inv.items) ? inv.overallTotal : inv.total;
        totalCell.textContent = "Q." + parseFloat(overallTotal || 0).toFixed(2);

        let actionsCell = row.insertCell(6);
        actionsCell.innerHTML = `
          <button class="btn btn-sm btn-primary" onclick="editInvoice('${doc.id}')">
            <i class="fa-solid fa-edit"></i> Editar
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${doc.id}')">
            <i class="fa-solid fa-trash"></i> Eliminar
          </button>
          <button class="btn btn-sm btn-secondary" onclick="exportInvoiceImage('${doc.id}')">
            <i class="fa-solid fa-file-export"></i> Exportar
          </button>`;
      }
    }
  } catch (error) {
    console.error("Error al cargar facturas:", error);
    alert("Error al cargar facturas: " + error.message);
  }
}

async function editInvoice(invoiceId) {
  try {
    let doc = await db.collection("invoices").doc(invoiceId).get();
    if (!doc.exists) throw new Error("Factura no encontrada.");
    let inv = doc.data();
    document.getElementById("invoiceId").value = invoiceId;
    document.getElementById("invoiceModalLabel").textContent = "Editar Factura";
    document.getElementById("invoiceNumber").value = inv.invoiceNum;

    let d = inv.date?.seconds ? new Date(inv.date.seconds * 1000) : new Date(inv.date);
    let year = d.getFullYear();
    let month = ("0" + (d.getMonth() + 1)).slice(-2);
    let day = ("0" + d.getDate()).slice(-2);
    document.getElementById("invoiceDate").value = year + "-" + month + "-" + day;

    document.getElementById("invoiceCompany").value = inv.company || "";
    await populateProviders();
    document.getElementById("invoiceSupplier").value = inv.supplier || "";
    await loadInvoiceProductOptions();
    let tbody = document.querySelector("#invoiceItemsTable tbody");
    tbody.innerHTML = "";
    inv.items.forEach(item => {
      let row = document.createElement("tr");

      let tdProduct = document.createElement("td");
      let select = document.createElement("select");
      select.className = "form-select invoice-product";
      if (window.invoiceProductOptions) {
        select.innerHTML = window.invoiceProductOptions;
      }
      select.value = item.productId;
      tdProduct.appendChild(select);
      row.appendChild(tdProduct);

      let tdQuantity = document.createElement("td");
      let inputQuantity = document.createElement("input");
      inputQuantity.type = "number";
      inputQuantity.className = "form-control invoice-quantity";
      inputQuantity.value = item.quantity;
      inputQuantity.min = 1;
      tdQuantity.appendChild(inputQuantity);
      row.appendChild(tdQuantity);

      let tdUnitPrice = document.createElement("td");
      let inputUnitPrice = document.createElement("input");
      inputUnitPrice.type = "number";
      inputUnitPrice.className = "form-control invoice-unit-price";
      inputUnitPrice.value = item.unitPrice;
      inputUnitPrice.step = "0.01";
      inputUnitPrice.min = 0;
      tdUnitPrice.appendChild(inputUnitPrice);
      row.appendChild(tdUnitPrice);

      let tdTotal = document.createElement("td");
      let inputTotal = document.createElement("input");
      inputTotal.type = "number";
      inputTotal.className = "form-control invoice-item-total";
      inputTotal.value = item.total;
      inputTotal.readOnly = true;
      tdTotal.appendChild(inputTotal);
      row.appendChild(tdTotal);

      let tdActions = document.createElement("td");
      let btnRemove = document.createElement("button");
      btnRemove.type = "button";
      btnRemove.className = "btn btn-danger btn-sm";
      btnRemove.innerHTML = '<i class="fa-solid fa-trash"></i>';
      btnRemove.onclick = function () {
        row.remove();
        updateInvoiceOverallTotal();
      };
      tdActions.appendChild(btnRemove);
      row.appendChild(tdActions);

      inputQuantity.oninput = function () { updateInvoiceItemTotal(row); };
      inputUnitPrice.oninput = function () { updateInvoiceItemTotal(row); };

      tbody.appendChild(row);
    });
    updateInvoiceOverallTotal();
    new bootstrap.Modal(document.getElementById("invoiceModal")).show();
  } catch (error) {
    console.error("Error al cargar factura para editar:", error);
    alert("Error al cargar factura: " + error.message);
  }
}

async function deleteInvoice(invoiceId) {
  if (!confirm("¿Estás seguro de eliminar esta factura?")) return;
  try {
    let invDoc = await db.collection("invoices").doc(invoiceId).get();
    if (!invDoc.exists) throw new Error("Factura no encontrada");
    let inv = invDoc.data();

    for (let item of inv.items) {
      let productRef = db.collection("inventoryProducts").doc(item.productId);
      let productDoc = await productRef.get();
      if (!productDoc.exists) throw new Error("Producto no encontrado");
      let product = productDoc.data();
      let newStock = product.stock - item.quantity;
      await productRef.update({ stock: newStock });
    }

    let movementsSnapshot = await db.collection("inventoryMovements").where("invoiceId", "==", invoiceId).get();
    for (let movementDoc of movementsSnapshot.docs) {
      await db.collection("inventoryMovements").doc(movementDoc.id).delete();
    }

    await db.collection("invoices").doc(invoiceId).delete();

    loadInvoices();
    loadProducts();
    loadMovements();
  } catch (error) {
    console.error("Error al eliminar factura:", error);
    alert("Error al eliminar factura: " + error.message);
  }
}

async function exportInvoiceImage(invoiceId) {
  try {
    let invDoc = await db.collection("invoices").doc(invoiceId).get();
    if (!invDoc.exists) throw new Error("Factura no encontrada");
    let inv = invDoc.data();
    let productsHTML = "";
    for (let item of inv.items) {
      let productDoc = await db.collection("inventoryProducts").doc(item.productId).get();
      let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
      let productUnit = productDoc.exists ? (productDoc.data().unit || "-") : "-";
      productsHTML += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px 8px; color: #444;">${productName}</td>
          <td style="padding: 12px 8px; text-align: center; color: #444;">${productUnit}</td>
          <td style="padding: 12px 8px; text-align: center; color: #444;">${item.quantity}</td>
          <td style="padding: 12px 8px; text-align: center; color: #444;">Q.${parseFloat(item.unitPrice).toFixed(2)}</td>
          <td style="padding: 12px 8px; text-align: right; color: #444;">Q.${parseFloat(item.total).toFixed(2)}</td>
        </tr>
      `;
    }
    document.getElementById("exportInvoiceNum").textContent = inv.invoiceNum ? inv.invoiceNum : "-";
    let dateObj = inv.date?.seconds ? new Date(inv.date.seconds * 1000) : new Date(inv.date);
    document.getElementById("exportInvoiceDate").textContent = inv.date ? dateObj.toLocaleDateString() : "";
    document.getElementById("exportInvoiceSupplier").textContent = inv.supplier || "";
    document.getElementById("exportInvoiceProducts").innerHTML = productsHTML;
    document.getElementById("exportInvoiceOverallTotal").textContent = inv.overallTotal ? parseFloat(inv.overallTotal).toFixed(2) : "0.00";

    // Asignar el logo dinámicamente desde el de traslado para no duplicar el base64 enorme
    let transferLogo = document.getElementById("exportLogoImg");
    if (transferLogo) {
      document.getElementById("exportInvoiceLogoImg").src = transferLogo.src;
    }

    let exportContainer = document.getElementById("exportInvoiceContainer");
    exportContainer.style.display = "block";

    html2canvas(exportContainer).then(canvas => {
      let link = document.createElement("a");
      let now = new Date();
      let fileName = "Factura_" + now.toISOString().slice(0, 10) + ".png";
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

async function exportInvoicesImage() {
  try {
    let snapshot = await db.collection("invoices").orderBy("date", "desc").get();
    let tbody = document.getElementById("exportInvoicesBody");
    tbody.innerHTML = "";
    for (let doc of snapshot.docs) {
      let inv = doc.data();
      let bg = inv.bodegaId || "principal";
      if (currentBodegaId !== bg) continue;

      let row = document.createElement("tr");
      let cellNum = document.createElement("td");
      cellNum.textContent = inv.invoiceNum ? inv.invoiceNum : "-";
      let cellDate = document.createElement("td");
      let dateObj = inv.date?.seconds ? new Date(inv.date.seconds * 1000) : new Date(inv.date);
      cellDate.textContent = inv.date ? dateObj.toLocaleDateString() : "";
      let cellCompany = document.createElement("td");
      cellCompany.textContent = inv.company || "";
      let cellSupplier = document.createElement("td");
      cellSupplier.textContent = inv.supplier || "";
      let cellProducts = document.createElement("td");
      let productsDesc = "";
      for (let item of inv.items || []) {
        let productDoc = await db.collection("inventoryProducts").doc(item.productId).get();
        let productName = productDoc.exists ? productDoc.data().name : "No encontrado";
        productsDesc += `${productName} (${item.quantity} x Q.${parseFloat(item.unitPrice).toFixed(2)} = Q.${parseFloat(item.total).toFixed(2)})<br>`;
      }
      cellProducts.innerHTML = productsDesc;
      let cellTotal = document.createElement("td");
      cellTotal.textContent = "Q." + parseFloat(inv.overallTotal || 0).toFixed(2);

      row.appendChild(cellNum);
      row.appendChild(cellDate);
      row.appendChild(cellCompany);
      row.appendChild(cellSupplier);
      row.appendChild(cellProducts);
      row.appendChild(cellTotal);
      tbody.appendChild(row);
    }
    let exportContainer = document.getElementById("exportInvoicesContainer");
    exportContainer.style.display = "block";
    html2canvas(exportContainer).then(canvas => {
      let link = document.createElement("a");
      let now = new Date();
      let fileName = "Facturas_" + now.toISOString().slice(0, 10) + ".png";
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
    document.getElementById("exportHeader").textContent =
      "REPORTE STOCK DE BODEGA - " + now.toLocaleDateString();
    let exportContainer = document.getElementById("exportProductsContainer");
    exportContainer.style.display = "block";
    html2canvas(exportContainer).then(canvas => {
      let link = document.createElement("a");
      let fileName = "Stock_" + now.toISOString().slice(0, 10) + ".png";
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
   TRASLADOS ENTRE BODEGAS
============================*/
async function showAddTransferForm() {
  document.getElementById("transferUser").value = "";

  let tbody = document.getElementById("transferItemsTable").querySelector("tbody");
  tbody.innerHTML = "";
  addTransferItem();

  let destSelect = document.getElementById("transferDestination");
  destSelect.innerHTML = "<option value=''>Seleccione sucursal o bodega destino...</option>";

  try {
    if (currentBodegaId !== "principal") {
      let optPrincipal = document.createElement("option");
      optPrincipal.value = "principal";
      optPrincipal.textContent = "Bodega Principal";
      destSelect.appendChild(optPrincipal);
    }

    let [bodegasSnap, sucursalesSnap] = await Promise.all([
      db.collection("bodegas").orderBy("createdAt", "asc").get(),
      db.collection("sucursales").orderBy("name", "asc").get()
    ]);

    bodegasSnap.forEach(doc => {
      if (doc.id !== currentBodegaId) {
        let option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.data().name + " (Bodega)";
        destSelect.appendChild(option);
      }
    });

    sucursalesSnap.forEach(doc => {
      if (doc.id !== currentBodegaId) {
        let option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.data().name + " (Sucursal)";
        destSelect.appendChild(option);
      }
    });

  } catch (error) {
    console.error("Error cargando bodegas destino:", error);
  }
}

async function editTransfer(transferId) {
  if (!confirm("Para editar este traslado, primero se desharán los cambios de stock actuales y luego podrá realizar las modificaciones necesarias. ¿Desea continuar?")) return;

  try {
    let tDoc = await db.collection("transfers").doc(transferId).get();
    if (!tDoc.exists) throw new Error("Traslado no encontrado");
    let t = tDoc.data();

    // 1. Revert stock (Reuse logic from deleteTransfer)
    let batch = db.batch();
    if (t.items && t.items.length > 0) {
      for (const item of t.items) {
        if (!item.productId || item.productId === "-") continue;
        try {
          let originQueryMatch = null;
          if (item.idNum && item.idNum !== "-") {
            let q1 = await db.collection("inventoryProducts").where("idNum", "==", item.idNum).where("bodegaId", "==", t.sourceBodegaId).get();
            if (!q1.empty) originQueryMatch = q1.docs[0];
          }
          if (!originQueryMatch) {
            let q2 = await db.collection("inventoryProducts").where("name", "==", item.productName).where("bodegaId", "==", t.sourceBodegaId).get();
            if (!q2.empty) originQueryMatch = q2.docs[0];
          }
          if (originQueryMatch) batch.update(originQueryMatch.ref, { stock: originQueryMatch.data().stock + item.quantity });
        } catch (e) { console.error("Error revirtiendo origen:", e); }

        try {
          let destQueryMatch = null;
          if (item.idNum && item.idNum !== "-") {
            let q1 = await db.collection("inventoryProducts").where("idNum", "==", item.idNum).where("bodegaId", "==", t.destBodegaId).get();
            if (!q1.empty) destQueryMatch = q1.docs[0];
          }
          if (!destQueryMatch) {
            let q2 = await db.collection("inventoryProducts").where("name", "==", item.productName).where("bodegaId", "==", t.destBodegaId).get();
            if (!q2.empty) destQueryMatch = q2.docs[0];
          }
          if (destQueryMatch) {
            let newDestStock = destQueryMatch.data().stock - item.quantity;
            batch.update(destQueryMatch.ref, { stock: newDestStock < 0 ? 0 : newDestStock });
          }
        } catch (e) { console.error("Error revirtiendo destino:", e); }
      }
    } else if (t.productId && t.productName) {
      try {
        let originQueryMatch = await db.collection("inventoryProducts").where("name", "==", t.productName).where("bodegaId", "==", t.sourceBodegaId).get();
        if (!originQueryMatch.empty) batch.update(originQueryMatch.docs[0].ref, { stock: originQueryMatch.docs[0].data().stock + t.quantity });
      } catch (e) { console.error("Legacy origin revert err", e); }
      try {
        let destQueryMatch = await db.collection("inventoryProducts").where("name", "==", t.productName).where("bodegaId", "==", t.destBodegaId).get();
        if (!destQueryMatch.empty) {
          let newStock = destQueryMatch.docs[0].data().stock - t.quantity;
          batch.update(destQueryMatch.docs[0].ref, { stock: newStock < 0 ? 0 : newStock });
        }
      } catch (e) { console.error("Legacy dest revert err", e); }
    }

    // Delete old transfer record
    batch.delete(db.collection("transfers").doc(transferId));
    await batch.commit();

    // 2. Open Modal and populate data
    await showAddTransferForm(); // This clears and sets up options

    let transferModalEl = document.getElementById('transferModal');
    let transferModal = bootstrap.Modal.getInstance(transferModalEl);
    if (!transferModal) {
      transferModal = new bootstrap.Modal(transferModalEl);
    }
    transferModal.show();

    document.getElementById("transferDestination").value = t.destBodegaId;
    document.getElementById("transferUser").value = t.user || "";

    let tbody = document.getElementById("transferItemsTable").querySelector("tbody");
    tbody.innerHTML = "";

    // Repopulate rows based on previous items
    if (t.items && t.items.length > 0) {
      t.items.forEach(item => {
        addTransferItem();
        let currRow = tbody.lastElementChild;
        // Wait briefly for select options to settle
        setTimeout(() => {
          let sel = currRow.querySelector(".transfer-product-select");
          let qty = currRow.querySelector(".transfer-quantity-input");

          // Trying to match via name because productId might be out of sync
          let matchedOption = Array.from(sel.options).find(opt => opt.text === item.productName);
          if (matchedOption) sel.value = matchedOption.value;

          qty.value = item.quantity;
        }, 100);
      });
    } else if (t.productId && t.productName) {
      addTransferItem();
      let currRow = tbody.lastElementChild;
      setTimeout(() => {
        let sel = currRow.querySelector(".transfer-product-select");
        let qty = currRow.querySelector(".transfer-quantity-input");
        let matchedOption = Array.from(sel.options).find(opt => opt.text === t.productName);
        if (matchedOption) sel.value = matchedOption.value;
        qty.value = t.quantity;
      }, 100);
    }

  } catch (error) {
    console.error("Error al editar traslado:", error);
    alert("Error al cargar datos para editar: " + error.message);
  }
}

function addTransferItem() {
  let tbody = document.getElementById("transferItemsTable").querySelector("tbody");
  let row = tbody.insertRow();

  let cellSelect = row.insertCell(0);
  let cellQuantity = row.insertCell(1);
  let cellAction = row.insertCell(2);

  cellSelect.innerHTML = `<select class="form-select transfer-product-select" required>${window.transferProductOptions || '<option value="">Cargando...</option>'}</select>`;
  cellQuantity.innerHTML = `<input type="number" class="form-control transfer-quantity-input" min="1" required />`;
  cellAction.innerHTML = `<button type="button" class="btn btn-danger btn-sm" onclick="removeTransferItem(this)"><i class="fa-solid fa-trash"></i></button>`;
}

function removeTransferItem(btn) {
  let row = btn.parentNode.parentNode;
  row.parentNode.removeChild(row);
}

async function saveTransfer() {
  try {
    let destBodegaId = document.getElementById("transferDestination").value;
    let user = document.getElementById("transferUser").value.trim();

    if (!destBodegaId || !user) {
      throw new Error("Por favor complete todos los campos obligatorios.");
    }

    let tbody = document.getElementById("transferItemsTable").querySelector("tbody");
    let rows = tbody.querySelectorAll("tr");
    if (rows.length === 0) throw new Error("Debe agregar al menos un producto.");

    let items = [];
    for (let i = 0; i < rows.length; i++) {
      let select = rows[i].querySelector(".transfer-product-select");
      let input = rows[i].querySelector(".transfer-quantity-input");
      if (!select || !input) continue;

      let productId = select.value;
      let quantity = parseFloat(input.value);

      if (!productId || isNaN(quantity) || quantity <= 0) {
        throw new Error("Asegúrese de seleccionar el producto y establecer una cantidad mayor a 0 en todas las filas.");
      }
      items.push({ productId, quantity });
    }

    if (items.length === 0) throw new Error("Debe agregar al menos un producto válido.");

    let batch = db.batch();
    let totalQuantity = 0;
    let transferItemsForDoc = [];

    // Loop through each item
    for (let item of items) {
      let sourceRef = db.collection("inventoryProducts").doc(item.productId);
      let sourceDoc = await sourceRef.get();
      if (!sourceDoc.exists) throw new Error("Producto origen no encontrado: " + item.productId);
      let sourceProduct = sourceDoc.data();

      if (sourceProduct.stock < item.quantity) {
        throw new Error(`No hay suficiente stock para el producto ${sourceProduct.name}. Solicitado: ${item.quantity}, Disponible: ${sourceProduct.stock}`);
      }

      let productRefId = sourceProduct.productRef || null;
      let destQuery = null;

      if (productRefId) {
        destQuery = await db.collection("inventoryProducts")
          .where("productRef", "==", productRefId)
          .get();
      } else {
        destQuery = await db.collection("inventoryProducts")
          .where("name", "==", sourceProduct.name)
          .get();
      }

      let destDocRef = null;
      let currentDestDocData = null;

      destQuery.docs.forEach(d => {
        let bg = d.data().bodegaId;
        if (destBodegaId === "principal") {
          if (!bg || bg === "principal") {
            destDocRef = d.ref;
            currentDestDocData = d.data();
          }
        } else {
          if (bg === destBodegaId) {
            destDocRef = d.ref;
            currentDestDocData = d.data();
          }
        }
      });

      if (!destDocRef) {
        let newProduct = {
          name: sourceProduct.name,
          description: sourceProduct.description || "",
          unit: sourceProduct.unit || "",
          price: sourceProduct.price || 0,
          stock: 0,
          stockMin: sourceProduct.stockMin || 0,
          idNum: Date.now() + Math.floor(Math.random() * 1000),
          productRef: productRefId,
          bodegaId: destBodegaId
        };
        destDocRef = db.collection("inventoryProducts").doc();
        batch.set(destDocRef, newProduct);
      } else {
        batch.update(destDocRef, { stock: currentDestDocData.stock + item.quantity });
      }

      batch.update(sourceRef, { stock: sourceProduct.stock - item.quantity });

      let movOrigenRef = db.collection("inventoryMovements").doc();
      batch.set(movOrigenRef, {
        productId: item.productId,
        type: "salida",
        quantity: item.quantity,
        date: firebase.firestore.FieldValue.serverTimestamp(),
        user: user,
        reason: "Traslado a sucursal",
        comments: "Traslado hacia sucursal " + destBodegaId.substring(0, 8),
        bodegaId: currentBodegaId,
        isTransfer: true
      });

      let movDestinoRef = db.collection("inventoryMovements").doc();
      batch.set(movDestinoRef, {
        productId: destDocRef.id,
        type: "entrada",
        quantity: item.quantity,
        date: firebase.firestore.FieldValue.serverTimestamp(),
        user: user,
        reason: "Recepción de traslado",
        comments: "Traslado desde sucursal " + currentBodegaId.substring(0, 8),
        bodegaId: destBodegaId,
        isTransfer: true
      });

      totalQuantity += item.quantity;
      transferItemsForDoc.push({
        productId: productRefId || sourceProduct.idNum || "-",
        productName: sourceProduct.name,
        quantity: item.quantity,
        price: sourceProduct.price || 0,
        idNum: sourceProduct.idNum || "-"
      });
    }

    let transferRef = db.collection("transfers").doc();
    batch.set(transferRef, {
      sourceBodegaId: currentBodegaId,
      destBodegaId: destBodegaId,
      items: transferItemsForDoc,
      totalQuantity: totalQuantity,
      user: user,
      date: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    alert("Traslado realizado exitosamente.");
    closeModal("transferModal");
    loadTransfers();
    loadProducts();
    if (typeof loadMovements === "function") loadMovements();

  } catch (error) {
    console.error("Error al realizar traslado:", error);
    alert("Error al realizar traslado: " + error.message);
  }
}

async function loadTransfers() {
  try {
    if (!currentBodegaId) return;

    let sourceQuery = db.collection("transfers").where("sourceBodegaId", "==", currentBodegaId).get();
    let destQuery = db.collection("transfers").where("destBodegaId", "==", currentBodegaId).get();

    let [sourceSnap, destSnap] = await Promise.all([sourceQuery, destQuery]);

    window.transfersMap = new Map();
    sourceSnap.forEach(doc => window.transfersMap.set(doc.id, doc.data()));
    destSnap.forEach(doc => window.transfersMap.set(doc.id, doc.data()));

    let transfers = Array.from(window.transfersMap.values());
    transfers.sort((a, b) => {
      let tA = a.date ? (a.date.seconds || 0) : 0;
      let tB = b.date ? (b.date.seconds || 0) : 0;
      return tB - tA; // desc
    });

    let [bodegasSnap, sucursalesSnap] = await Promise.all([
      db.collection("bodegas").get(),
      db.collection("sucursales").get()
    ]);

    let bodegasMap = { "principal": "Bodega Principal" };
    bodegasSnap.forEach(doc => bodegasMap[doc.id] = doc.data().name + " (Bodega)");
    sucursalesSnap.forEach(doc => bodegasMap[doc.id] = doc.data().name + " (Sucursal)");

    let tbody = document.getElementById("transfersTable").querySelector("tbody");
    tbody.innerHTML = "";

    transfers.forEach(t => {
      let tId = "";
      for (let [key, val] of window.transfersMap.entries()) {
        if (val === t) { tId = key; break; }
      }

      let itemsText = "Varios Productos";
      if (t.items && t.items.length === 1) itemsText = t.items[0].productName;
      else if (t.productName && (!t.items || t.items.length === 0)) itemsText = t.productName;

      let totalQty = t.totalQuantity || t.quantity || 0;

      let row = tbody.insertRow();
      let dateObj = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();
      row.insertCell(0).textContent = dateObj.toLocaleString();
      row.insertCell(1).textContent = itemsText;
      row.insertCell(2).textContent = totalQty;
      row.insertCell(3).textContent = bodegasMap[t.sourceBodegaId] || t.sourceBodegaId;
      row.insertCell(4).textContent = bodegasMap[t.destBodegaId] || t.destBodegaId;
      row.insertCell(5).textContent = t.user;
      row.insertCell(6).innerHTML = `
        <button class="btn btn-sm btn-info" onclick="exportTransfer('${tId}')" title="Constancia">
          <i class="fa-solid fa-file-pdf"></i>
        </button>
        <button class="btn btn-sm btn-warning ms-1" onclick="editTransfer('${tId}')" title="Editar">
          <i class="fa-solid fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger ms-1" onclick="deleteTransfer('${tId}')" title="Eliminar">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
    });

  } catch (error) {
    console.error("Error cargando historial de traslados:", error);
  }
}

async function deleteTransfer(transferId) {
  if (!confirm("¿Está seguro de eliminar este traslado? Los productos volverán a la bodega de origen y se eliminarán del destino si es posible.")) return;
  try {
    let tDoc = await db.collection("transfers").doc(transferId).get();
    if (!tDoc.exists) throw new Error("Traslado no encontrado");
    let t = tDoc.data();

    let batch = db.batch();

    // Reverse items
    if (t.items && t.items.length > 0) {
      for (const item of t.items) {
        if (!item.productId || item.productId === "-") continue;

        // 1. Aumentar stock en sourceBodega (si el producto existe en origen)
        try {
          // Buscamos el producto en la base usando el idNum o el productRef
          let originQueryMatch = null;
          if (item.idNum && item.idNum !== "-") {
            let q1 = await db.collection("inventoryProducts")
              .where("idNum", "==", item.idNum)
              .where("bodegaId", "==", t.sourceBodegaId).get();
            if (!q1.empty) originQueryMatch = q1.docs[0];
          }
          if (!originQueryMatch) {
            let q2 = await db.collection("inventoryProducts")
              .where("name", "==", item.productName)
              .where("bodegaId", "==", t.sourceBodegaId).get();
            if (!q2.empty) originQueryMatch = q2.docs[0];
          }

          if (originQueryMatch) {
            batch.update(originQueryMatch.ref, { stock: originQueryMatch.data().stock + item.quantity });
          }
        } catch (e) { console.error("Error revirtiendo origen:", e); }

        // 2. Disminuir stock en destBodega (si el producto existe en destino)
        try {
          let destQueryMatch = null;
          if (item.idNum && item.idNum !== "-") {
            let q1 = await db.collection("inventoryProducts")
              .where("idNum", "==", item.idNum)
              .where("bodegaId", "==", t.destBodegaId).get();
            if (!q1.empty) destQueryMatch = q1.docs[0];
          }
          if (!destQueryMatch) {
            let q2 = await db.collection("inventoryProducts")
              .where("name", "==", item.productName)
              .where("bodegaId", "==", t.destBodegaId).get();
            if (!q2.empty) destQueryMatch = q2.docs[0];
          }

          if (destQueryMatch) {
            let newDestStock = destQueryMatch.data().stock - item.quantity;
            if (newDestStock < 0) newDestStock = 0;
            batch.update(destQueryMatch.ref, { stock: newDestStock });
          }
        } catch (e) { console.error("Error revirtiendo destino:", e); }
      }
    } else if (t.productId && t.productName) {
      // Legacy transfer compatibility
      try {
        let originQueryMatch = await db.collection("inventoryProducts").where("name", "==", t.productName).where("bodegaId", "==", t.sourceBodegaId).get();
        if (!originQueryMatch.empty) batch.update(originQueryMatch.docs[0].ref, { stock: originQueryMatch.docs[0].data().stock + t.quantity });
      } catch (e) { console.error("Legacy origin revert err", e); }

      try {
        let destQueryMatch = await db.collection("inventoryProducts").where("name", "==", t.productName).where("bodegaId", "==", t.destBodegaId).get();
        if (!destQueryMatch.empty) {
          let newStock = destQueryMatch.docs[0].data().stock - t.quantity;
          batch.update(destQueryMatch.docs[0].ref, { stock: newStock < 0 ? 0 : newStock });
        }
      } catch (e) { console.error("Legacy dest revert err", e); }
    }

    // Delete Transfer
    batch.delete(db.collection("transfers").doc(transferId));

    await batch.commit();
    alert("Traslado eliminado y stock revertido correctamente.");
    loadTransfers();
    loadProducts();
    if (typeof loadMovements === "function") loadMovements();
  } catch (error) {
    console.error("Error eliminando traslado:", error);
    alert("Error eliminando traslado: " + error.message);
  }
}

/* =========================
   EXPORTAR CONSTANCIA TRASLADO
============================*/
async function exportTransfer(transferId) {
  try {
    if (!window.transfersMap || !window.transfersMap.has(transferId)) {
      alert("No se encontraron los datos del traslado.");
      return;
    }
    const t = window.transfersMap.get(transferId);

    let [bodegasSnap, sucursalesSnap] = await Promise.all([
      db.collection("bodegas").get(),
      db.collection("sucursales").get()
    ]);

    let bodegasMap = { "principal": { name: "Bodega Principal", address: "Sede Principal" } };
    bodegasSnap.forEach(doc => bodegasMap[doc.id] = { name: doc.data().name + " (Bodega)", address: doc.data().location || "Sin dirección" });
    sucursalesSnap.forEach(doc => bodegasMap[doc.id] = { name: doc.data().name + " (Sucursal)", address: doc.data().address || doc.data().location || "Sin dirección" });

    let dateObj = t.date?.seconds ? new Date(t.date.seconds * 1000) : new Date();

    document.getElementById("eTransferDate").textContent = dateObj.toLocaleString();
    document.getElementById("eTransferSource").textContent = bodegasMap[t.sourceBodegaId] ? bodegasMap[t.sourceBodegaId].name : t.sourceBodegaId;
    // NUEVO: Direccion Origen
    document.getElementById("eTransferSourceAddr").textContent = bodegasMap[t.sourceBodegaId] ? bodegasMap[t.sourceBodegaId].address : "-";
    document.getElementById("eTransferDest").textContent = bodegasMap[t.destBodegaId] ? bodegasMap[t.destBodegaId].name : t.destBodegaId;
    document.getElementById("eTransferDestAddr").textContent = bodegasMap[t.destBodegaId] ? bodegasMap[t.destBodegaId].address : "-";
    document.getElementById("eTransferUser").textContent = t.user;

    let itemsBody = document.getElementById("eTransferItemsBody");
    itemsBody.innerHTML = "";

    let grandTotal = 0;

    if (t.items && t.items.length > 0) {
      for (const item of t.items) {
        let p = parseFloat(item.price) || 0;
        try {
          if (item.productId && item.productId !== "-") {
            let pDoc = await db.collection("inventoryProducts").doc(item.productId.toString()).get();
            if (pDoc.exists && pDoc.data().price !== undefined) {
              p = parseFloat(pDoc.data().price) || p;
            }
          }
        } catch (e) { console.error("Error fetching price for export", e); }

        let q = parseFloat(item.quantity) || 0;
        let sub = p * q;
        grandTotal += sub;

        let tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="border-bottom: 1px solid #eee; padding: 12px 8px; color: #444;">${item.idNum || "-"}</td>
          <td style="border-bottom: 1px solid #eee; padding: 12px 8px; color: #444;">${item.productName}</td>
          <td style="border-bottom: 1px solid #eee; padding: 12px 8px; text-align:center; color: #444;">Q${p.toFixed(2)}</td>
          <td style="border-bottom: 1px solid #eee; padding: 12px 8px; text-align:center; color: #444;">${q}</td>
          <td style="border-bottom: 1px solid #eee; padding: 12px 8px; text-align:right; color: #444;">Q${sub.toFixed(2)}</td>
        `;
        itemsBody.appendChild(tr);
      }
    } else {
      let p = parseFloat(t.price) || 0;
      let q = parseFloat(t.quantity) || 0;

      try {
        if (t.productId && t.productId !== "-") {
          let pDoc = await db.collection("inventoryProducts").doc(t.productId.toString()).get();
          if (pDoc.exists && pDoc.data().price !== undefined) {
            p = parseFloat(pDoc.data().price) || p;
          }
        }
      } catch (e) { console.error("Error fetching single item price", e); }
      let sub = p * q;
      grandTotal += sub;

      let tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="border-bottom: 1px solid #eee; padding: 12px 8px; color: #444;">-</td>
        <td style="border-bottom: 1px solid #eee; padding: 12px 8px; color: #444;">${t.productName || "Desconocido"}</td>
        <td style="border-bottom: 1px solid #eee; padding: 12px 8px; text-align:center; color: #444;">Q${p.toFixed(2)}</td>
        <td style="border-bottom: 1px solid #eee; padding: 12px 8px; text-align:center; color: #444;">${q}</td>
        <td style="border-bottom: 1px solid #eee; padding: 12px 8px; text-align:right; color: #444;">Q${sub.toFixed(2)}</td>
      `;
      itemsBody.appendChild(tr);
    }

    document.getElementById("eTransferTotalAmount").textContent = grandTotal.toFixed(2);

    const exportContainer = document.getElementById("exportTransferContainer");

    // Set base64 image to prevent tainted canvas
    if (typeof LOGO_BASE64 !== 'undefined') {
      document.getElementById("exportLogoImg").src = LOGO_BASE64;
    }

    exportContainer.style.display = "block";

    setTimeout(() => {
      html2canvas(exportContainer, { scale: 2, useCORS: true, allowTaint: true }).then((canvas) => {
        const link = document.createElement("a");
        link.download = "Constancia_Traslado_" + dateObj.toISOString().slice(0, 10) + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        exportContainer.style.display = "none";
      }).catch(err => {
        console.error("html2canvas error:", err);
        alert("Ocurrió un error al generar la imagen. Intente nuevamente.");
        exportContainer.style.display = "none";
      });
    }, 500); // 500ms allows logo to potentially load
  } catch (error) {
    console.error("Error al exportar traslado:", error);
    alert("Error al exportar traslado: " + error.message);
  }
}

/* =========================
   INICIALIZACIÓN DE LA PÁGINA
============================*/
window.onload = async function () {
  await initBodegas();
  showSection("products");
  populateProductSelects();
};
