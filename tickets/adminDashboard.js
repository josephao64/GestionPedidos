/* adminDashboard.js - SPA Kanban minimalista con Drag & Drop nativo */
(function(){
  // Datos iniciales en memoria
  const tickets = [];
  let ticketCounter = 0; // Contador para IDs incrementales
  let activeFilters = {}; // Filtros activos

  // Helpers
  const byStatus = s => tickets.filter(t => t.status === s);
  const el = id => document.getElementById(id);

  // Obtener el siguiente ID incremental
  function getNextTicketId() {
    ticketCounter++;
    return ticketCounter;
  }

  // Asignar ID incremental a tickets existentes si no lo tienen
  function assignIncrementalIds() {
    tickets.forEach((t, index) => {
      if (!t.incrementalId) {
        t.incrementalId = index + 1;
        ticketCounter = Math.max(ticketCounter, t.incrementalId);
      }
    });
  }

  // Render
  function renderBoard(){
    if (searchFilter || Object.keys(activeFilters).some(k => activeFilters[k])) {
      filterTickets();
      return;
    }
    ['todo','inprogress','done'].forEach(status =>{
      const container = el('col-' + status);
      if (!container) return;
      container.innerHTML = '';
      byStatus(status).forEach(t => container.appendChild(createCard(t)));
    });
  }

  function createCard(t){
    const card = document.createElement('div');
    const priority = t.priority || 'normal';
    const priorityClass = priority === 'urgent' ? 'urgent' : (priority === 'low' ? 'low' : 'normal');
    card.className = `card ticket-card priority-${priorityClass}`;
    card.draggable = true;
    card.dataset.id = t.id;

    const body = document.createElement('div');
    body.className = 'card-body p-2';
    const hasAttachment = t.image || (Array.isArray(t.attachments) && t.attachments.length > 0);
    
    // Indicador de prioridad
    const priorityEmoji = priority === 'urgent' ? '🔴' : (priority === 'low' ? '🔵' : '🟡');
    const priorityText = priority === 'urgent' ? 'Urgente' : (priority === 'low' ? 'Baja' : 'Normal');
    
    // Formatear fecha
    const createdDate = t.createdAt && t.createdAt.toDate ? t.createdAt.toDate() : (t.createdAtLocal ? new Date(t.createdAtLocal) : new Date());
    const dateStr = createdDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    
    const sucursal = escapeHtml(t.sucursalName || t.sucursal || 'N/A');
    const categoria = escapeHtml(t.category || t.subCategory || 'N/A');
    const dateStrLarge = createdDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    
    body.innerHTML = `
      <div class="ticket-date-large mb-2">${dateStrLarge}</div>
      <div class="d-flex justify-content-between align-items-start mb-1">
        <div class="flex-grow-1">
          <h6 class="card-ticket-title mb-1">
            <span class="priority-indicator ${priorityClass}"></span>
            <strong class="text-primary">#${t.incrementalId || 'N/A'}</strong> - ${escapeHtml(t.title)}
          </h6>
          <div class="card-ticket-info-compact">
            <span class="badge bg-light text-dark me-1">📍 ${sucursal}</span>
            <span class="badge bg-light text-dark">📂 ${categoria}</span>
          </div>
        </div>
        <div class="text-end ms-2">
          ${hasAttachment ? '<span class="badge bg-secondary badge-attach">🖼️</span>' : ''}
        </div>
      </div>
      <div class="d-flex justify-content-between align-items-center mt-2">
        <span class="badge bg-${priorityClass === 'urgent' ? 'danger' : (priorityClass === 'low' ? 'info' : 'warning')} badge-attach">
          ${priorityEmoji} ${priorityText}
        </span>
        <div class="ticket-actions-compact">
          <button class="btn btn-sm btn-view" data-ticket-id="${t.id}">Ver</button>
          <button class="btn btn-sm btn-delete" data-ticket-id="${t.id}" data-ticket-title="${escapeHtml(t.title)}" title="Eliminar">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
              <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    card.appendChild(body);

    // Click abre modal
    card.addEventListener('click', (evt) => {
      if (card.classList.contains('dragging')) return;
      // Si el click fue en el botón, prevenir propagación pero abrir modal
      if (evt.target.tagName === 'BUTTON' && evt.target.classList.contains('btn-view')) {
        evt.stopPropagation();
        openModal(t);
      } else if (evt.target.tagName === 'BUTTON' && evt.target.classList.contains('btn-delete')) {
        evt.stopPropagation();
        // No hacer nada aquí, el evento se maneja más abajo
      } else if (!evt.target.closest('.btn-delete') && !evt.target.closest('.btn-view')) {
        openModal(t);
      }
    });

    // Event listener para el botón de eliminar
    const deleteBtn = card.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        const ticketId = deleteBtn.dataset.ticketId;
        const ticketTitle = deleteBtn.dataset.ticketTitle || 'este ticket';
        if (confirm(`¿Estás seguro de que deseas eliminar el ticket "${ticketTitle}"?\n\nEsta acción no se puede deshacer.`)) {
          deleteTicket(ticketId);
        }
      });
    }

    // Drag events
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', t.id);
      if (e.dataTransfer.setDragImage) {
        const crt = card.cloneNode(true);
        crt.style.position = 'absolute'; crt.style.top = '-1000px'; document.body.appendChild(crt);
        e.dataTransfer.setDragImage(crt, 10, 10);
        setTimeout(() => document.body.removeChild(crt), 0);
      }
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    return card;
  }

  // Modal population and editing
  const modalEl = el('ticketModal');
  const bsModal = modalEl ? new bootstrap.Modal(modalEl) : null;
  let currentTicketRef = null; // either docId string or local ticket id

  function renderCommentsArea(t) {
    const wrap = el('modalComments');
    wrap.innerHTML = '';
    const comments = t.comments || [];
    if (!comments.length) { 
      wrap.innerHTML = '<div class="text-muted small text-center py-3">Sin comentarios</div>'; 
      return; 
    }
    comments.slice().reverse().forEach(c => {
      const d = document.createElement('div');
      d.className = 'comment-item';
      const when = c.createdAt && c.createdAt.toDate ? new Date(c.createdAt.toDate()).toLocaleString() : (c.createdAt || c.when || '');
      const author = c.author || c.authorName || 'Usuario';
      d.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-1">
          <span class="comment-author">${escapeHtml(author)}</span>
          <span class="comment-time">${escapeHtml(when)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
      `;
      wrap.appendChild(d);
    });
  }

  function openModal(t){
    // t may be either plain object (local) or Firestore-like doc (with id and data())
    let data = t;
    if (t && t.data && typeof t.data === 'function') { data = t.data(); currentTicketRef = t.id; }
    else { currentTicketRef = data.id; }

    // Actualizar título del modal con ID incremental
    if (el('modalTitle')) {
      el('modalTitle').textContent = `Ticket #${data.incrementalId || 'N/A'} - ${data.title || data.ticketId || 'Sin título'}`;
    }

    el('modalSucursal').value = data.sucursalName || data.sucursal || '';
    
    // Formatear fecha para mostrar
    const createdDate = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : (data.createdAtLocal ? new Date(data.createdAtLocal) : new Date());
    const dateStr = createdDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (el('modalDate')) el('modalDate').value = dateStr;
    
    el('modalTitleInput').value = data.title || data.ticketId || data.ticketId || '';
    el('modalCategory').value = data.category || data.subCategory || '';
    el('modalDescription').value = data.desc || data.description || '';
    el('modalPriority').value = data.priority === 'urgent' ? 'urgent' : (data.priority === 'low' ? 'low' : 'normal');
    el('modalStatus').value = mapStatusToUI(data.status || data.state || 'todo');
    if (el('modalId')) el('modalId').value = data.id || data.ticketId || '';
    // soportar adjuntos subidos a Firestore: 'attachments' (array) o propiedad 'image' (dataURL/local)
    let imageSrc = null;
    if (data.image) imageSrc = data.image;
    else if (Array.isArray(data.attachments) && data.attachments.length > 0) {
      // tomar el primer attachment que tenga url
      const first = data.attachments.find(a => a && (a.url || a.downloadURL || a.path));
      imageSrc = first ? (first.url || first.downloadURL || null) : null;
    }
    if (imageSrc) {
      el('modalImage').src = imageSrc;
      el('modalImage').style.cursor = 'pointer';
      el('modalImage').onclick = () => window.open(imageSrc, '_blank');
      el('modalImageWrapper').style.display = 'block';
    } else {
      el('modalImageWrapper').style.display = 'none';
    }

    renderCommentsArea(data);
    bsModal.show();
  }

  function mapStatusToUI(status){
    if(!status) return 'todo';
    status = String(status).toLowerCase();
    if (['open','todo','pendiente','pending'].includes(status)) return 'todo';
    if (['inprogress','doing','in_progress'].includes(status)) return 'inprogress';
    if (['done','closed','resolved','resuelto'].includes(status)) return 'done';
    return 'todo';
  }

  // Eliminar ticket
  async function deleteTicket(ticketId) {
    try {
      // Eliminar de Firestore si está disponible
      if (window.db && ticketId) {
        await window.db.collection('tickets').doc(ticketId).delete();
      }
      
      // Eliminar del array local
      const index = tickets.findIndex(t => t.id === ticketId);
      if (index !== -1) {
        tickets.splice(index, 1);
      }
      
      // Re-renderizar el board
      renderBoard();
      
      // Cerrar modal si está abierto
      if (bsModal) {
        bsModal.hide();
      }
      
      // Mostrar mensaje de éxito
      alert('Ticket eliminado correctamente');
    } catch (error) {
      console.error('Error al eliminar ticket:', error);
      alert('Error al eliminar el ticket: ' + (error.message || error));
    }
  }

  // Drag & Drop handlers for dropzones
  function wireDropzones(){
    document.querySelectorAll('.dropzone').forEach(zone =>{
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drop-target');
      });
      zone.addEventListener('dragleave', (e) => {
        // Solo quitar si realmente salimos de la zona
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove('drop-target');
        }
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drop-target');
        const id = e.dataTransfer.getData('text/plain');
        const status = zone.dataset.status;
        moveTicketTo(id, status);
      });
      zone.addEventListener('dragend', () => {
        zone.classList.remove('drop-target');
      });
    });
  }

  function moveTicketTo(id,status){ 
    const t = tickets.find(x=>x.id===id); 
    if(!t) return; 
    t.status = status;
    // Actualizar en Firestore si está disponible
    if (window.db && window.firebase && id) {
      window.db.collection('tickets').doc(id).update({
        status: status,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      }).catch(e => console.warn('Error actualizando estado:', e));
    }
    renderBoard(); 
  }

  // Create new ticket flow
  const createModalEl = el('createModal');
  const bsCreate = createModalEl ? new bootstrap.Modal(createModalEl) : null;
  if (el('btnAdd')) el('btnAdd').addEventListener('click', ()=> bsCreate.show());
  if (el('btnCreate')) el('btnCreate').addEventListener('click', ()=>{
    const title = el('inputTitle').value.trim(); const desc = el('inputDesc').value.trim(); const priority = el('inputPriority').value; const file = el('inputImage').files[0];
    if(!title||!desc) return alert('Título y descripción obligatorios');
    const newId = generateId(); 
    const incrementalId = getNextTicketId();
    const newTicket = { id:newId, incrementalId, title, desc, priority, created:new Date().toLocaleString(), status:'todo', image:null };
    if(file){ const reader = new FileReader(); reader.onload = (ev)=>{ newTicket.image = ev.target.result; tickets.unshift(newTicket); renderBoard(); bsCreate.hide(); el('createForm').reset(); }; reader.readAsDataURL(file); } else { tickets.unshift(newTicket); renderBoard(); bsCreate.hide(); el('createForm').reset(); }
  });

  // Save changes from modal
  if (el('btnSaveTicket')) {
    el('btnSaveTicket').addEventListener('click', async () => {
      const title = el('modalTitleInput').value.trim();
      const category = el('modalCategory').value.trim();
      const desc = el('modalDescription').value.trim();
      const priority = el('modalPriority').value;
      const status = el('modalStatus').value;

      // find ticket in memory
  const local = tickets.find(x => x.id === currentTicketRef || x.id === (el('modalId') ? el('modalId').value : null));

      if (window.db && window.firebase && currentTicketRef) {
        // update Firestore doc
        try {
          await window.db.collection('tickets').doc(currentTicketRef).update({
            title: title || undefined,
            category: category || undefined,
            description: desc || undefined,
            desc: desc || undefined,
            priority: priority || undefined,
            status: status || undefined,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) { alert('Error al guardar en Firestore: ' + (e.message || e)); }
      } else if (local) {
        // update local object
        local.title = title; local.category = category; local.desc = desc; local.priority = priority; local.status = status;
      }

      // reflect locally
      renderBoard();
      bsModal.hide();
    });
  }

  // Add comment
  if (el('btnAddComment')) {
    el('btnAddComment').addEventListener('click', async () => {
      const text = el('newComment').value.trim();
      if (!text) return;
      const commentObj = { text, author: 'admin', createdAt: new Date().toISOString() };

      if (window.db && window.firebase && currentTicketRef) {
        try {
          await window.db.collection('tickets').doc(currentTicketRef).update({
            comments: window.firebase.firestore.FieldValue.arrayUnion({ text, author: 'admin', createdAt: window.firebase.firestore.FieldValue.serverTimestamp() })
          });
        } catch (e) { alert('Error al agregar comentario: ' + (e.message || e)); return; }
      } else {
        // local
          const local = tickets.find(x => x.id === currentTicketRef || x.id === (el('modalId') ? el('modalId').value : null));
        if (!local.comments) local.comments = [];
        local.comments.push({ text, author: 'admin', createdAt: new Date().toISOString() });
      }

      // refresh comments
  const ticket = tickets.find(x => x.id === currentTicketRef || x.id === (el('modalId') ? el('modalId').value : null)) || {};
      renderCommentsArea(ticket);
      el('newComment').value = '';
      renderBoard();
    });
  }

  // Utils
  function generateId(){ const n = Math.floor(Math.random()*900)+100; return 'TICKET-' + n; }
  function capitalize(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1): ''; }
  function prettyStatus(s){ if(s==='todo') return 'Pendiente'; if(s==='inprogress') return 'En Progreso'; if(s==='done') return 'Resuelto'; return s; }
  function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

  // Inicialización
  async function loadFromFirestore(){
    try {
      const snap = await window.db.collection('tickets').get();
      tickets.length = 0;
      ticketCounter = 0;
      snap.forEach(doc => {
        const d = doc.data();
        // normalize id
        d.id = doc.id;
        // normalizar status para que coincida con las columnas: 'todo'|'inprogress'|'done'
        d.status = mapStatusToUI(d.status || d.state || 'todo');
        // asegurar un title legible (fallback a area/subCategory o ticketId)
        d.title = d.title || (d.area ? `${d.area} · ${d.subCategory || ''}` : (d.ticketId || d.id));
        // mantener sucursalName si existe
        d.sucursalName = d.sucursalName || d.sucursal || '';
        tickets.push(d);
      });
      // Ordenar por fecha de creación (más antiguos primero para IDs incrementales)
      tickets.sort((a, b) => {
        const dateA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : Date.parse(a.createdAtLocal || 0);
        const dateB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : Date.parse(b.createdAtLocal || 0);
        return dateA - dateB; // Orden ascendente
      });
      // Asignar IDs incrementales
      assignIncrementalIds();
      renderBoard();
      loadFilterOptions();
    } catch (e) {
      console.warn('No se pudo cargar tickets desde Firestore:', e.message || e);
    }
  }

  // Búsqueda y filtros
  let searchFilter = '';
  function filterTickets() {
    const filtered = tickets.filter(t => {
      // Filtro de búsqueda de texto
      if (searchFilter) {
        const searchLower = searchFilter.toLowerCase();
        const title = (t.title || '').toLowerCase();
        const id = (t.ticketId || t.id || '').toLowerCase();
        const sucursal = (t.sucursalName || t.sucursal || '').toLowerCase();
        const category = ((t.category || t.subCategory) || '').toLowerCase();
        const desc = ((t.desc || t.description) || '').toLowerCase();
        const incrementalIdStr = String(t.incrementalId || '');
        if (!(title.includes(searchLower) || id.includes(searchLower) || 
             sucursal.includes(searchLower) || category.includes(searchLower) || 
             desc.includes(searchLower) || incrementalIdStr.includes(searchLower))) {
          return false;
        }
      }
      
      // Filtros activos
      if (activeFilters.status && mapStatusToUI(t.status || t.state || 'todo') !== activeFilters.status) {
        return false;
      }
      if (activeFilters.priority && t.priority !== activeFilters.priority) {
        return false;
      }
      if (activeFilters.sucursal && (t.sucursalName || t.sucursal) !== activeFilters.sucursal) {
        return false;
      }
      if (activeFilters.category && (t.category || t.subCategory) !== activeFilters.category) {
        return false;
      }
      if (activeFilters.ticketId && t.incrementalId !== parseInt(activeFilters.ticketId)) {
        return false;
      }
      
      // Filtros de fecha
      if (activeFilters.dateFrom || activeFilters.dateTo || activeFilters.dateExact) {
        const ticketDate = t.createdAt && t.createdAt.toDate ? t.createdAt.toDate() : (t.createdAtLocal ? new Date(t.createdAtLocal) : new Date());
        const ticketDateOnly = new Date(ticketDate.getFullYear(), ticketDate.getMonth(), ticketDate.getDate());
        
        if (activeFilters.dateExact) {
          const exactDate = new Date(activeFilters.dateExact);
          const exactDateOnly = new Date(exactDate.getFullYear(), exactDate.getMonth(), exactDate.getDate());
          if (ticketDateOnly.getTime() !== exactDateOnly.getTime()) {
            return false;
          }
        } else {
          if (activeFilters.dateFrom) {
            const fromDate = new Date(activeFilters.dateFrom);
            if (ticketDateOnly < fromDate) {
              return false;
            }
          }
          if (activeFilters.dateTo) {
            const toDate = new Date(activeFilters.dateTo);
            toDate.setHours(23, 59, 59, 999); // Incluir todo el día
            if (ticketDateOnly > toDate) {
              return false;
            }
          }
        }
      }
      
      return true;
    });
    
    // Renderizar con tickets filtrados
    ['todo','inprogress','done'].forEach(status => {
      const container = el('col-' + status);
      if (!container) return;
      container.innerHTML = '';
      filtered.filter(t => mapStatusToUI(t.status || t.state || 'todo') === status)
        .forEach(t => container.appendChild(createCard(t)));
    });
  }

  // Cargar opciones de filtros desde los tickets
  function loadFilterOptions() {
    const sucursales = new Set();
    const categories = new Set();
    
    tickets.forEach(t => {
      if (t.sucursalName || t.sucursal) sucursales.add(t.sucursalName || t.sucursal);
      if (t.category || t.subCategory) categories.add(t.category || t.subCategory);
    });
    
    // Llenar select de sucursales
    const sucursalSelect = el('filterSucursal');
    if (sucursalSelect) {
      const currentValue = sucursalSelect.value;
      sucursalSelect.innerHTML = '<option value="">Todas</option>';
      Array.from(sucursales).sort().forEach(s => {
        const option = document.createElement('option');
        option.value = s;
        option.textContent = s;
        sucursalSelect.appendChild(option);
      });
      sucursalSelect.value = currentValue;
    }
    
    // Llenar select de categorías
    const categorySelect = el('filterCategory');
    if (categorySelect) {
      const currentValue = categorySelect.value;
      categorySelect.innerHTML = '<option value="">Todas</option>';
      Array.from(categories).sort().forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        categorySelect.appendChild(option);
      });
      categorySelect.value = currentValue;
    }
  }

  // Modal de filtros
  const filtersModalEl = el('filtersModal');
  const bsFiltersModal = filtersModalEl ? new bootstrap.Modal(filtersModalEl) : null;

  // Botón de inicio
  if (el('btnHome')) {
    el('btnHome').addEventListener('click', () => {
      window.location.href = '../INDEX.HTML';
    });
  }

  // Búsqueda
  if (el('searchInput')) {
    el('searchInput').addEventListener('input', (e) => {
      searchFilter = e.target.value.trim();
      filterTickets();
    });
  }

  // Filtros individuales
  ['filterSucursal', 'filterCategory', 'filterPriority', 'filterStatus', 'filterTicketId', 'filterDateFrom', 'filterDateTo', 'filterDateExact'].forEach(filterId => {
    const filterEl = el(filterId);
    if (filterEl) {
      filterEl.addEventListener('change', () => {
        applyFiltersFromUI();
        filterTickets();
      });
      if (filterId.includes('Date') || filterId === 'filterTicketId') {
        filterEl.addEventListener('input', () => {
          applyFiltersFromUI();
          filterTickets();
        });
      }
    }
  });

  // Función para aplicar filtros desde UI
  function applyFiltersFromUI() {
    activeFilters = {
      status: el('filterStatus')?.value || null,
      priority: el('filterPriority')?.value || null,
      sucursal: el('filterSucursal')?.value || null,
      category: el('filterCategory')?.value || null,
      ticketId: el('filterTicketId')?.value || null,
      dateFrom: el('filterDateFrom')?.value || null,
      dateTo: el('filterDateTo')?.value || null,
      dateExact: el('filterDateExact')?.value || null
    };
    // Si hay fecha exacta, limpiar rango
    if (activeFilters.dateExact) {
      activeFilters.dateFrom = null;
      activeFilters.dateTo = null;
      if (el('filterDateFrom')) el('filterDateFrom').value = '';
      if (el('filterDateTo')) el('filterDateTo').value = '';
    }
    // Si hay rango, limpiar fecha exacta
    if (activeFilters.dateFrom || activeFilters.dateTo) {
      activeFilters.dateExact = null;
      if (el('filterDateExact')) el('filterDateExact').value = '';
    }
  }

  // Filtros
  if (el('btnFilters')) {
    el('btnFilters').addEventListener('click', () => {
      loadFilterOptions();
      bsFiltersModal.show();
    });
  }

  // Limpiar filtros
  if (el('btnClearFilters')) {
    el('btnClearFilters').addEventListener('click', () => {
      activeFilters = {};
      searchFilter = '';
      if (el('filterStatus')) el('filterStatus').value = '';
      if (el('filterPriority')) el('filterPriority').value = '';
      if (el('filterSucursal')) el('filterSucursal').value = '';
      if (el('filterCategory')) el('filterCategory').value = '';
      if (el('filterTicketId')) el('filterTicketId').value = '';
      if (el('filterDateFrom')) el('filterDateFrom').value = '';
      if (el('filterDateTo')) el('filterDateTo').value = '';
      if (el('filterDateExact')) el('filterDateExact').value = '';
      if (el('searchInput')) el('searchInput').value = '';
      filterTickets();
    });
  }

  function init(){
    wireDropzones();
    if (window.db) loadFromFirestore();
    renderBoard();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
