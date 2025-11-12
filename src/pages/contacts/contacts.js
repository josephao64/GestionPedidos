/**
 * Módulo de Gestión de Contactos
 * Sistema completo de contactos con categorías, tipos, sucursales y CRUD
 * 
 * ============================================
 * ÍNDICES DE FIRESTORE A CREAR
 * ============================================
 * 
 * Colección: contacts
 * - (scope, branchId, typeId, createdAt desc)
 * - (scope, categoryId, createdAt desc)
 * - (displayNameLower, scope)
 * - (scope, tags)
 * - (searchEmails) [array-contains]
 * - (searchPhones) [array-contains]
 * - (scope, branchId, createdAt desc)
 * - (companyName) [range]
 * - (createdAt) [range]
 * 
 * Colección: contactTypes
 * - (sort, name)
 * 
 * Colección: contactCategories
 * - (parentId, sort)
 * - (path) [array-contains]
 * - (isActive, sort)
 */

// ============================================
// ESTADO GLOBAL
// ============================================
let currentUser = null;
let userRole = null;
let branches = [];
let contactTypes = [];
let contactCategories = [];
let contacts = [];
let companies = [];

// Filtros activos
const filters = {
  scope: '',
  branchId: '',
  typeId: '',
  categoryId: '',
  search: '',
  company: '',
  tags: [],
  dateFrom: null,
  dateTo: null
};

// Paginación
const paging = {
  lastDoc: null,
  hasMore: true,
  pageSize: 24,
  isLoading: false
};

// Cache
let branchesCache = [];
let typesCache = [];
let categoriesTree = {};

// ============================================
// UTILIDADES
// ============================================
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true
});

function showToast(message, type = 'success') {
  Toast.fire({
    icon: type,
    title: message
  });
}

function showError(message) {
  Swal.fire({
    icon: 'error',
    title: 'Error',
    text: message
  });
}

function confirmAction(message) {
  return Swal.fire({
    title: '¿Estás seguro?',
    text: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí',
    cancelButtonText: 'Cancelar'
  });
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function isValidPhoneGT(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 10;
}

function normalizePhone(phone) {
  return phone.replace(/\D/g, '');
}

function getInitials(firstName, lastName) {
  const f = (firstName || '').charAt(0).toUpperCase();
  const l = (lastName || '').charAt(0).toUpperCase();
  return (f + l) || '?';
}

function formatDate(date) {
  if (!date) return '—';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString('es-GT', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  await initUser();
  if (userRole !== 'administrador') {
    showError('Solo los administradores pueden acceder a esta sección.');
    setTimeout(() => {
      window.location.href = '../../../../INDEX.HTML';
    }, 2000);
    return;
  }
  
  await loadMasterData();
  setupEventListeners();
  await loadContacts();
  setupKeyboardShortcuts();
});

async function initUser() {
  currentUser = localStorage.getItem('usuarioLogueado');
  if (!currentUser) {
    window.location.href = '../../../../login.html';
    return;
  }

  try {
    const snap = await db.collection('usuarios')
      .where('username', '==', currentUser)
      .limit(1)
      .get();
    
    if (!snap.empty) {
      const userData = snap.docs[0].data();
      userRole = userData.rol || '';
    } else {
      window.location.href = '../../../../login.html';
    }
  } catch (error) {
    console.error('Error al verificar usuario:', error);
    window.location.href = '../../../../login.html';
  }
}

async function loadMasterData() {
  try {
    await Promise.all([
      loadBranches(),
      loadContactTypes(),
      loadContactCategories(),
      loadCompanies()
    ]);
    renderFilters();
  } catch (error) {
    console.error('Error cargando datos maestros:', error);
    showError('Error al cargar datos maestros');
  }
}

// ============================================
// CARGA DE DATOS MAESTROS
// ============================================
async function loadBranches() {
  try {
    const snap = await db.collection('sucursales')
      .where('status', '==', 'activo')
      .orderBy('name')
      .get();
    
    branches = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    branchesCache = branches;
  } catch (error) {
    console.error('Error cargando sucursales:', error);
  }
}

async function loadContactTypes() {
  try {
    const snap = await db.collection('contactTypes')
      .orderBy('sort')
      .orderBy('name')
      .get();
    
    contactTypes = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    typesCache = contactTypes;
  } catch (error) {
    console.error('Error cargando tipos:', error);
  }
}

async function loadContactCategories() {
  try {
    const snap = await db.collection('contactCategories')
      .orderBy('path')
      .orderBy('sort')
      .get();
    
    contactCategories = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    buildCategoryTree();
  } catch (error) {
    console.error('Error cargando categorías:', error);
  }
}

function buildCategoryTree() {
  categoriesTree = {};
  const rootCategories = contactCategories.filter(c => !c.parentId);
  
  function buildNode(category) {
    const node = {
      ...category,
      children: []
    };
    
    const children = contactCategories.filter(c => c.parentId === category.id);
    children.forEach(child => {
      node.children.push(buildNode(child));
    });
    
    return node;
  }
  
  rootCategories.forEach(root => {
    categoriesTree[root.id] = buildNode(root);
  });
}

async function loadCompanies() {
  try {
    const snap = await db.collection('empresas').get();
    companies = snap.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    }));
    
    const datalist = document.getElementById('companyList');
    if (datalist) {
      datalist.innerHTML = companies.map(c => 
        `<option value="${escapeHtml(c.name)}">`
      ).join('');
    }
  } catch (error) {
    console.error('Error cargando empresas:', error);
  }
}

// ============================================
// RENDERIZADO DE FILTROS
// ============================================
function renderFilters() {
  // Sucursales
  const branchSelect = document.getElementById('filterBranch');
  const formBranchSelect = document.getElementById('formBranch');
  
  if (branchSelect) {
    branchSelect.innerHTML = '<option value="">Todas</option>';
    branches.forEach(branch => {
      const option = document.createElement('option');
      option.value = branch.id;
      option.textContent = branch.name;
      branchSelect.appendChild(option);
    });
  }
  
  if (formBranchSelect) {
    formBranchSelect.innerHTML = '<option value="">Seleccionar...</option>';
    branches.forEach(branch => {
      const option = document.createElement('option');
      option.value = branch.id;
      option.textContent = branch.name;
      formBranchSelect.appendChild(option);
    });
  }
  
  // Tipos
  const typeSelect = document.getElementById('filterType');
  const formTypeSelect = document.getElementById('formType');
  
  if (typeSelect) {
    typeSelect.innerHTML = '<option value="">Todos</option>';
    contactTypes.filter(t => t.isActive !== false).forEach(type => {
      const option = document.createElement('option');
      option.value = type.id;
      option.textContent = type.name;
      typeSelect.appendChild(option);
    });
  }
  
  if (formTypeSelect) {
    formTypeSelect.innerHTML = '<option value="">Seleccionar...</option>';
    contactTypes.filter(t => t.isActive !== false).forEach(type => {
      const option = document.createElement('option');
      option.value = type.id;
      option.textContent = type.name;
      formTypeSelect.appendChild(option);
    });
  }
  
  // Categorías
  renderCategoryFilter();
  renderCategoryFormSelect();
}

