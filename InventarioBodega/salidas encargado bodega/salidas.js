/* salidas.js — versión completa con rediseño móvil, validaciones, prevención de duplicados,
   transacciones en Firestore, pickers con búsqueda, stepper de cantidad, exportaciones
   y SIN scripts inline (listo para CSP estricta). */

/* =========================
   FIREBASE (Centralizado)
   ========================= */
// db se hereda de window.db inicializado en connection.js
if (!window.db) {
  console.error("❌ Firebase no ha sido inicializado. Asegúrate de incluir connection.js");
}
// db se hereda del ámbito global (connection.js)

/* =========================
   UI Helpers (SweetAlert2)
   ========================= */
const Toast = Swal.mixin({
  toast: true,
  position: "top",
  showConfirmButton: false,
  timer: 2300,
  timerProgressBar: true
});
const notifySuccess = (m) => Toast.fire({ icon: "success", title: m });
const notifyInfo    = (m) => Toast.fire({ icon: "info",    title: m });
const notifyError   = (m) => Toast.fire({ icon: "error",   title: m });

async function confirmDialog({ title, html, confirmText = "Sí", cancelText = "Cancelar", icon = "question" }) {
  const res = await Swal.fire({
    title, html, icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    allowOutsideClick: false
  });
  return res.isConfirmed;
}

/* =========================
   SECCIONES
   ========================= */
function showSection(section) {
  ["registerSection", "historySection", "stockSection", "reportsSection"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  if (section === "register") {
    document.getElementById("registerSection").style.display = "block";
  } else if (section === "history") {
    document.getElementById("historySection").style.display = "block";
    loadOutgoingHistory();
  } else if (section === "stock") {
    document.getElementById("stockSection").style.display = "block";
    loadStock();
  } else if (section === "reports") {
    document.getElementById("reportsSection").style.display = "block";
  }
}

/* =========================
   PICKERS: productos y sucursales con búsqueda
   ========================= */
let productsCache = []; // {id,name,stock}
let branchesCache = []; // {name}

async function populateOutgoingProducts() {
  try {
    const select = document.getElementById("outgoingProduct");
    if (select) select.innerHTML = "";
    productsCache = [];
    const snap = await db.collection("inventoryProducts").get();
    snap.forEach(doc => {
      const p = doc.data();
      productsCache.push({ id: doc.id, name: p.name || doc.id, stock: Number(p.stock || 0) });
      if (select) {
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = p.name || doc.id;
        select.appendChild(opt);
      }
    });
    buildProductPicker();
  } catch (e) {
    console.error("Error al cargar productos:", e);
    notifyError("Error al cargar productos");
  }
}

async function populateBranches() {
  try {
    const selectOut = document.getElementById("outgoingBranch");
    const selectRep = document.getElementById("reportBranch");
    if (selectOut) selectOut.innerHTML = "";
    if (selectRep) selectRep.innerHTML = '<option value="">Todas</option>';
    branchesCache = [];

    const snap = await db.collection("sucursales").get();
    snap.forEach(doc => {
      const b = doc.data();
      branchesCache.push({ name: b.name });
      if (selectOut) {
        const optOut = document.createElement("option");
        optOut.value = b.name;
        optOut.textContent = b.name;
        selectOut.appendChild(optOut);
      }
      if (selectRep) {
        const optRep = document.createElement("option");
        optRep.value = b.name;
        optRep.textContent = b.name;
        selectRep.appendChild(optRep);
      }
    });
    buildBranchPicker();
  } catch (e) {
    console.error("Error al cargar sucursales:", e);
    notifyError("Error al cargar sucursales");
  }
}

function buildProductPicker() {
  const list = document.getElementById("productPickerList");
  if (!list) return;
  list.innerHTML = "";
  productsCache
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(p => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
      btn.dataset.id = p.id;
      btn.dataset.name = p.name;
      btn.dataset.stock = p.stock;
      btn.innerHTML = `<span><i class="fa-solid fa-box me-2"></i>${p.name}</span>
                       <span class="badge bg-secondary">Stock ${p.stock}</span>`;
      btn.addEventListener("click", () => selectProductFromPicker(p));
      list.appendChild(btn);
    });
}

