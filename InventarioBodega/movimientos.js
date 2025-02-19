/* movimientos.js */

/* =================================
   MOVIMIENTOS CON FILTROS
=================================*/

// Función para mostrar el formulario de agregar movimiento
function showAddMovementForm() {
    document.getElementById("movementId").value = "";
    populateProductSelects(); // Función global definida en inventario.js
    document.getElementById("movementQuantity").value = "";
    document.getElementById("movementUser").value = "";
    document.getElementById("movementReason").value = "";
    document.getElementById("movementComments").value = "";
    document.getElementById("movementModalLabel").textContent =
      "Registrar Movimiento";
  }
  
  // Función para guardar (o actualizar) un movimiento
  async function saveMovement() {
    try {
      let movementId = document.getElementById("movementId").value;
      let productId = document.getElementById("movementProductSelect").value;
      let type = document.getElementById("movementType").value;
      let quantity = parseFloat(
        document.getElementById("movementQuantity").value
      );
      let user = document.getElementById("movementUser").value;
      let reason = document.getElementById("movementReason").value;
      let comments = document.getElementById("movementComments").value;
  
      if (isNaN(quantity) || quantity <= 0)
        throw new Error("La cantidad debe ser un número positivo.");
  
      let productRef = db.collection("inventoryProducts").doc(productId);
      let productDoc = await productRef.get();
      let product = productDoc.exists ? productDoc.data() : null;
  
      if (movementId) {
        let oldMovementDoc = await db
          .collection("inventoryMovements")
          .doc(movementId)
          .get();
        if (!oldMovementDoc.exists)
          throw new Error("Movimiento no encontrado");
        let oldMovement = oldMovementDoc.data();
        let oldEffect =
          oldMovement.type === "entrada" || oldMovement.type === "ajuste"
            ? oldMovement.quantity
            : -oldMovement.quantity;
        let newEffect =
          type === "entrada" || type === "ajuste" ? quantity : -quantity;
        let diff = newEffect - oldEffect;
        if (product) {
          let newStock = product.stock + diff;
          if (newStock < 0)
            throw new Error("No hay suficiente stock para la actualización.");
          await productRef.update({ stock: newStock });
        }
        await db.collection("inventoryMovements").doc(movementId).update({
          type: type,
          quantity: quantity,
          date: firebase.firestore.FieldValue.serverTimestamp(),
          user: user,
          reason: reason,
          comments: comments,
        });
      } else {
        if (product) {
          let newStock = product.stock;
          if (type === "entrada" || type === "ajuste") {
            newStock += quantity;
          } else if (type === "salida") {
            newStock -= quantity;
            if (newStock < 0)
              throw new Error(
                "No hay suficiente stock para realizar esta salida."
              );
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
          comments: comments,
        });
      }
      closeModal("movementModal");
      loadProducts(); // Función global en inventario.js
      loadMovements();
    } catch (error) {
      console.error("Error al registrar/actualizar movimiento:", error);
      alert("Error al registrar/actualizar movimiento: " + error.message);
    }
  }
  
  // Función para cargar y mostrar los movimientos aplicando filtros
  async function loadMovements() {
    try {
      // Obtener filtros desde la interfaz
      let sortOrderElem = document.getElementById("movementSortOrder");
      let sortOrder = sortOrderElem ? sortOrderElem.value : "desc";
      let filterUserElem = document.getElementById("movementFilterUser");
      let filterUser = filterUserElem
        ? filterUserElem.value.trim().toLowerCase()
        : "";
      let filterProductElem = document.getElementById("movementFilterProduct");
      let filterProduct = filterProductElem ? filterProductElem.value : "";
  
      // Construir la consulta a Firestore
      let query = db.collection("inventoryMovements");
      if (filterProduct !== "") {
        query = query.where("productId", "==", filterProduct);
      }
      query = query.orderBy("date", sortOrder);
  
      let snapshot = await query.get();
      let tbody = document
        .getElementById("movementsTable")
        .getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
  
      // Recorrer documentos y aplicar filtro de responsable de forma cliente
      for (let doc of snapshot.docs) {
        let m = doc.data();
        if (
          filterUser !== "" &&
          (!m.user || !m.user.toLowerCase().includes(filterUser))
        ) {
          continue;
        }
        let productDoc = await db
          .collection("inventoryProducts")
          .doc(m.productId)
          .get();
        let productName = productDoc.exists
          ? productDoc.data().name
          : "Producto no encontrado";
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
  
  // Función para editar un movimiento
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
        document.getElementById("movementModalLabel").textContent =
          "Editar Movimiento";
        new bootstrap.Modal(document.getElementById("movementModal")).show();
      } else {
        alert("Movimiento no encontrado.");
      }
    } catch (error) {
      console.error("Error al cargar movimiento:", error);
      alert("Error al cargar movimiento: " + error.message);
    }
  }
  
  // Función para eliminar un movimiento
  async function deleteMovement(movementId) {
    if (!confirm("¿Estás seguro de eliminar este movimiento?")) return;
    try {
      let doc = await db.collection("inventoryMovements").doc(movementId).get();
      if (!doc.exists) throw new Error("Movimiento no encontrado");
      let m = doc.data();
      let effect =
        m.type === "entrada" || m.type === "ajuste" ? m.quantity : -m.quantity;
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
  
  // Función para poblar el select de filtro de producto en movimientos
  async function populateMovementFilterProduct() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let filterSelect = document.getElementById("movementFilterProduct");
      filterSelect.innerHTML = '<option value="">Todos los productos</option>';
      snapshot.forEach(doc => {
        let option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.data().name;
        filterSelect.appendChild(option);
      });
    } catch (error) {
      console.error(
        "Error al cargar productos para filtro de movimientos:",
        error
      );
    }
  }
  
  // Se asegura de poblar el select de filtro cuando se carga la página
  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("movementFilterProduct")) {
      populateMovementFilterProduct();
    }
  });
  