function renderCategoryFilter() {
  const categorySelect = document.getElementById('filterCategory');
  if (!categorySelect) return;
  
  categorySelect.innerHTML = '<option value="">Todas</option>';
  
  function addCategoryOptions(categories, level = 0) {
    categories.forEach(cat => {
      if (cat.isActive !== false) {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = '  '.repeat(level) + cat.name;
        categorySelect.appendChild(option);
      }
      if (cat.children && cat.children.length > 0) {
        addCategoryOptions(cat.children, level + 1);
      }
    });
  }
  
  Object.values(categoriesTree).forEach(root => {
    addCategoryOptions([root]);
  });
}

function renderCategoryFormSelect() {
  const categorySelect = document.getElementById('formCategory');
  const categoryParentSelect = document.getElementById('categoryParent');
  
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">Sin categoría</option>';
    function addOptions(categories, level = 0) {
      categories.forEach(cat => {
        if (cat.isActive !== false) {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = '  '.repeat(level) + cat.name;
          categorySelect.appendChild(option);
        }
        if (cat.children && cat.children.length > 0) {
          addOptions(cat.children, level + 1);
        }
      });
    }
    Object.values(categoriesTree).forEach(root => {
      addOptions([root]);
    });
  }
  
  if (categoryParentSelect) {
    categoryParentSelect.innerHTML = '<option value="">Ninguna (Raíz)</option>';
    function addParentOptions(categories, level = 0) {
      categories.forEach(cat => {
        if (cat.isActive !== false) {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = '  '.repeat(level) + cat.name;
          categoryParentSelect.appendChild(option);
        }
        if (cat.children && cat.children.length > 0) {
          addParentOptions(cat.children, level + 1);
        }
      });
    }
    Object.values(categoriesTree).forEach(root => {
      addParentOptions([root]);
    });
  }
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Filtros
  document.getElementById('filterScope').addEventListener('change', (e) => {
    filters.scope = e.target.value;
    const branchContainer = document.getElementById('branchFilterContainer');
    if (e.target.value === 'branch') {
      branchContainer.style.display = 'block';
    } else {
      branchContainer.style.display = 'none';
      filters.branchId = '';
      document.getElementById('filterBranch').value = '';
    }
    resetPaging();
    loadContacts();
  });
  
  document.getElementById('filterBranch').addEventListener('change', (e) => {
    filters.branchId = e.target.value;
    resetPaging();
    loadContacts();
  });
  
  document.getElementById('filterType').addEventListener('change', (e) => {
    filters.typeId = e.target.value;
    resetPaging();
    loadContacts();
  });
  
  document.getElementById('filterCategory').addEventListener('change', (e) => {
    filters.categoryId = e.target.value;
    resetPaging();
    loadContacts();
  });
  
  document.getElementById('searchInput').addEventListener('input', debounce((e) => {
    filters.search = e.target.value.trim();
    resetPaging();
    loadContacts();
  }, 300));
  
  document.getElementById('filterCompany').addEventListener('input', debounce((e) => {
    filters.company = e.target.value.trim();
    resetPaging();
    loadContacts();
  }, 300));
  
  document.getElementById('filterTags').addEventListener('input', debounce((e) => {
    const tagsStr = e.target.value.trim();
    // Buscar por cualquier tag que contenga el texto
    filters.tags = tagsStr ? [tagsStr.toUpperCase()] : [];
    resetPaging();
    loadContacts();
  }, 300));
  
  document.getElementById('filterDateFrom').addEventListener('change', (e) => {
    filters.dateFrom = e.target.value ? new Date(e.target.value) : null;
    resetPaging();
    loadContacts();
  });
  
  document.getElementById('filterDateTo').addEventListener('change', (e) => {
    filters.dateTo = e.target.value ? new Date(e.target.value) : null;
    resetPaging();
    loadContacts();
  });
  
  document.getElementById('btnClearFilters').addEventListener('click', () => {
    clearFilters();
    loadContacts();
  });
  
  // Botones principales
  document.getElementById('btnNewContact').addEventListener('click', () => {
    openContactForm();
  });
  
  document.getElementById('btnSaveContact').addEventListener('click', () => {
    saveContact();
  });
  
  document.getElementById('btnEditFromView').addEventListener('click', () => {
    const contactId = document.getElementById('viewContactModal').dataset.contactId;
    if (contactId) {
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        const viewModal = bootstrap.Modal.getInstance(document.getElementById('viewContactModal'));
        viewModal.hide();
        setTimeout(() => openContactForm(contact), 300);
      }
    }
  });
  
  document.getElementById('btnLoadMore').addEventListener('click', () => {
    loadContacts(true);
  });
  
  // Form scope change
  document.getElementById('formScope').addEventListener('change', (e) => {
    const branchContainer = document.getElementById('formBranchContainer');
    if (e.target.value === 'branch') {
      branchContainer.style.display = 'block';
      document.getElementById('formBranch').required = true;
    } else {
      branchContainer.style.display = 'none';
      document.getElementById('formBranch').required = false;
    }
  });
  
  // Emails y teléfonos dinámicos
  document.getElementById('btnAddEmail').addEventListener('click', () => {
    addEmailField();
  });
  
  document.getElementById('btnAddPhone').addEventListener('click', () => {
    addPhoneField();
  });
  
  // Import/Export
  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('csvFileInput').click();
  });
  
  document.getElementById('csvFileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importCSV(e.target.files[0]);
    }
  });
  
  document.getElementById('btnExport').addEventListener('click', () => {
    exportCSV();
  });
  
  // Gestión de catálogos (solo admin)
  if (userRole === 'administrador') {
    document.getElementById('adminButtons').style.display = 'flex';
    document.getElementById('btnManageTypes').addEventListener('click', () => {
      openManageTypesModal();
    });
    document.getElementById('btnManageCategories').addEventListener('click', () => {
      openManageCategoriesModal();
    });
  }
  
  // Gestión de tipos
  document.getElementById('btnNewType').addEventListener('click', () => {
    openTypeForm();
  });
  
  document.getElementById('btnSaveType').addEventListener('click', () => {
    saveType();
  });
  
  // Gestión de categorías
  document.getElementById('btnNewCategory').addEventListener('click', () => {
    openCategoryForm();
  });
  
  document.getElementById('btnSaveCategory').addEventListener('click', () => {
    saveCategory();
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }
    
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    } else if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      openContactForm();
    } else if (e.key === 'Escape') {
      const modals = document.querySelectorAll('.modal.show');
      modals.forEach(modal => {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
      });
    }
  });
}