function buildBranchPicker() {
  const list = document.getElementById("branchPickerList");
  if (!list) return;
  list.innerHTML = "";
  branchesCache
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(b => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-group-item list-group-item-action";
      btn.dataset.name = b.name;
      btn.innerHTML = `<i class="fa-solid fa-store me-2"></i>${b.name}`;
      btn.addEventListener("click", () => selectBranchFromPicker(b.name));
      list.appendChild(btn);
    });
}

/* Búsqueda en pickers (delegada a nivel documento) */
document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "productSearchInput") {
    const q = (e.target.value || "").toLowerCase();
    document.querySelectorAll("#productPickerList .list-group-item").forEach(el => {
      const name = (el.dataset.name || "").toLowerCase();
      el.style.display = name.includes(q) ? "" : "none";
    });
  }
  if (e.target && e.target.id === "branchSearchInput") {
    const q = (e.target.value || "").toLowerCase();
    document.querySelectorAll("#branchPickerList .list-group-item").forEach(el => {
      const name = (el.dataset.name || "").toLowerCase();
      el.style.display = name.includes(q) ? "" : "none";
    });
  }
});

/* Selección desde pickers */
function selectProductFromPicker(p) {
  const sel = document.getElementById("outgoingProduct");
  if (sel) sel.value = p.id;
  window.selectedProductName = p.name;
  updateProductDisplay(p.name, p.stock);
  const modal = document.getElementById("productPickerModal");
  if (modal && typeof bootstrap !== "undefined") {
    const inst = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
    inst && inst.hide();
  }
  updateSaveButtonState();
}

function selectBranchFromPicker(name) {
  const sel = document.getElementById("outgoingBranch");
  if (sel) sel.value = name;
  window.selectedBranchName = name;
  const txt = document.getElementById("selectedBranchText");
  if (txt) txt.textContent = name;
  const help = document.getElementById("branchHelper");
  if (help) help.style.display = "none";
  const modal = document.getElementById("branchPickerModal");
  if (modal && typeof bootstrap !== "undefined") {
    const inst = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
    inst && inst.hide();
  }
  updateSaveButtonState();
}

function updateProductDisplay(name, stock) {
  const txt = document.getElementById("selectedProductText");
  const badge = document.getElementById("selectedProductStockBadge");
  if (txt) txt.textContent = name;
  if (badge) {
    if (typeof stock === "number") {
      badge.textContent = `Stock: ${stock}`;
      badge.style.display = "";
    } else {
      badge.style.display = "none";
    }
  }
  const help = document.getElementById("productHelper");
  if (help) help.style.display = "none";
}

/* =========================
   VALIDACIONES + estado botón Guardar
   ========================= */
function isFutureDate(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return true;
  const [Y, M, D] = yyyy_mm_dd.split("-").map(n => parseInt(n, 10));
  const d = new Date(Y, M - 1, D);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() > today.getTime();
}

function validateForm() {
  const form = document.getElementById("outgoingForm");
  const date = document.getElementById("outgoingDate");
  const branch = document.getElementById("outgoingBranch");
  const product = document.getElementById("outgoingProduct");
  const qty = document.getElementById("outgoingQuantity");
  const userSel = document.getElementById("outgoingUser");

  if (form) form.classList.add("was-validated");

  // helpers visibles
  const branchHelp = document.getElementById("branchHelper");
  if (branchHelp) branchHelp.style.display = branch && branch.value ? "none" : "block";
  const productHelp = document.getElementById("productHelper");
  if (productHelp) productHelp.style.display = product && product.value ? "none" : "block";
  const userHelp = document.getElementById("userHelper");
  if (userHelp) userHelp.style.display = userSel && userSel.value ? "none" : "block";

  if (!date || !date.value || isFutureDate(date.value)) return false;
  if (!branch || !branch.value) return false;
  if (!product || !product.value) return false;
  const q = Number(qty && qty.value);
  if (Number.isNaN(q) || q <= 0) return false;
  if (!userSel || !userSel.value) return false;

  return true;
}

