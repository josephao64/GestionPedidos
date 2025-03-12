/*********************************************
 * facturas.js
 *
 * Administra la creación, edición, anulación, eliminación,
 * visualización de detalles y exportación de comprobante.
 * Se utiliza la colección "facturas" en Firestore.
 * Al guardar una factura (entrada de productos), se suma la cantidad
 * al inventario de la tienda seleccionada, sin afectar el inventario
 * de otras tiendas.
 *********************************************/

// Variables globales
let allProducts = [];
let invoiceItems = [];

// Cargar todos los productos (sin filtro) para poblar selects
async function loadAllProductsForInvoice(storeName = "") {
  try {
    let query = db.collection("productos").orderBy("codigo");
    if (storeName) {
      query = query.where("store", "==", storeName);
    }
    const snapshot = await query.get();
    allProducts = [];
    snapshot.forEach((doc) => {
      const prod = doc.data();
      prod.id = doc.id;
      allProducts.push(prod);
    });
  } catch (error) {
    console.error("Error al cargar productos para factura:", error);
  }
}

// Poblar select con productos
function populateProductSelect(select) {
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Seleccione producto";
  select.appendChild(defaultOption);
  allProducts.forEach((prod) => {
    const option = document.createElement("option");
    option.value = prod.id;
    option.textContent = `${prod.codigo} - ${prod.descripcion}`;
    select.appendChild(option);
  });
}