// ============================================
// CARGA DE CONTACTOS
// ============================================
function resetPaging() {
  paging.lastDoc = null;
  paging.hasMore = true;
  contacts = [];
}

async function loadContacts(append = false) {
  if (paging.isLoading) return;
  if (!append) {
    resetPaging();
    document.getElementById('contactsGrid').innerHTML = '';
    document.getElementById('loadingIndicator').style.display = 'block';
  }
  
  paging.isLoading = true;
  
  try {
    let query = db.collection('contacts');
    
    // Aplicar filtros
    if (filters.scope) {
      query = query.where('scope', '==', filters.scope);
    }
    
    if (filters.scope === 'branch' && filters.branchId) {
      query = query.where('branchId', '==', filters.branchId);
    }
    
    if (filters.typeId) {
      query = query.where('typeId', '==', filters.typeId);
    }
    
    if (filters.categoryId) {
      query = query.where('categoryId', '==', filters.categoryId);
    }
    
    if (filters.company) {
      query = query.where('companyName', '>=', filters.company)
                   .where('companyName', '<=', filters.company + '\uf8ff');
    }
    
    if (filters.dateFrom) {
      query = query.where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(filters.dateFrom));
    }
    
    if (filters.dateTo) {
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      query = query.where('createdAt', '<=', firebase.firestore.Timestamp.fromDate(endDate));
    }
    
    // Búsqueda de texto
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      // Intentar detectar si es email o teléfono
      if (searchLower.includes('@')) {
        // Es email
        query = query.where('searchEmails', 'array-contains', searchLower);
      } else if (/^\d+$/.test(searchLower.replace(/\D/g, ''))) {
        // Es teléfono (solo dígitos)
        const phoneDigits = normalizePhone(filters.search);
        query = query.where('searchPhones', 'array-contains', phoneDigits);
      } else {
        // Búsqueda por nombre
        query = query.where('displayNameLower', '>=', searchLower)
                     .where('displayNameLower', '<=', searchLower + '\uf8ff');
      }
    }
    
    // Ordenar y paginar
    query = query.orderBy('createdAt', 'desc').limit(paging.pageSize);
    
    if (paging.lastDoc) {
      query = query.startAfter(paging.lastDoc);
    }
    
    const snap = await query.get();
    
    if (snap.empty) {
      paging.hasMore = false;
      if (!append) {
        showNoDataMessage();
      }
    } else {
      const newContacts = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filtrar por tags si hay
      let filteredContacts = newContacts;
      if (filters.tags.length > 0) {
        filteredContacts = newContacts.filter(contact => {
          const contactTags = (contact.tags || []).map(t => t.toLowerCase());
          return filters.tags.some(tag => 
            contactTags.some(ct => ct.includes(tag.toLowerCase()))
          );
        });
      }
      
      contacts = append ? [...contacts, ...filteredContacts] : filteredContacts;
      paging.lastDoc = snap.docs[snap.docs.length - 1];
      paging.hasMore = snap.docs.length === paging.pageSize;
      
      renderContacts(append);
    }
    
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('btnLoadMore').style.display = paging.hasMore ? 'block' : 'none';
    
  } catch (error) {
    console.error('Error cargando contactos:', error);
    showError('Error al cargar contactos: ' + error.message);
    document.getElementById('loadingIndicator').style.display = 'none';
  } finally {
    paging.isLoading = false;
  }
}

function renderContacts(append = false) {
  const grid = document.getElementById('contactsGrid');
  
  if (!append) {
    grid.innerHTML = '';
  }
  
  if (contacts.length === 0) {
    showNoDataMessage();
    return;
  }
  
  contacts.forEach(contact => {
    const card = createContactCard(contact);
    grid.appendChild(card);
  });
}