function updateSaveButtonState() {
  const enabled = validateForm();
  const btnDesk = document.getElementById("btnSaveOutgoing");
  const btnMob  = document.getElementById("btnSaveOutgoingMobile");
  if (btnDesk) btnDesk.disabled = !enabled;
  if (btnMob)  btnMob.disabled  = !enabled;
}

/* Stepper cantidad */
function incQuantity() {
  const el = document.getElementById("outgoingQuantity");
  const step = Number(el?.step || 1);
  const val = Number(el?.value || 0) + step;
  if (el) el.value = val.toFixed(2);
  updateSaveButtonState();
}
function decQuantity() {
  const el = document.getElementById("outgoingQuantity");
  const step = Number(el?.step || 1);
  const min  = Number(el?.min || 0.01);
  const next = Math.max(Number(el?.value || 0) - step, min);
  if (el) el.value = next.toFixed(2);
  updateSaveButtonState();
}

/* Sincroniza radio buttons -> select usuario */
function syncUserSelectFromRadios() {
  const checked = document.querySelector('input[name="outgoingUserRadio"]:checked');
  const sel = document.getElementById("outgoingUser");
  if (sel) sel.value = checked ? checked.value : "";
  updateSaveButtonState();
}
document.addEventListener("change", (e) => {
  if (e.target && e.target.name === "outgoingUserRadio") syncUserSelectFromRadios();
  if (e.target && (e.target.id === "outgoingDate" || e.target.id === "outgoingQuantity")) updateSaveButtonState();
});
document.addEventListener("input", (e) => {
  if (e.target && (e.target.id === "outgoingQuantity" || e.target.id === "outgoingComments")) updateSaveButtonState();
});

/* =========================
   PREVENCIÓN DE DUPLICADOS
   ========================= */
async function findPotentialDuplicate({ dateObj, branch, productId, quantity, user, comments }) {
  const start = new Date(dateObj); start.setHours(0, 0, 0, 0);
  const end   = new Date(dateObj); end.setHours(23, 59, 59, 999);

  const qs = await db.collection("inventoryMovements")
    .where("type", "==", "salida")
    .where("date", ">=", start)
    .where("date", "<=", end)
    .orderBy("date", "asc")
    .get();

  for (const d of qs.docs) {
    const m = d.data();
    if (
      m.branch === branch &&
      m.productId === productId &&
      Number(m.quantity) === Number(quantity) &&
      m.user === user &&
      (m.comments || "").trim().toLowerCase() === (comments || "").trim().toLowerCase()
    ) {
      return { id: d.id, data: m };
    }
  }
  return null;
}

/* =========================
   GUARDAR (TRANSACCIÓN)
   ========================= */