// Cargar tiendas para facturación
async function loadInvoiceStores() {
  try {
    const snapshot = await db.collection("tiendas").orderBy("nombre").get();
    const storeSelect = document.getElementById("invoiceStore");
    storeSelect.innerHTML = "<option value=''>Seleccione tienda</option>";
    snapshot.forEach(doc => {
      const store = doc.data();
      store.id = doc.id;
      const option = document.createElement("option");
      option.value = store.nombre;
      option.textContent = store.nombre;
      storeSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar tiendas para facturación:", error);
  }
}

// Mostrar formulario de agregar factura
async function showAddInvoiceForm() {
  document.getElementById("invoiceForm").reset();
  document.getElementById("invoiceId").value = "";
  document.querySelector("#invoiceItemsTable tbody").innerHTML = "";
  document.getElementById("invoiceOverallTotal").value = "";
  
  // Cargar tiendas
  await loadInvoiceStores();
  
  // Para usuarios no admin, fijar la tienda desde localStorage
  const loggedUser = localStorage.getItem("loggedUser") || "admin";
  if (loggedUser.toLowerCase() !== "admin") {
    const currentStore = localStorage.getItem("currentStore") || "";
    document.getElementById("invoiceStore").value = currentStore;
    await loadAllProductsForInvoice();
  } else {
    await loadAllProductsForInvoice();
  }
  
  invoiceItems = [];
  renderInvoiceItems();
  updateOverallTotal();
  new bootstrap.Modal(document.getElementById("invoiceModal")).show();
}

// Agregar fila de producto en la factura
function addInvoiceItem() {
  const tbody = document.querySelector("#invoiceItemsTable tbody");
  const row = tbody.insertRow();

  // Celda: Seleccionar producto
  const cellProduct = row.insertCell(0);
  const select = document.createElement("select");
  select.className = "form-select";
  populateProductSelect(select);
  select.addEventListener("change", function() {
    const selectedId = select.value;
    const priceInput = row.cells[2].querySelector("input[name='price']");
    if (selectedId) {
      const prod = allProducts.find(p => p.id === selectedId);
      if (prod) {
        priceInput.value = prod.precio;
      }
    } else {
      priceInput.value = "0";
    }
    updateInvoiceItemRow(row);
  });
  cellProduct.appendChild(select);

  // Celda: Cantidad
  const cellQuantity = row.insertCell(1);
  const quantityInput = document.createElement("input");
  quantityInput.type = "number";
  quantityInput.name = "quantity";
  quantityInput.className = "form-control";
  quantityInput.value = "0";
  quantityInput.addEventListener("input", function() {
    updateInvoiceItemRow(row);
  });
  cellQuantity.appendChild(quantityInput);

  // Celda: Precio Unitario (solo lectura)
  const cellPrice = row.insertCell(2);
  const priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.name = "price";
  priceInput.className = "form-control";
  priceInput.value = "0";
  priceInput.readOnly = true;
  cellPrice.appendChild(priceInput);

  // Celda: Total
  const cellTotal = row.insertCell(3);
  cellTotal.textContent = "0.00";

  // Celda: Acciones
  const cellActions = row.insertCell(4);
  const btnDelete = document.createElement("button");
  btnDelete.className = "btn btn-danger btn-sm";
  btnDelete.textContent = "Eliminar";
  btnDelete.addEventListener("click", function() {
    tbody.removeChild(row);
    updateOverallTotal();
  });
  cellActions.appendChild(btnDelete);

  updateInvoiceItemRow(row);
}

// Actualizar fila e invoiceItems
function updateInvoiceItemRow(row) {
  const quantity = parseFloat(row.cells[1].querySelector("input[name='quantity']").value);
  const price = parseFloat(row.cells[2].querySelector("input[name='price']").value);
  const total = isNaN(quantity * price) ? 0 : quantity * price;
  row.cells[3].textContent = total.toFixed(2);

  const tbody = document.querySelector("#invoiceItemsTable tbody");
  let items = [];
  for (let r of tbody.rows) {
    const prodSelect = r.cells[0].querySelector("select");
    const qty = parseFloat(r.cells[1].querySelector("input[name='quantity']").value);
    const prc = parseFloat(r.cells[2].querySelector("input[name='price']").value);
    const tot = isNaN(qty * prc) ? 0 : qty * prc;
    if (prodSelect && prodSelect.value) {
      items.push({ productId: prodSelect.value, quantity: qty, price: prc, total: tot });
    }
  }
  invoiceItems = items;
  updateOverallTotal();
}

// Actualizar total general
function updateOverallTotal() {
  const total = invoiceItems.reduce((sum, item) => sum + item.total, 0);
  document.getElementById("invoiceOverallTotal").value = total.toFixed(2);
}

// Renderizar ítems en la tabla de factura
function renderInvoiceItems() {
  const tbody = document.querySelector("#invoiceItemsTable tbody");
  tbody.innerHTML = "";
  invoiceItems.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${getProductText(item.productId)}</td>
      <td>${item.quantity}</td>
      <td>Q ${parseFloat(item.price).toFixed(2)}</td>
      <td>Q ${parseFloat(item.total).toFixed(2)}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="removeInvoiceItem(${index})">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Obtener descripción del producto
function getProductText(productId) {
  const prod = allProducts.find(p => p.id === productId);
  return prod ? `${prod.codigo} - ${prod.descripcion}` : productId;
}

// Eliminar ítem
function removeInvoiceItem(index) {
  invoiceItems.splice(index, 1);
  renderInvoiceItems();
  updateOverallTotal();
}

// Guardar o actualizar factura
async function saveInvoice() {
  try {
    const invoiceId = document.getElementById("invoiceId").value;
    const invoiceNumber = document.getElementById("invoiceNumber").value.trim();
    const invoiceDate = document.getElementById("invoiceDate").value;
    const invoiceStore = document.getElementById("invoiceStore").value;

    if (!invoiceNumber || !invoiceDate || !invoiceStore || invoiceItems.length === 0) {
      throw new Error("Complete todos los campos obligatorios y agregue al menos un producto.");
    }

    const overallTotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);

    const invoiceData = {
      invoiceNumber,
      invoiceDate: firebase.firestore.Timestamp.fromDate(new Date(invoiceDate)),
      invoiceStore,
      items: invoiceItems,
      overallTotal,
      status: "activo",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (invoiceId) {
      // Actualizar factura existente (sin modificar inventario)
      await db.collection("facturas").doc(invoiceId).update(invoiceData);
    } else {
      // Agregar factura nueva y sumar la cantidad ingresada al inventario de la tienda seleccionada
      const newInvoiceRef = await db.collection("facturas").add(invoiceData);
      for (const item of invoiceItems) {
        const prodRef = db.collection("productos").doc(item.productId);
        const prodDoc = await prodRef.get();
        if (prodDoc.exists) {
          const prodData = prodDoc.data();
          const currentStock = (prodData.stock && prodData.stock[invoiceStore]) || 0;
          const newStock = currentStock + item.quantity;
          const updatedStock = {
            ...prodData.stock,
            [invoiceStore]: newStock
          };
          await prodRef.update({ stock: updatedStock });
        }
      }
    }

    bootstrap.Modal.getInstance(document.getElementById("invoiceModal")).hide();
    loadInvoices();
  } catch (error) {
    console.error("Error al guardar la factura:", error);
    alert("Error al guardar la factura: " + error.message);
  }
}

// Cargar y renderizar facturas
async function loadInvoices() {
  try {
    const loggedUser = localStorage.getItem("loggedUser") || "admin";
    let query;
    if (loggedUser.toLowerCase() !== "admin") {
      const currentStore = localStorage.getItem("currentStore") || "";
      query = db.collection("facturas")
                .where("invoiceStore", "==", currentStore)
                .orderBy("invoiceDate", "desc");
    } else {
      query = db.collection("facturas").orderBy("invoiceDate", "desc");
    }
    const snapshot = await query.get();
    const tbody = document.querySelector("#facturasTable tbody");
    tbody.innerHTML = "";

    snapshot.forEach((doc) => {
      const invoice = doc.data();
      const row = tbody.insertRow();
      if (invoice.status === "anulado") {
        row.classList.add("table-warning");
      }
      row.insertCell(0).textContent = invoice.invoiceNumber;
      const dateStr = invoice.invoiceDate && invoice.invoiceDate.toDate
        ? invoice.invoiceDate.toDate().toLocaleDateString()
        : "";
      row.insertCell(1).textContent = dateStr;
      row.insertCell(2).textContent = invoice.invoiceStore || "-";
      row.insertCell(3).textContent = invoice.status ? invoice.status.toUpperCase() : "ACTIVO";
      const productsList = invoice.items.map(item => {
        const prod = allProducts.find(p => p.id === item.productId);
        return prod ? `${prod.codigo} - ${prod.descripcion}` : item.productId;
      }).join(", ");
      row.insertCell(4).textContent = productsList;
      row.insertCell(5).textContent = invoice.overallTotal;
      const cellActions = row.insertCell(6);
      cellActions.innerHTML = `
        <button class="btn btn-sm btn-info me-1" onclick="viewInvoiceDetails('${doc.id}')">
          <i class="fa-solid fa-eye"></i> Detalles
        </button>
        <button class="btn btn-sm btn-primary me-1" onclick="editInvoice('${doc.id}')">
          <i class="fa-solid fa-edit"></i> Editar
        </button>
        <button class="btn btn-sm btn-warning me-1" onclick="anularInvoice('${doc.id}')">
          <i class="fa-solid fa-ban"></i> Anular
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${doc.id}')">
          <i class="fa-solid fa-trash"></i> Eliminar
        </button>
      `;
    });
  } catch (error) {
    console.error("Error al cargar facturas:", error);
    alert("Error al cargar facturas: " + error.message);
  }
}

// Ver detalles de factura
async function viewInvoiceDetails(invoiceId) {
  try {
    const doc = await db.collection("facturas").doc(invoiceId).get();
    if (!doc.exists) {
      alert("Factura no encontrada.");
      return;
    }
    const invoice = doc.data();
    document.getElementById("detailInvoiceNumber").textContent = invoice.invoiceNumber;
    const dateStr = invoice.invoiceDate && invoice.invoiceDate.toDate
      ? invoice.invoiceDate.toDate().toLocaleDateString()
      : "";
    document.getElementById("detailInvoiceDate").textContent = dateStr;
    document.getElementById("detailInvoiceStore").textContent = invoice.invoiceStore || "-";
    document.getElementById("detailInvoiceStatus").textContent = invoice.status ? invoice.status.toUpperCase() : "ACTIVO";

    const tbody = document.getElementById("detailInvoiceItems");
    tbody.innerHTML = "";
    invoice.items.forEach(item => {
      const tr = document.createElement("tr");
      const prod = allProducts.find(p => p.id === item.productId);
      const prodText = prod ? `${prod.codigo} - ${prod.descripcion}` : item.productId;
      tr.innerHTML = `
        <td>${prodText}</td>
        <td>${item.quantity}</td>
        <td>Q ${parseFloat(item.price).toFixed(2)}</td>
        <td>Q ${parseFloat(item.total).toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });
    document.getElementById("detailInvoiceOverallTotal").textContent = parseFloat(invoice.overallTotal).toFixed(2);

    new bootstrap.Modal(document.getElementById("invoiceDetailsModal")).show();
  } catch (error) {
    console.error("Error al cargar detalles de factura:", error);
    alert("Error al cargar detalles: " + error.message);
  }
}

// Exportar comprobante como imagen
function exportInvoiceComprobante() {
  const container = document.getElementById("invoiceDetailsContainer");
  html2canvas(container).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "comprobante_factura.png";
    link.href = imgData;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// Editar factura
function editInvoice(invoiceId) {
  db.collection("facturas").doc(invoiceId).get()
    .then(doc => {
      if (!doc.exists) {
        alert("Factura no encontrada.");
        return;
      }
      const invoice = doc.data();
      document.getElementById("invoiceId").value = invoiceId;
      document.getElementById("invoiceNumber").value = invoice.invoiceNumber;
      document.getElementById("invoiceDate").value = new Date(invoice.invoiceDate.seconds * 1000)
                                                        .toISOString().slice(0,10);
      document.getElementById("invoiceStore").value = invoice.invoiceStore || "";
      loadAllProductsForInvoice(invoice.invoiceStore).then(() => {
        // Actualizar selects si fuera necesario
      });
      invoiceItems = invoice.items || [];
      renderInvoiceItems();
      updateOverallTotal();
      new bootstrap.Modal(document.getElementById("invoiceModal")).show();
    })
    .catch(error => {
      alert("Error al cargar factura: " + error.message);
    });
}

// Eliminar factura
async function deleteInvoice(invoiceId) {
  if (!confirm("¿Está seguro de eliminar esta factura?")) return;
  try {
    await db.collection("facturas").doc(invoiceId).delete();
    loadInvoices();
  } catch (error) {
    alert("Error al eliminar la factura: " + error.message);
  }
}

// Anular factura y revertir inventario (se resta la entrada)
async function anularInvoice(invoiceId) {
  if (!confirm("¿Está seguro de anular esta factura? Se revertirá el inventario.")) return;
  try {
    const doc = await db.collection("facturas").doc(invoiceId).get();
    if (!doc.exists) {
      alert("Factura no encontrada.");
      return;
    }
    const invoice = doc.data();
    if (invoice.status !== "activo") {
      alert("La factura ya se encuentra anulada.");
      return;
    }
    // Revertir inventario: se resta la cantidad ingresada para la tienda seleccionada
    for (const item of invoice.items) {
      const prodRef = db.collection("productos").doc(item.productId);
      const prodDoc = await prodRef.get();
      if (prodDoc.exists) {
        const prod = prodDoc.data();
        let updatedStock = prod.stock || {};
        updatedStock[invoice.invoiceStore] = (updatedStock[invoice.invoiceStore] || 0) - item.quantity;
        await prodRef.update({ stock: updatedStock });
      }
    }
    // Actualizar estado a "anulado"
    await db.collection("facturas").doc(invoiceId).update({ status: "anulado" });
    alert("Factura anulada y el inventario fue revertido.");
    loadInvoices();
  } catch (error) {
    alert("Error al anular factura: " + error.message);
  }
}

// Inicialización: cargar productos y facturas
document.addEventListener("DOMContentLoaded", async () => {
  await loadAllProductsForInvoice();
  loadInvoices();
});

// (La función exportInvoicesImage() se implementa según tus necesidades para exportar el listado)