function createContactCard(contact) {
  const card = document.createElement('div');
  card.className = 'contact-card';
  card.dataset.contactId = contact.id;
  
  const initials = getInitials(contact.firstName, contact.lastName);
  const displayName = contact.displayName || `${contact.firstName} ${contact.lastName}`;
  const primaryEmail = (contact.emails || [])[0];
  const primaryPhone = (contact.phones || [])[0];
  
  const type = contactTypes.find(t => t.id === contact.typeId);
  const category = contactCategories.find(c => c.id === contact.categoryId);
  
  card.innerHTML = `
    <div class="contact-avatar">${initials}</div>
    <div class="contact-name">${escapeHtml(displayName)}</div>
    ${contact.companyName ? `<div class="contact-info"><i class="fas fa-building me-1"></i>${escapeHtml(contact.companyName)}</div>` : ''}
    ${contact.branchName ? `<div class="contact-info"><i class="fas fa-map-marker-alt me-1"></i>${escapeHtml(contact.branchName)}</div>` : ''}
    ${primaryEmail ? `<div class="contact-info"><i class="fas fa-envelope me-1"></i>${escapeHtml(primaryEmail.value)}</div>` : ''}
    ${primaryPhone ? `<div class="contact-info"><i class="fas fa-phone me-1"></i>${primaryPhone.countryCode || ''} ${escapeHtml(primaryPhone.value)}</div>` : ''}
    <div class="contact-badges">
      ${type ? `<span class="badge badge-custom" style="background-color: ${type.color || '#007bff'}; color: white;">${escapeHtml(type.name)}</span>` : ''}
      ${category ? `<span class="badge badge-custom bg-secondary">${escapeHtml(category.name)}</span>` : ''}
      ${(contact.tags || []).slice(0, 2).map(tag => `<span class="badge badge-custom bg-info">${escapeHtml(tag)}</span>`).join('')}
    </div>
    <div class="contact-actions">
      <button class="btn-icon primary" onclick="viewContact('${contact.id}')" title="Ver">
        <i class="fas fa-eye"></i>
      </button>
      <button class="btn-icon primary" onclick="editContact('${contact.id}')" title="Editar">
        <i class="fas fa-edit"></i>
      </button>
      ${primaryPhone ? `<button class="btn-icon success" onclick="openWhatsApp('${primaryPhone.countryCode || '+502'}${normalizePhone(primaryPhone.value)}')" title="WhatsApp">
        <i class="fab fa-whatsapp"></i>
      </button>` : ''}
      <button class="btn-icon" onclick="copyContactInfo('${contact.id}')" title="Copiar">
        <i class="fas fa-copy"></i>
      </button>
      <button class="btn-icon danger" onclick="deleteContact('${contact.id}')" title="Eliminar">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
  
  return card;
}

function showNoDataMessage() {
  const grid = document.getElementById('contactsGrid');
  grid.innerHTML = `
    <div class="empty-state col-12">
      <i class="fas fa-address-book"></i>
      <h5>No hay contactos</h5>
      <p>Comienza agregando tu primer contacto</p>
      <button class="btn btn-primary" onclick="document.getElementById('btnNewContact').click()">
        <i class="fas fa-plus me-1"></i>Nuevo Contacto
      </button>
    </div>
  `;
}

// ============================================
// GESTIÓN DE CONTACTOS
// ============================================
function viewContact(contactId) {
  const contact = contacts.find(c => c.id === contactId);
  if (!contact) return;
  
  const modal = document.getElementById('viewContactModal');
  modal.dataset.contactId = contactId;
  
  // Tab General
  const type = contactTypes.find(t => t.id === contact.typeId);
  const category = contactCategories.find(c => c.id === contact.categoryId);
  
  document.getElementById('viewGeneralContent').innerHTML = `
    <div class="row g-3">
      <div class="col-md-6">
        <strong>Nombre:</strong> ${escapeHtml(contact.firstName)} ${escapeHtml(contact.lastName)}
      </div>
      <div class="col-md-6">
        <strong>Empresa:</strong> ${escapeHtml(contact.companyName || '—')}
      </div>
      <div class="col-md-6">
        <strong>Ámbito:</strong> ${contact.scope === 'general' ? 'General' : 'Sucursal'}
      </div>
      ${contact.branchName ? `<div class="col-md-6"><strong>Sucursal:</strong> ${escapeHtml(contact.branchName)}</div>` : ''}
      <div class="col-md-6">
        <strong>Tipo:</strong> ${type ? escapeHtml(type.name) : '—'}
      </div>
      <div class="col-md-6">
        <strong>Categoría:</strong> ${category ? escapeHtml(category.fullName || category.name) : '—'}
      </div>
      <div class="col-12">
        <strong>Tags:</strong> ${(contact.tags || []).map(t => `<span class="badge bg-info me-1">${escapeHtml(t)}</span>`).join('') || '—'}
      </div>
      <div class="col-12">
        <strong>Creado:</strong> ${formatDate(contact.createdAt)}
      </div>
    </div>
  `;
  
  // Tab Contacto
  let emailsHtml = '<ul class="list-unstyled">';
  (contact.emails || []).forEach(email => {
    emailsHtml += `<li><i class="fas fa-envelope me-2"></i>${escapeHtml(email.value)} <span class="badge bg-secondary">${email.type || 'work'}</span></li>`;
  });
  emailsHtml += '</ul>';
  
  let phonesHtml = '<ul class="list-unstyled">';
  (contact.phones || []).forEach(phone => {
    phonesHtml += `<li><i class="fas fa-phone me-2"></i>${phone.countryCode || ''} ${escapeHtml(phone.value)} <span class="badge bg-secondary">${phone.type || 'mobile'}</span></li>`;
  });
  phonesHtml += '</ul>';
  
  const address = contact.address || {};
  let addressHtml = '—';
  if (address.line1 || address.city) {
    addressHtml = `
      ${address.line1 || ''}<br>
      ${address.line2 || ''}<br>
      ${address.city || ''}${address.state ? ', ' + address.state : ''} ${address.zip || ''}<br>
      ${address.country || ''}
    `;
  }
  
  document.getElementById('viewContactContent').innerHTML = `
    <div class="row g-3">
      <div class="col-12">
        <h6>Emails</h6>
        ${emailsHtml}
      </div>
      <div class="col-12">
        <h6>Teléfonos</h6>
        ${phonesHtml}
      </div>
      <div class="col-12">
        <h6>Dirección</h6>
        ${addressHtml}
      </div>
    </div>
  `;
  
  // Tab Notas
  document.getElementById('viewNotesContent').innerHTML = `
    <div class="mb-3">
      <strong>Notas:</strong>
      <div class="mt-2 p-3 bg-light rounded">
        ${escapeHtml(contact.notes || 'Sin notas')}
      </div>
    </div>
  `;
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
}

function openContactForm(contact = null) {
  const modal = document.getElementById('contactFormModal');
  const form = document.getElementById('contactForm');
  form.reset();
  
  if (contact) {
    document.getElementById('formModalTitle').textContent = 'Editar Contacto';
    document.getElementById('contactId').value = contact.id;
    document.getElementById('formScope').value = contact.scope || 'general';
    document.getElementById('formBranch').value = contact.branchId || '';
    document.getElementById('formType').value = contact.typeId || '';
    document.getElementById('formCategory').value = contact.categoryId || '';
    document.getElementById('formFirstName').value = contact.firstName || '';
    document.getElementById('formLastName').value = contact.lastName || '';
    document.getElementById('formCompany').value = contact.companyName || '';
    // Tags: uno por línea
    document.getElementById('formTags').value = (contact.tags || []).join('\n');
    document.getElementById('formNotes').value = contact.notes || '';
    
    // Dirección
    const addr = contact.address || {};
    document.getElementById('formAddressLine1').value = addr.line1 || '';
    document.getElementById('formAddressLine2').value = addr.line2 || '';
    document.getElementById('formCity').value = addr.city || '';
    document.getElementById('formState').value = addr.state || '';
    document.getElementById('formZip').value = addr.zip || '';
    document.getElementById('formCountry').value = addr.country || 'Guatemala';
    
    // Emails
    document.getElementById('emailsContainer').innerHTML = '';
    (contact.emails || []).forEach(email => {
      addEmailField(email);
    });
    
    // Teléfonos
    document.getElementById('phonesContainer').innerHTML = '';
    (contact.phones || []).forEach(phone => {
      addPhoneField(phone);
    });
    
    // Mostrar branch container si es branch
    if (contact.scope === 'branch') {
      document.getElementById('formBranchContainer').style.display = 'block';
    }
  } else {
    document.getElementById('formModalTitle').textContent = 'Nuevo Contacto';
    document.getElementById('emailsContainer').innerHTML = '';
    document.getElementById('phonesContainer').innerHTML = '';
    addEmailField();
    addPhoneField();
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
}

function editContact(contactId) {
  const contact = contacts.find(c => c.id === contactId);
  if (contact) {
    openContactForm(contact);
  }
}

function addEmailField(email = null) {
  const container = document.getElementById('emailsContainer');
  const div = document.createElement('div');
  div.className = 'email-phone-item';
  div.innerHTML = `
    <select class="form-select form-select-sm">
      <option value="work" ${email && email.type === 'work' ? 'selected' : ''}>Trabajo</option>
      <option value="personal" ${email && email.type === 'personal' ? 'selected' : ''}>Personal</option>
      <option value="other" ${email && email.type === 'other' ? 'selected' : ''}>Otro</option>
    </select>
    <input type="email" class="form-control form-control-sm" placeholder="email@ejemplo.com" 
           value="${email ? escapeHtml(email.value) : ''}" required>
    <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  container.appendChild(div);
}

