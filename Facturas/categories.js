// Gestión de Categorías de Facturas
let allCategories = [];
let currentUser = localStorage.getItem('usuarioLogueado');

document.addEventListener('DOMContentLoaded', async () => {
  if (!currentUser) {
    window.location.href = '../login.html';
    return;
  }
  document.getElementById('user-display').textContent = `Usuario: ${currentUser}`;
  await loadCategories();
  setupEventListeners();
});

async function loadCategories() {
  try {
    const snap = await db.collection('invoice_categories').get();
    allCategories = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCategories();
  } catch (error) {
    console.error("Error loading categories:", error);
    Swal.fire('Error', 'No se pudieron cargar las categorías', 'error');
  }
}

function renderCategories() {
  const grid = document.getElementById('categories-grid');
  grid.innerHTML = '';

  if (allCategories.length === 0) {
    grid.innerHTML = `
      <div class="no-categories" style="grid-column: 1/-1; text-align: center; padding: 50px; background: white; border-radius: 16px; box-shadow: var(--shadow);">
        <i class="fas fa-folder-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 15px;"></i>
        <p>No hay categorías creadas. ¡Crea la primera para comenzar!</p>
        <button class="btn-primary" onclick="openCategoryModal()">Agregar Categoría</button>
      </div>
    `;
    return;
  }

  allCategories.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <button class="btn-edit-cat" onclick="event.stopPropagation(); openCategoryModal('${cat.id}')">
        <i class="fas fa-pen"></i>
      </button>
      <div class="category-icon-box" style="background-color: ${cat.color || '#2563eb'}">
        <i class="${cat.icon || 'fas fa-folder'}"></i>
      </div>
      <div class="category-info">
        <h3>${cat.name}</h3>
        <p>${cat.description || 'Sin descripción'}</p>
      </div>
    `;
    card.onclick = () => {
      window.location.href = `categoryDetail.html?id=${cat.id}`;
    };
    grid.appendChild(card);
  });
}

function setupEventListeners() {
  document.getElementById('form-category').onsubmit = async (e) => {
    e.preventDefault();
    await saveCategory();
  };
}

function openCategoryModal(catId = null) {
  const modal = document.getElementById('modal-category');
  const title = document.getElementById('category-modal-title');
  const btnDelete = document.getElementById('btn-delete-category');
  
  modal.style.display = 'block';
  
  if (catId) {
    const cat = allCategories.find(c => c.id === catId);
    title.textContent = 'Editar Categoría';
    document.getElementById('category-id').value = cat.id;
    document.getElementById('category-name').value = cat.name;
    document.getElementById('category-icon').value = cat.icon || 'fas fa-folder';
    document.getElementById('category-color').value = cat.color || '#2563eb';
    document.getElementById('category-description').value = cat.description || '';
    btnDelete.style.display = 'block';
  } else {
    title.textContent = 'Nueva Categoría';
    document.getElementById('form-category').reset();
    document.getElementById('category-id').value = '';
    btnDelete.style.display = 'none';
  }
}

function closeCategoryModal() {
  document.getElementById('modal-category').style.display = 'none';
}

async function saveCategory() {
  const id = document.getElementById('category-id').value;
  const data = {
    name: document.getElementById('category-name').value,
    icon: document.getElementById('category-icon').value,
    color: document.getElementById('category-color').value,
    description: document.getElementById('category-description').value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    Swal.fire({ title: 'Guardando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    if (id) {
      await db.collection('invoice_categories').doc(id).update(data);
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('invoice_categories').add(data);
    }
    
    await loadCategories();
    closeCategoryModal();
    Swal.fire('Éxito', 'Categoría guardada correctamente', 'success');
  } catch (error) {
    console.error("Error saving category:", error);
    Swal.fire('Error', 'No se pudo guardar la categoría', 'error');
  }
}

async function deleteCategory() {
  const id = document.getElementById('category-id').value;
  const cat = allCategories.find(c => c.id === id);

  const confirm = await Swal.fire({
    title: '¿Eliminar categoría?',
    text: `Se eliminará "${cat.name}". Asegúrate de que no haya proveedores vinculados.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirm.isConfirmed) return;

  try {
    // Verificar si hay proveedores asociados (opcional pero recomendado)
    const provSnap = await db.collection('providers').where('categoryId', '==', id).limit(1).get();
    if (!provSnap.empty) {
      Swal.fire('No permitido', 'Esta categoría tiene proveedores asociados. Mueve los proveedores antes de eliminarla.', 'error');
      return;
    }

    await db.collection('invoice_categories').doc(id).delete();
    await loadCategories();
    closeCategoryModal();
    Swal.fire('Eliminado', 'La categoría ha sido eliminada', 'success');
  } catch (error) {
    console.error("Error deleting category:", error);
    Swal.fire('Error', 'No se pudo eliminar la categoría', 'error');
  }
}