let isSubmitting = false;
async function saveOutgoing() {
  if (isSubmitting) return;

  const valid = validateForm();
  if (!valid) {
    notifyInfo("Revisa los campos resaltados.");
    return;
  }

  const dateStr = document.getElementById("outgoingDate").value;
  const [Y, M, D] = dateStr.split("-").map(n => parseInt(n, 10));
  const dateObj = new Date(Y, M - 1, D);
  const branch = document.getElementById("outgoingBranch").value;
  const productId = document.getElementById("outgoingProduct").value;
  const quantity = parseFloat(document.getElementById("outgoingQuantity").value);
  const user = document.getElementById("outgoingUser").value;
  const comments = (document.getElementById("outgoingComments").value || "").trim();

  const productName = window.selectedProductName || (productsCache.find(p => p.id === productId)?.name || productId);

  const confirmSave = await confirmDialog({
    title: "Confirmar salida",
    html: `<div class="text-start">
             <p class="mb-1"><strong>Fecha:</strong> ${dateStr}</p>
             <p class="mb-1"><strong>Sucursal:</strong> ${branch}</p>
             <p class="mb-1"><strong>Producto:</strong> ${productName}</p>
             <p class="mb-1"><strong>Cantidad:</strong> ${quantity}</p>
             <p class="mb-1"><strong>Usuario:</strong> ${user}</p>
             ${comments ? `<p class="mb-1"><strong>Comentarios:</strong> ${comments}</p>` : ""}
           </div>`,
    confirmText: "Registrar"
  });
  if (!confirmSave) return;

  // Duplicado
  const dup = await findPotentialDuplicate({ dateObj, branch, productId, quantity, user, comments });
  if (dup) {
    const proceed = await confirmDialog({
      title: "Posible registro duplicado",
      html: `<p class="mb-2">Ya hay una salida con los mismos datos en esa fecha.</p>
             <p class="small text-muted">Continuar descontará stock nuevamente.</p>`,
      icon: "warning",
      confirmText: "Registrar de todos modos",
      cancelText: "Cancelar"
    });
    if (!proceed) return;
  }

  // UI lock (desktop/móvil)
  isSubmitting = true;
  const btnDesk = document.getElementById("btnSaveOutgoing");
  const btnMob  = document.getElementById("btnSaveOutgoingMobile");
  const spinnerDesk = document.getElementById("saveSpinner");
  const spinnerMob  = document.getElementById("saveSpinnerMobile");
  if (btnDesk) btnDesk.disabled = true;
  if (btnMob)  btnMob.disabled  = true;
  if (spinnerDesk) spinnerDesk.classList.remove("d-none");
  if (spinnerMob)  spinnerMob.classList.remove("d-none");

  try {
    await db.runTransaction(async (t) => {
      const productRef = db.collection("inventoryProducts").doc(productId);
      const snap = await t.get(productRef);
      if (!snap.exists) throw new Error("Producto no encontrado.");
      const data = snap.data();
      const currentStock = Number(data.stock || 0);
      if (quantity > currentStock) throw new Error(`Stock insuficiente. Disponible: ${currentStock}`);

      const movementRef = db.collection("inventoryMovements").doc();
      t.set(movementRef, {
        productId,
        type: "salida",
        quantity,
        date: dateObj,
        user,
        comments,
        branch,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      t.update(productRef, { stock: currentStock - quantity });
    });

    notifySuccess("Salida registrada correctamente.");
    // Reset formulario
    document.getElementById("outgoingForm").reset();
    setDefaultDate();
    window.selectedProductName = undefined;
    const prodTxt = document.getElementById("selectedProductText");
    if (prodTxt) prodTxt.textContent = "Seleccione el producto";
    const badge = document.getElementById("selectedProductStockBadge");
    if (badge) badge.style.display = "none";
    const branchTxt = document.getElementById("selectedBranchText");
    if (branchTxt) branchTxt.textContent = "Seleccione la sucursal";
    updateSaveButtonState();

    // Refrescos si corresponde
    if (document.getElementById("historySection").style.display !== "none") loadOutgoingHistory();
    if (document.getElementById("stockSection").style.display !== "none")   loadStock();

  } catch (err) {
    console.error("Error al guardar salida:", err);
    notifyError("Error al guardar salida: " + (err.message || err));
  } finally {
    isSubmitting = false;
    if (btnDesk) btnDesk.disabled = false;
    if (btnMob)  btnMob.disabled  = false;
    if (spinnerDesk) spinnerDesk.classList.add("d-none");
    if (spinnerMob)  spinnerMob.classList.add("d-none");
  }
}

/* =========================
   HISTORIAL
   ========================= */
async function loadOutgoingHistory() {
  try {
    const tbody = document.querySelector("#outgoingTable tbody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Cargando…</td></tr>';

    const snap = await db.collection("inventoryMovements")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    tbody.innerHTML = "";
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Sin movimientos</td></tr>';
      return;
    }

    for (let docu of snap.docs) {
      const m = docu.data();
      if (m.type !== "salida") continue;
      const tr = tbody.insertRow();

      const d = m.date ? (m.date.seconds ? new Date(m.date.seconds * 1000) : new Date(m.date)) : null;
      tr.insertCell(0).textContent = d ? d.toLocaleDateString() : "";
      tr.insertCell(1).textContent = m.branch || "";

      const prodSnap = await db.collection("inventoryProducts").doc(m.productId).get();
      tr.insertCell(2).textContent = prodSnap.exists ? (prodSnap.data().name || "—") : "No encontrado";

      tr.insertCell(3).textContent = m.quantity;
      tr.insertCell(4).textContent = m.user;
      tr.insertCell(5).textContent = m.comments || "";

      const actionsCell = tr.insertCell(6);
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-sm btn-danger';
      delBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Eliminar';
      delBtn.addEventListener('click', () =>
        deleteMovement(docu.id, (prodSnap.data()||{}).name||"", Number(m.quantity)||0)
      );
      actionsCell.appendChild(delBtn);
    }
  } catch (e) {
    console.error("Error al cargar historial:", e);
    notifyError("Error al cargar historial");
  }
}

/* =========================
   ELIMINAR MOVIMIENTO
   ========================= */
async function deleteMovement(movementId, productName = "", qty = 0) {
  const ok = await confirmDialog({
    title: "Eliminar salida",
    html: `<p>¿Eliminar el movimiento de <strong>${productName || "producto"}</strong> por <strong>${qty}</strong> unidades?</p>
           <p class="small text-muted">Se repondrá el stock automáticamente.</p>`,
    icon: "warning",
    confirmText: "Sí, eliminar"
  });
  if (!ok) return;

  try {
    const ref = db.collection("inventoryMovements").doc(movementId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Movimiento no encontrado.");
    const m = snap.data();

    await db.runTransaction(async (t) => {
      const prodRef = db.collection("inventoryProducts").doc(m.productId);
      const prodSnap = await t.get(prodRef);
      if (!prodSnap.exists) throw new Error("Producto no encontrado.");
      const newStock = Number(prodSnap.data().stock || 0) + Number(m.quantity || 0);
      t.update(prodRef, { stock: newStock });
      t.delete(ref);
    });

    notifySuccess("Movimiento eliminado y stock repuesto.");
    loadOutgoingHistory();
    loadStock();
  } catch (e) {
    console.error("Error al eliminar movimiento:", e);
    notifyError("Error al eliminar: " + (e.message || e));
  }
}

/* =========================
   STOCK
   ========================= */
async function loadStock() {
  try {
    const tbody = document.querySelector("#stockTable tbody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Cargando…</td></tr>';

    const snap = await db.collection("inventoryProducts").get();
    tbody.innerHTML = "";
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Sin productos</td></tr>';
      return;
    }

    snap.forEach(doc => {
      const p = doc.data();
      const tr = tbody.insertRow();
      tr.insertCell(0).textContent = p.idNum ? p.idNum : doc.id;
      tr.insertCell(1).textContent = p.name || "—";
      tr.insertCell(2).textContent = Number(p.stock || 0);
    });
  } catch (e) {
    console.error("Error al cargar stock:", e);
    notifyError("Error al cargar stock");
  }
}

/* =========================
   REPORTES
   ========================= */
async function generateOutgoingReport() {
  try {
    const startDateInput = document.getElementById("reportStartDate").value;
    const endDateInput   = document.getElementById("reportEndDate").value;
    const branchFilter   = document.getElementById("reportBranch").value;

    if (!startDateInput || !endDateInput) {
      notifyInfo("Selecciona rango de fechas.");
      return;
    }

    const startDate = new Date(startDateInput);
    const endDate   = new Date(endDateInput);
    endDate.setHours(23, 59, 59, 999);

    let query = db.collection("inventoryMovements")
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .orderBy("date", "asc");

    const snap = await query.get();

    const tbody = document.querySelector("#reportOutgoingTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    let chartData = {};
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Sin datos en el rango</td></tr>';
    } else {
      for (const d of snap.docs) {
        const m = d.data();
        if (m.type !== "salida") continue;
        if (branchFilter && m.branch !== branchFilter) continue;

        const dd = m.date ? (m.date.seconds ? new Date(m.date.seconds * 1000) : new Date(m.date)) : null;
        const dateStr = dd ? dd.toLocaleDateString() : "";

        const tr = tbody.insertRow();
        tr.insertCell(0).textContent = dateStr;
        tr.insertCell(1).textContent = m.branch || "";

        const prodDoc = await db.collection("inventoryProducts").doc(m.productId).get();
        tr.insertCell(2).textContent = prodDoc.exists ? (prodDoc.data().name || "No encontrado") : "No encontrado";

        tr.insertCell(3).textContent = m.quantity;
        tr.insertCell(4).textContent = m.user;
        tr.insertCell(5).textContent = m.comments || "";

        chartData[dateStr] = (chartData[dateStr] || 0) + Number(m.quantity || 0);
      }
    }

    const ctxEl = document.getElementById("reportChart");
    if (!ctxEl) return;
    const ctx = ctxEl.getContext("2d");
    if (window.outgoingChart && window.outgoingChart.destroy) window.outgoingChart.destroy();
    window.outgoingChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(chartData),
        datasets: [{
          label: "Cantidad de Salidas",
          data: Object.values(chartData),
          backgroundColor: "rgba(75, 192, 192, 0.6)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 1
        }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  } catch (e) {
    console.error("Error al generar reporte:", e);
    notifyError("Error al generar reporte");
  }
}

/* =========================
   EXPORTACIONES (Imagen, PDF, CSV)
   ========================= */

/* Exportar a Imagen (canvas programático, sin capturas borrosas) */
function exportReportToImage() {
  const table = document.getElementById("reportOutgoingTable");
  if (!table) { notifyInfo("No se encontró la tabla de reporte."); return; }

  const rows = table.rows;
  if (!rows.length) { notifyInfo("La tabla de reporte está vacía."); return; }

  const startDate = document.getElementById("reportStartDate").value;
  const endDate   = document.getElementById("reportEndDate").value;
  let titleText = "Reportes de Salidas de Bodega";
  if (startDate && endDate) titleText += ` (${startDate} - ${endDate})`;

  const titleFont = "bold 20px Arial";
  const titleHeight = 50;
  const cellPadding = 10;
  const tableFont = "16px Arial";
  const rowHeight = 30;

  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = tableFont;

  const numCols = rows[0].cells.length;
  const colWidths = [];
  for (let col = 0; col < numCols; col++) {
    let maxWidth = 0;
    for (let r = 0; r < rows.length; r++) {
      const cellText = rows[r].cells[col].innerText;
      const metrics = tempCtx.measureText(cellText);
      if (metrics.width > maxWidth) maxWidth = metrics.width;
    }
    colWidths[col] = maxWidth + cellPadding * 2;
  }

  const tableWidth = colWidths.reduce((t, w) => t + w, 0);
  const tableHeight = rowHeight * rows.length;
  const canvasWidth = tableWidth;
  const canvasHeight = titleHeight + tableHeight;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  // Fondo
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Título
  ctx.font = titleFont;
  ctx.fillStyle = "#333";
  const titleMetrics = ctx.measureText(titleText);
  const titleX = (canvasWidth - titleMetrics.width) / 2;
  const titleY = titleHeight / 2;
  ctx.textBaseline = "middle";
  ctx.fillText(titleText, titleX, titleY);
  ctx.beginPath();
  ctx.moveTo(0, titleHeight - 5);
  ctx.lineTo(canvasWidth, titleHeight - 5);
  ctx.strokeStyle = "#ccc";
  ctx.stroke();

  // Tabla
  let y = titleHeight;
  for (let r = 0; r < rows.length; r++) {
    let x = 0;

    // Rayado
    if (r === 0) {
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(0, y, canvasWidth, rowHeight);
    } else if (r % 2 === 1) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, y, canvasWidth, rowHeight);
    }

    for (let c = 0; c < numCols; c++) {
      // Borde de celda
      ctx.strokeStyle = "#ddd";
      ctx.strokeRect(x, y, colWidths[c], rowHeight);

      // Texto
      const cellText = rows[r].cells[c].innerText;
      ctx.fillStyle = "#000";
      ctx.textBaseline = "middle";

      if (r === 0) {
        ctx.font = "bold 16px Arial";
        const w = ctx.measureText(cellText).width;
        const textX = x + (colWidths[c] - w) / 2;
        ctx.fillText(cellText, textX, y + rowHeight / 2);
      } else if (c === 3) { // Cantidad centrada
        ctx.font = "16px Arial";
        const w = ctx.measureText(cellText).width;
        const textX = x + (colWidths[c] - w) / 2;
        ctx.fillText(cellText, textX, y + rowHeight / 2);
      } else {
        ctx.font = "16px Arial";
        ctx.fillText(cellText, x + cellPadding, y + rowHeight / 2);
      }

      x += colWidths[c];
    }
    y += rowHeight;
  }

  const imageData = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = imageData;
  link.download = "reporte_salidas.png";
  link.click();
}

/* Exportar a PDF (jsPDF + autoTable) */
function exportReportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 10;

  // Título y fecha
  doc.setFontSize(18);
  doc.text("Reporte de Inventario y Salidas de Bodega", pageWidth / 2, y, { align: "center" });
  y += 10;
  doc.setFontSize(12);
  const currentDate = new Date().toLocaleDateString();
  doc.text("Fecha: " + currentDate, pageWidth / 2, y, { align: "center" });
  y += 10;

  // Stock
  doc.setFontSize(14);
  doc.text("Stock Actual de Inventario", 14, y);
  y += 5;

  const stockTable = document.getElementById("stockTable");
  let stockHeaders = [];
  let stockData = [];
  if (stockTable) {
    stockTable.querySelectorAll("thead th").forEach(h => stockHeaders.push(h.innerText));
    stockTable.querySelectorAll("tbody tr").forEach(row => {
      const rowData = [];
      row.querySelectorAll("td").forEach(col => rowData.push(col.innerText));
      stockData.push(rowData);
    });
  }
  if (stockData.length > 0) {
    doc.autoTable({ head: [stockHeaders], body: stockData, startY: y, theme: "grid" });
    y = doc.autoTable.previous.finalY + 10;
  } else {
    doc.text("No se encontró información de stock actual.", 14, y);
    y += 10;
  }

  // Salidas
  doc.setFontSize(14);
  doc.text("Salidas de Bodega", 14, y);
  y += 5;

  const startDate = document.getElementById("reportStartDate")?.value || "N/A";
  const endDate   = document.getElementById("reportEndDate")?.value || "N/A";
  const rangeText = `Fecha Inicio: ${startDate} - Fecha Fin: ${endDate}`;
  doc.setFontSize(12);
  doc.text(rangeText, 14, y);
  y += 10;

  const reportTable = document.getElementById("reportOutgoingTable");
  let reportHeaders = [];
  let reportData = [];
  if (reportTable) {
    reportTable.querySelectorAll("thead th").forEach(h => reportHeaders.push(h.innerText));
    reportTable.querySelectorAll("tbody tr").forEach(row => {
      const rowData = [];
      row.querySelectorAll("td").forEach(col => rowData.push(col.innerText));
      reportData.push(rowData);
    });
  }
  if (reportData.length > 0) {
    doc.autoTable({ head: [reportHeaders], body: reportData, startY: y, theme: "grid" });
  } else {
    doc.text("No se encontró información de salidas.", 14, y);
  }

  doc.save("reporte_salidas.pdf");
}

/* Exportar a Excel (CSV) */
function exportReportToExcel() {
  const table = document.getElementById("reportOutgoingTable");
  if (!table || !table.rows.length) {
    notifyInfo("La tabla de reporte está vacía.");
    return;
  }
  const csv = [];
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    const cols = row.querySelectorAll("td, th");
    const rowData = [];
    for (let j = 0; j < cols.length; j++) {
      let cellText = cols[j].innerText;
      if (i === 0 && j === 0) cellText = "Fecha de Salida"; // header más claro
      rowData.push('"' + cellText.replace(/"/g, '""') + '"');
    }
    csv.push(rowData.join(","));
  }
  const csvContent = csv.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reporte_salidas.csv";
  link.click();
  URL.revokeObjectURL(url);
}

/* =========================
   INIT (sin inline)
   ========================= */
function setDefaultDate() {
  const input = document.getElementById("outgoingDate");
  if (!input) return;
  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  const str = `${yyyy}-${mm}-${dd}`;
  input.value = str;
  input.max = str; // evita fechas futuras
}

window.onload = async function () {
  showSection("register");
  setDefaultDate();
  await populateOutgoingProducts();
  await populateBranches();
  updateSaveButtonState();

  // Validación viva
  ["outgoingDate", "outgoingQuantity", "outgoingComments"].forEach(id => {
    const el = document.getElementById(id);
    el && el.addEventListener("input", updateSaveButtonState);
  });
};

/* =========================
   Listeners de UI (equivalentes a los antiguos onclick)
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
  // Navegación secciones (móvil + desktop)
  document.querySelectorAll('.js-nav-section').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      showSection(section);

      // Cerrar offcanvas si está abierto (móvil)
      const offcanvasEl = document.getElementById('offcanvasSidebar');
      if (offcanvasEl && typeof bootstrap !== 'undefined') {
        const instance = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if (instance) instance.hide();
      }
    });
  });

  // Botones cantidad
  const btnDec = document.getElementById('btnDecQty');
  const btnInc = document.getElementById('btnIncQty');
  if (btnDec) btnDec.addEventListener('click', decQuantity);
  if (btnInc) btnInc.addEventListener('click', incQuantity);

  // Guardar (desktop y móvil)
  const btnSave = document.getElementById('btnSaveOutgoing');
  const btnSaveMobile = document.getElementById('btnSaveOutgoingMobile');
  if (btnSave) btnSave.addEventListener('click', saveOutgoing);
  if (btnSaveMobile) btnSaveMobile.addEventListener('click', saveOutgoing);

  // Historial / Stock refrescar
  const btnRefreshHistory = document.getElementById('btnRefreshHistory');
  const btnRefreshStock = document.getElementById('btnRefreshStock');
  if (btnRefreshHistory) btnRefreshHistory.addEventListener('click', loadOutgoingHistory);
  if (btnRefreshStock) btnRefreshStock.addEventListener('click', loadStock);

  // Reportes
  const btnGenerateReport = document.getElementById('btnGenerateReport');
  const btnExportImg = document.getElementById('btnExportImg');
  const btnExportPDF = document.getElementById('btnExportPDF');
  const btnExportExcel = document.getElementById('btnExportExcel');
  if (btnGenerateReport) btnGenerateReport.addEventListener('click', generateOutgoingReport);
  if (btnExportImg) btnExportImg.addEventListener('click', exportReportToImage);
  if (btnExportPDF) btnExportPDF.addEventListener('click', exportReportToPDF);
  if (btnExportExcel) btnExportExcel.addEventListener('click', exportReportToExcel);
});

/* =========================
   Exponer funciones (por si las necesitas en consola)
   ========================= */
window.showSection = showSection;
window.saveOutgoing = saveOutgoing;
window.loadOutgoingHistory = loadOutgoingHistory;
window.loadStock = loadStock;
window.generateOutgoingReport = generateOutgoingReport;
window.exportReportToImage = exportReportToImage;
window.exportReportToPDF = exportReportToPDF;
window.exportReportToExcel = exportReportToExcel;
window.deleteMovement = deleteMovement;
window.incQuantity = incQuantity;
window.decQuantity = decQuantity;