function addPhoneField(phone = null) {
  const container = document.getElementById('phonesContainer');
  const div = document.createElement('div');
  div.className = 'email-phone-item';
  div.innerHTML = `
    <select class="form-select form-select-sm">
      <option value="mobile" ${phone && phone.type === 'mobile' ? 'selected' : ''}>Móvil</option>
      <option value="work" ${phone && phone.type === 'work' ? 'selected' : ''}>Trabajo</option>
      <option value="home" ${phone && phone.type === 'home' ? 'selected' : ''}>Casa</option>
      <option value="whatsapp" ${phone && phone.type === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
      <option value="other" ${phone && phone.type === 'other' ? 'selected' : ''}>Otro</option>
    </select>
    <input type="text" class="form-control form-control-sm" placeholder="Código" 
           value="${phone ? (phone.countryCode || '+502') : '+502'}" style="width: 100px;">
    <input type="tel" class="form-control form-control-sm" placeholder="Número" 
           value="${phone ? escapeHtml(phone.value) : ''}" required>
    <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  container.appendChild(div);
}

async function saveContact() {
  const form = document.getElementById('contactForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const contactId = document.getElementById('contactId').value;
  const scope = document.getElementById('formScope').value;
  const branchId = document.getElementById('formBranch').value;
  const typeId = document.getElementById('formType').value;
  const categoryId = document.getElementById('formCategory').value;
  const firstName = document.getElementById('formFirstName').value.trim().toUpperCase();
  const lastName = document.getElementById('formLastName').value.trim().toUpperCase();
  const companyName = document.getElementById('formCompany').value.trim().toUpperCase();
  const tagsStr = document.getElementById('formTags').value.trim();
  const notes = document.getElementById('formNotes').value.trim();
  
  // Validaciones
  if (scope === 'branch' && !branchId) {
    showError('Debes seleccionar una sucursal');
    return;
  }
  
  if (!typeId) {
    showError('Debes seleccionar un tipo de contacto');
    return;
  }
  
  // Recopilar emails
  const emails = [];
  const emailItems = document.querySelectorAll('#emailsContainer .email-phone-item');
  for (const item of emailItems) {
    const type = item.querySelector('select').value;
    const value = item.querySelector('input[type="email"]').value.trim();
    if (value) {
      if (!isValidEmail(value)) {
        showError(`El email "${value}" no es válido`);
        return;
      }
      emails.push({ type, value });
    }
  }
  
  // Recopilar teléfonos
  const phones = [];
  const phoneItems = document.querySelectorAll('#phonesContainer .email-phone-item');
  for (const item of phoneItems) {
    const type = item.querySelector('select').value;
    const countryCode = item.querySelectorAll('input')[0].value.trim();
    const value = item.querySelectorAll('input')[1].value.trim();
    if (value) {
      if (!isValidPhoneGT(value)) {
        showError(`El teléfono "${value}" no es válido`);
        return;
      }
      phones.push({ type, countryCode, value });
    }
  }
  
  // Dirección (todo en mayúsculas)
  const address = {
    line1: document.getElementById('formAddressLine1').value.trim().toUpperCase(),
    line2: document.getElementById('formAddressLine2').value.trim().toUpperCase(),
    city: document.getElementById('formCity').value.trim().toUpperCase(),
    state: document.getElementById('formState').value.trim().toUpperCase(),
    zip: document.getElementById('formZip').value.trim().toUpperCase(),
    country: (document.getElementById('formCountry').value.trim() || 'Guatemala').toUpperCase()
  };
  
  // Tags (uno por línea, en mayúsculas)
  const tags = tagsStr ? tagsStr.split('\n')
    .map(t => t.trim())
    .filter(t => t)
    .map(t => t.toUpperCase()) : [];
  
  // Construir datos del contacto
  const displayName = `${firstName} ${lastName}`.trim();
  const displayNameLower = displayName.toLowerCase();
  
  const searchEmails = emails.map(e => e.value.toLowerCase());
  const searchPhones = phones.map(p => normalizePhone(p.value));
  
  // Obtener datos de sucursal si aplica
  let branchName = '';
  let companyId = '';
  let companyNameFinal = companyName;
  
  if (scope === 'branch' && branchId) {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      branchName = branch.name ? branch.name.toUpperCase() : '';
      companyId = branch.empresaId || '';
    }
  }
  
  // Obtener nombre de tipo y categoría (en mayúsculas)
  const type = contactTypes.find(t => t.id === typeId);
  const typeName = type ? type.name.toUpperCase() : '';
  
  const category = contactCategories.find(c => c.id === categoryId);
  const categoryFullName = category ? (category.fullName || category.name).toUpperCase() : '';
  
  const contactData = {
    scope,
    branchId: scope === 'branch' ? branchId : null,
    branchName: scope === 'branch' ? branchName : null,
    companyId: scope === 'branch' ? companyId : null,
    companyName: companyNameFinal || null,
    typeId,
    typeName,
    categoryId: categoryId || null,
    categoryFullName: categoryFullName || null,
    firstName,
    lastName,
    displayName,
    displayNameLower,
    emails,
    phones,
    address: Object.values(address).some(v => v) ? address : null,
    tags,
    searchEmails,
    searchPhones,
    notes: notes || null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: currentUser
  };
  
  if (!contactId) {
    // Nuevo contacto
    contactData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    contactData.createdBy = currentUser;
    
    // Verificar duplicados
    await checkDuplicates(searchEmails, searchPhones, contactData);
  }
  
  try {
    if (contactId) {
      await db.collection('contacts').doc(contactId).update(contactData);
      showToast('Contacto actualizado correctamente');
    } else {
      await db.collection('contacts').add(contactData);
      showToast('Contacto creado correctamente');
    }
    
    const bsModal = bootstrap.Modal.getInstance(document.getElementById('contactFormModal'));
    bsModal.hide();
    
    resetPaging();
    await loadContacts();
    
  } catch (error) {
    console.error('Error guardando contacto:', error);
    showError('Error al guardar contacto: ' + error.message);
  }
}

async function checkDuplicates(searchEmails, searchPhones, contactData) {
  const duplicates = [];
  
  // Buscar por emails
  for (const email of searchEmails) {
    const emailSnap = await db.collection('contacts')
      .where('searchEmails', 'array-contains', email)
      .limit(1)
      .get();
    
    if (!emailSnap.empty) {
      duplicates.push({ type: 'email', value: email, contact: emailSnap.docs[0].data() });
    }
  }
  
  // Buscar por teléfonos
  for (const phone of searchPhones) {
    const phoneSnap = await db.collection('contacts')
      .where('searchPhones', 'array-contains', phone)
      .limit(1)
      .get();
    
    if (!phoneSnap.empty) {
      duplicates.push({ type: 'phone', value: phone, contact: phoneSnap.docs[0].data() });
    }
  }
  
  if (duplicates.length > 0) {
    const duplicateInfo = duplicates.map(d => 
      `${d.type === 'email' ? 'Email' : 'Teléfono'}: ${d.value} (${d.contact.displayName})`
    ).join('\n');
    
    const result = await Swal.fire({
      title: 'Posibles duplicados encontrados',
      html: `<pre style="text-align: left; white-space: pre-wrap;">${escapeHtml(duplicateInfo)}</pre>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Crear de todos modos',
      cancelButtonText: 'Cancelar',
      showDenyButton: true,
      denyButtonText: 'Ver duplicado'
    });
    
    if (result.isDenied) {
      const dupContact = duplicates[0].contact;
      const foundContact = contacts.find(c => 
        c.displayName === dupContact.displayName || 
        (c.searchEmails && c.searchEmails.some(e => searchEmails.includes(e)))
      );
      if (foundContact) {
        viewContact(foundContact.id);
      }
      throw new Error('User cancelled');
    } else if (result.isDismissed) {
      throw new Error('User cancelled');
    }
  }
}

async function deleteContact(contactId) {
  const result = await confirmAction('¿Estás seguro de eliminar este contacto?');
  if (!result.isConfirmed) return;
  
  try {
    await db.collection('contacts').doc(contactId).delete();
    showToast('Contacto eliminado correctamente');
    contacts = contacts.filter(c => c.id !== contactId);
    renderContacts(false);
  } catch (error) {
    console.error('Error eliminando contacto:', error);
    showError('Error al eliminar contacto: ' + error.message);
  }
}

function openWhatsApp(phone) {
  const url = `https://wa.me/${phone.replace(/\D/g, '')}`;
  window.open(url, '_blank');
}

function copyContactInfo(contactId) {
  const contact = contacts.find(c => c.id === contactId);
  if (!contact) return;
  
  const info = [
    `${contact.firstName} ${contact.lastName}`,
    contact.companyName || '',
    ...(contact.emails || []).map(e => e.value),
    ...(contact.phones || []).map(p => `${p.countryCode || ''}${p.value}`)
  ].filter(v => v).join('\n');
  
  navigator.clipboard.writeText(info).then(() => {
    showToast('Información copiada al portapapeles');
  });
}

function clearFilters() {
  filters.scope = '';
  filters.branchId = '';
  filters.typeId = '';
  filters.categoryId = '';
  filters.search = '';
  filters.company = '';
  filters.tags = [];
  filters.dateFrom = null;
  filters.dateTo = null;
  
  document.getElementById('filterScope').value = '';
  document.getElementById('filterBranch').value = '';
  document.getElementById('filterType').value = '';
  document.getElementById('filterCategory').value = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('filterCompany').value = '';
  document.getElementById('filterTags').value = '';
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value = '';
  document.getElementById('branchFilterContainer').style.display = 'none';
}

// ============================================
// GESTIÓN DE TIPOS
// ============================================
async function openManageTypesModal() {
  await loadContactTypes();
  renderTypesTable();
  const modal = new bootstrap.Modal(document.getElementById('manageTypesModal'));
  modal.show();
}

function renderTypesTable() {
  const tbody = document.getElementById('typesTableBody');
  tbody.innerHTML = '';
  
  contactTypes.forEach(type => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(type.name)}</td>
      <td>${escapeHtml(type.description || '—')}</td>
      <td><span class="badge" style="background-color: ${type.color || '#007bff'};">&nbsp;&nbsp;&nbsp;</span></td>
      <td>${type.sort || 0}</td>
      <td><span class="badge ${type.isActive !== false ? 'bg-success' : 'bg-secondary'}">${type.isActive !== false ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openTypeForm('${type.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteType('${type.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openTypeForm(typeId = null) {
  const form = document.getElementById('typeForm');
  form.reset();
  
  if (typeId) {
    const type = contactTypes.find(t => t.id === typeId);
    if (type) {
      document.getElementById('typeFormTitle').textContent = 'Editar Tipo';
      document.getElementById('typeId').value = type.id;
      document.getElementById('typeName').value = type.name;
      document.getElementById('typeDescription').value = type.description || '';
      document.getElementById('typeColor').value = type.color || '#007bff';
      document.getElementById('typeSort').value = type.sort || 0;
      document.getElementById('typeActive').checked = type.isActive !== false;
    }
  } else {
    document.getElementById('typeFormTitle').textContent = 'Nuevo Tipo';
  }
  
  const modal = new bootstrap.Modal(document.getElementById('typeFormModal'));
  modal.show();
}

async function saveType() {
  const form = document.getElementById('typeForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const typeId = document.getElementById('typeId').value;
  const name = document.getElementById('typeName').value.trim().toUpperCase();
  const description = document.getElementById('typeDescription').value.trim();
  const color = document.getElementById('typeColor').value;
  const sort = parseInt(document.getElementById('typeSort').value) || 0;
  const isActive = document.getElementById('typeActive').checked;
  
  // Verificar nombre único
  const existing = contactTypes.find(t => t.name.toLowerCase() === name.toLowerCase() && t.id !== typeId);
  if (existing) {
    showError('Ya existe un tipo con ese nombre');
    return;
  }
  
  const typeData = {
    name,
    description: description || null,
    color,
    sort,
    isActive,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  try {
    if (typeId) {
      await db.collection('contactTypes').doc(typeId).update(typeData);
      showToast('Tipo actualizado correctamente');
    } else {
      typeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('contactTypes').add(typeData);
      showToast('Tipo creado correctamente');
    }
    
    const bsModal = bootstrap.Modal.getInstance(document.getElementById('typeFormModal'));
    bsModal.hide();
    
    await loadContactTypes();
    renderTypesTable();
    renderFilters();
  } catch (error) {
    console.error('Error guardando tipo:', error);
    showError('Error al guardar tipo: ' + error.message);
  }
}

async function deleteType(typeId) {
  const result = await confirmAction('¿Estás seguro de eliminar este tipo?');
  if (!result.isConfirmed) return;
  
  try {
    // Verificar si hay contactos usando este tipo
    const contactsSnap = await db.collection('contacts')
      .where('typeId', '==', typeId)
      .limit(1)
      .get();
    
    if (!contactsSnap.empty) {
      showError('No se puede eliminar: hay contactos usando este tipo');
      return;
    }
    
    await db.collection('contactTypes').doc(typeId).delete();
    showToast('Tipo eliminado correctamente');
    await loadContactTypes();
    renderTypesTable();
    renderFilters();
  } catch (error) {
    console.error('Error eliminando tipo:', error);
    showError('Error al eliminar tipo: ' + error.message);
  }
}

// ============================================
// GESTIÓN DE CATEGORÍAS
// ============================================
async function openManageCategoriesModal() {
  await loadContactCategories();
  renderCategoriesTree();
  const modal = new bootstrap.Modal(document.getElementById('manageCategoriesModal'));
  modal.show();
}

function renderCategoriesTree() {
  const container = document.getElementById('categoriesTree');
  container.innerHTML = '';
  
  function renderNode(node, level = 0) {
    const div = document.createElement('div');
    div.className = `tree-node level-${Math.min(level, 4)} ${node.isActive === false ? 'text-muted' : ''}`;
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <strong>${escapeHtml(node.name)}</strong>
          ${node.fullName ? `<small class="text-muted ms-2">(${escapeHtml(node.fullName)})</small>` : ''}
          ${node.isActive === false ? '<span class="badge bg-secondary ms-2">Inactivo</span>' : ''}
        </div>
        <div>
          <button class="btn btn-sm btn-primary" onclick="openCategoryForm('${node.id}')" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-success" onclick="openCategoryForm(null, '${node.id}')" title="Agregar subcategoría">
            <i class="fas fa-plus"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteCategory('${node.id}')" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
    container.appendChild(div);
    
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        renderNode(child, level + 1);
      });
    }
  }
  
  Object.values(categoriesTree).forEach(root => {
    renderNode(root);
  });
}

function openCategoryForm(categoryId = null, parentId = null) {
  const form = document.getElementById('categoryForm');
  form.reset();
  
  if (categoryId) {
    const category = contactCategories.find(c => c.id === categoryId);
    if (category) {
      document.getElementById('categoryFormTitle').textContent = 'Editar Categoría';
      document.getElementById('categoryId').value = category.id;
      document.getElementById('categoryName').value = category.name;
      document.getElementById('categoryParent').value = category.parentId || '';
      document.getElementById('categorySort').value = category.sort || 0;
      document.getElementById('categoryActive').checked = category.isActive !== false;
    }
  } else {
    document.getElementById('categoryFormTitle').textContent = parentId ? 'Nueva Subcategoría' : 'Nueva Categoría';
    document.getElementById('categoryParent').value = parentId || '';
  }
  
  renderCategoryFormSelect();
  
  const modal = new bootstrap.Modal(document.getElementById('categoryFormModal'));
  modal.show();
}

async function saveCategory() {
  const form = document.getElementById('categoryForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const categoryId = document.getElementById('categoryId').value;
  const name = document.getElementById('categoryName').value.trim().toUpperCase();
  const parentId = document.getElementById('categoryParent').value || null;
  const sort = parseInt(document.getElementById('categorySort').value) || 0;
  const isActive = document.getElementById('categoryActive').checked;
  
  // Verificar nombre único en el mismo nivel
  const siblings = contactCategories.filter(c => 
    c.parentId === parentId && 
    c.name.toLowerCase() === name.toLowerCase() && 
    c.id !== categoryId
  );
  if (siblings.length > 0) {
    showError('Ya existe una categoría con ese nombre en el mismo nivel');
    return;
  }
  
  let path = [];
  let fullName = name;
  
  if (parentId) {
    const parent = contactCategories.find(c => c.id === parentId);
    if (parent) {
      path = [...(parent.path || []), parentId];
      const parentFullName = (parent.fullName || parent.name).toUpperCase();
      fullName = parentFullName + ' / ' + name;
    }
  }
  
  const categoryData = {
    name,
    parentId,
    path,
    fullName,
    sort,
    isActive,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  try {
    if (categoryId) {
      // Actualizar categoría y recalcular paths de hijos
      await db.collection('contactCategories').doc(categoryId).update(categoryData);
      
      // Actualizar paths de hijos
      const children = contactCategories.filter(c => c.parentId === categoryId);
      for (const child of children) {
        const newPath = [...path, categoryId];
        const childName = child.name.toUpperCase();
        const newFullName = fullName + ' / ' + childName;
        await db.collection('contactCategories').doc(child.id).update({
          path: newPath,
          fullName: newFullName
        });
      }
      
      showToast('Categoría actualizada correctamente');
    } else {
      categoryData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('contactCategories').add(categoryData);
      showToast('Categoría creada correctamente');
    }
    
    const bsModal = bootstrap.Modal.getInstance(document.getElementById('categoryFormModal'));
    bsModal.hide();
    
    await loadContactCategories();
    renderCategoriesTree();
    renderFilters();
  } catch (error) {
    console.error('Error guardando categoría:', error);
    showError('Error al guardar categoría: ' + error.message);
  }
}

async function deleteCategory(categoryId) {
  const result = await confirmAction('¿Estás seguro de eliminar esta categoría?');
  if (!result.isConfirmed) return;
  
  try {
    // Verificar si tiene hijos
    const children = contactCategories.filter(c => c.parentId === categoryId);
    if (children.length > 0) {
      showError('No se puede eliminar: tiene subcategorías. Elimina primero las subcategorías.');
      return;
    }
    
    // Verificar si hay contactos usando esta categoría
    const contactsSnap = await db.collection('contacts')
      .where('categoryId', '==', categoryId)
      .limit(1)
      .get();
    
    if (!contactsSnap.empty) {
      showError('No se puede eliminar: hay contactos usando esta categoría');
      return;
    }
    
    await db.collection('contactCategories').doc(categoryId).delete();
    showToast('Categoría eliminada correctamente');
    await loadContactCategories();
    renderCategoriesTree();
    renderFilters();
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    showError('Error al eliminar categoría: ' + error.message);
  }
}

// ============================================
// IMPORT/EXPORT
// ============================================
async function importCSV(file) {
  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  
  let success = 0;
  let errors = 0;
  const errorMessages = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    
    try {
      // Procesar fila
      await processCSVRow(row);
      success++;
    } catch (error) {
      errors++;
      errorMessages.push(`Fila ${i + 1}: ${error.message}`);
    }
  }
  
  Swal.fire({
    title: 'Importación completada',
    html: `
      <p>Correctos: ${success}</p>
      <p>Errores: ${errors}</p>
      ${errorMessages.length > 0 ? `<pre style="text-align: left; max-height: 200px; overflow-y: auto;">${errorMessages.join('\n')}</pre>` : ''}
    `,
    icon: errors > 0 ? 'warning' : 'success'
  });
  
  await loadContacts();
}

async function processCSVRow(row) {
  // Resolver scope y branch
  const scope = row.scope || 'general';
  let branchId = null;
  let branchName = null;
  let companyId = null;
  
  if (scope === 'branch' && row.branchCodeOrId) {
    const branch = branches.find(b => 
      b.id === row.branchCodeOrId || 
      b.code === row.branchCodeOrId ||
      b.name === row.branchCodeOrId
    );
    if (branch) {
      branchId = branch.id;
      branchName = branch.name;
      companyId = branch.empresaId || '';
    } else {
      throw new Error(`Sucursal no encontrada: ${row.branchCodeOrId}`);
    }
  }
  
  // Resolver tipo
  let typeId = null;
  let typeName = '';
  if (row.typeName) {
    let type = contactTypes.find(t => t.name.toLowerCase() === row.typeName.toLowerCase());
    if (!type) {
      // Crear tipo si no existe
      const result = await Swal.fire({
        title: 'Tipo no encontrado',
        text: `¿Crear tipo "${row.typeName}"?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        cancelButtonText: 'No'
      });
      
      if (result.isConfirmed) {
        const typeNameUpper = row.typeName.trim().toUpperCase();
        const newType = {
          name: typeNameUpper,
          description: '',
          color: '#007bff',
          sort: 0,
          isActive: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        const typeRef = await db.collection('contactTypes').add(newType);
        typeId = typeRef.id;
        typeName = typeNameUpper;
        await loadContactTypes();
      } else {
        throw new Error(`Tipo no encontrado: ${row.typeName}`);
      }
    } else {
      typeId = type.id;
      typeName = type.name;
    }
  }
  
  // Resolver categoría
  let categoryId = null;
  let categoryFullName = '';
  if (row.categoryPath) {
    const pathParts = row.categoryPath.split('>').map(p => p.trim());
    categoryId = await resolveCategoryPath(pathParts);
    if (categoryId) {
      const category = contactCategories.find(c => c.id === categoryId);
      categoryFullName = category ? (category.fullName || category.name) : '';
    }
  }
  
  // Procesar emails
  const emails = [];
  if (row.emails) {
    const emailPairs = row.emails.split('|');
    emailPairs.forEach(pair => {
      const [type, value] = pair.split(':').map(s => s.trim());
      if (value && isValidEmail(value)) {
        emails.push({ type: type || 'work', value });
      }
    });
  }
  
  // Procesar teléfonos
  const phones = [];
  if (row.phones) {
    const phonePairs = row.phones.split('|');
    phonePairs.forEach(pair => {
      const [type, value] = pair.split(':').map(s => s.trim());
      if (value) {
        const phoneDigits = normalizePhone(value);
        const countryCode = value.includes('+') ? value.match(/\+?\d{1,3}/)?.[0] || '+502' : '+502';
        phones.push({ 
          type: type || 'mobile', 
          countryCode, 
          value: phoneDigits 
        });
      }
    });
  }
  
  // Tags (procesar por líneas o comas, convertir a mayúsculas)
  let tags = [];
  if (row.tags) {
    // Intentar por líneas primero, luego por comas
    if (row.tags.includes('\n')) {
      tags = row.tags.split('\n').map(t => t.trim()).filter(t => t);
    } else {
      tags = row.tags.split(',').map(t => t.trim()).filter(t => t);
    }
    tags = tags.map(t => t.toUpperCase());
  }
  
  // Construir contacto (todo en mayúsculas)
  const firstName = (row.firstName || '').trim().toUpperCase();
  const lastName = (row.lastName || '').trim().toUpperCase();
  const displayName = `${firstName} ${lastName}`.trim();
  
  const contactData = {
    scope,
    branchId,
    branchName: branchName ? branchName.toUpperCase() : null,
    companyId,
    companyName: row.companyName ? row.companyName.trim().toUpperCase() : null,
    typeId,
    typeName: typeName ? typeName.toUpperCase() : '',
    categoryId,
    categoryFullName: categoryFullName ? categoryFullName.toUpperCase() : '',
    firstName,
    lastName,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    emails,
    phones,
    tags,
    searchEmails: emails.map(e => e.value.toLowerCase()),
    searchPhones: phones.map(p => normalizePhone(p.value)),
    notes: row.notes || null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: currentUser,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: currentUser
  };
  
  await db.collection('contacts').add(contactData);
}

async function resolveCategoryPath(pathParts) {
  let currentParentId = null;
  
  for (const part of pathParts) {
    let category = contactCategories.find(c => 
      c.name.toLowerCase() === part.toLowerCase() &&
      (c.parentId === currentParentId || (!c.parentId && !currentParentId))
    );
    
    if (!category) {
      // Crear categoría faltante
      const result = await Swal.fire({
        title: 'Categoría no encontrada',
        text: `¿Crear categoría "${part}"?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        cancelButtonText: 'No'
      });
      
      if (result.isConfirmed) {
        const partUpper = part.trim().toUpperCase();
        const path = currentParentId ? 
          [...(contactCategories.find(c => c.id === currentParentId)?.path || []), currentParentId] : 
          [];
        const parent = currentParentId ? contactCategories.find(c => c.id === currentParentId) : null;
        const parentFullName = parent ? (parent.fullName || parent.name).toUpperCase() : '';
        const fullName = parent ? parentFullName + ' / ' + partUpper : partUpper;
        
        const newCategory = {
          name: partUpper,
          parentId: currentParentId,
          path,
          fullName,
          sort: 0,
          isActive: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const categoryRef = await db.collection('contactCategories').add(newCategory);
        await loadContactCategories();
        category = contactCategories.find(c => c.id === categoryRef.id);
      } else {
        return null;
      }
    }
    
    if (category) {
      currentParentId = category.id;
    } else {
      return null;
    }
  }
  
  return currentParentId;
}

function exportCSV() {
  if (contacts.length === 0) {
    showError('No hay contactos para exportar');
    return;
  }
  
  const headers = [
    'scope', 'branchCodeOrId', 'typeName', 'categoryPath', 'firstName', 'lastName',
    'companyName', 'emails', 'phones', 'tags', 'notes'
  ];
  
  const rows = contacts.map(contact => {
    const emails = (contact.emails || []).map(e => `${e.type}:${e.value}`).join('|');
    const phones = (contact.phones || []).map(p => `${p.type}:${p.countryCode || ''}${p.value}`).join('|');
    // Tags: uno por línea (separados por \n)
    const tags = (contact.tags || []).join('\n');
    const categoryPath = contact.categoryFullName ? contact.categoryFullName.replace(/\s*\/\s*/g, ' > ') : '';
    
    return [
      contact.scope || 'general',
      contact.branchId || contact.branchName || '',
      contact.typeName || '',
      categoryPath,
      contact.firstName || '',
      contact.lastName || '',
      contact.companyName || '',
      emails,
      phones,
      tags,
      (contact.notes || '').replace(/\n/g, ' ')
    ];
  });
  
  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `contactos_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('CSV exportado correctamente');
}

// Exponer funciones globales para onclick
window.viewContact = viewContact;
window.editContact = editContact;
window.deleteContact = deleteContact;
window.openWhatsApp = openWhatsApp;
window.copyContactInfo = copyContactInfo;
window.openTypeForm = openTypeForm;
window.deleteType = deleteType;
window.openCategoryForm = openCategoryForm;
window.deleteCategory = deleteCategory;

