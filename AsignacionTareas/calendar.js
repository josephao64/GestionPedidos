// calendar.js
import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  // ======= DOM (Sucursales) =======
  const branchForm        = document.getElementById('branch-form');
  const branchIdInput     = document.getElementById('branch-id');
  const branchNameInput   = document.getElementById('branch-name');
  const branchesList      = document.getElementById('branches-list');

  // ======= DOM (Calendario) =======
  const viewSelect        = document.getElementById('view-select');
  const prevMonthBtn      = document.getElementById('prevMonth');
  const nextMonthBtn      = document.getElementById('nextMonth');
  const prevYearBtn       = document.getElementById('prevYear');
  const nextYearBtn       = document.getElementById('nextYear');
  const calendarTitle     = document.getElementById('calendar-title');
  const weekdayHeaderEl   = document.getElementById('weekday-header');
  const calendarEl        = document.getElementById('calendar');
  const yearViewEl        = document.getElementById('year-view');
  const listViewEl        = document.getElementById('list-view');

  // ======= DOM (Filtros tareas) =======
  const filterMonthInput   = document.getElementById('task-filter-month');
  const filterDateInput    = document.getElementById('task-filter-date');
  const filterStatusSelect = document.getElementById('task-filter-status');
  const filterCategorySelect = document.getElementById('task-filter-category');
  const generatePdfBtn     = document.getElementById('generate-pdf');
  const taskListEl         = document.getElementById('task-list');

  // ======= DOM (Formulario tarea) =======
  const taskForm           = document.getElementById('task-form');
  const taskIdInput        = document.getElementById('task-id');
  const branchSelect       = document.getElementById('task-branch');
  const titleInput         = document.getElementById('task-title');
  const dateInput          = document.getElementById('task-date');
  const repeatInput        = document.getElementById('task-repeat');
  const alertCheck         = document.getElementById('task-alert');
  const alertOptions       = document.getElementById('alert-options');
  const alertTimeSelect    = document.getElementById('task-alert-time');
  const acceptCheck        = document.getElementById('task-accept');
  const saveTaskBtn        = document.getElementById('task-save-btn');
  const taskCategorySelect = document.getElementById('task-category');

  // ======= DOM (Notas) =======
  const notesModalEl       = document.getElementById('notesModal');
  const existingNotesEl    = document.getElementById('existing-notes');
  const notesTaskIdInput   = document.getElementById('notes-task-id');
  const notesTaskDateInput = document.getElementById('notes-task-date');
  const newNoteTextarea    = document.getElementById('new-note');
  const addNoteBtn         = document.getElementById('add-note-btn');
  const addNoteCompleteBtn = document.getElementById('add-note-complete-btn');

  // ======= DOM (Categorías) =======
  const categoryForm       = document.getElementById('category-form');
  const categoryIdInput    = document.getElementById('category-id');
  const categoryNameInput  = document.getElementById('category-name');
  const categoriesListEl   = document.getElementById('categories-list');

  // ======= DOM (Toasts) =======
  const toastHost          = document.getElementById('toastHost');

  // ======= STATE =======
  let branches = [];
  let tasks    = [];
  let categories = [];

  const today   = new Date();
  const todayDs = dsFromDate(today);
  let currentMonth = today.getMonth();
  let currentYear  = today.getFullYear();

  // Swatches de color de tarea (los radios están en el HTML)
  const TASK_COLORS = [
    '#FFCDD2','#C8E6C9','#BBDEFB','#FFF9C4','#D1C4E9',
    '#FFE0B2','#DCEDC8','#B3E5FC','#F0F4C3','#E1BEE7'
  ];

  const ALERT_OFFSETS = {
    "Al momento":       0,
    "10 minutos antes": 10*60*1000,
    "1 hora antes":     60*60*1000,
    "1 día antes":      24*60*60*1000,
    "3 días antes":     3*24*60*60*1000
  };

  // ======= UTILS =======
  function dsFromDate(d){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function monthLabel(y, m){
    return new Date(y, m, 1).toLocaleDateString('es', { month:'long', year:'numeric' })
      .replace(' de ', ' ')
      .replace(/^./, s => s.toUpperCase());
  }
  function showToast(msg, variant='primary'){
    const el = document.createElement('div');
    el.className = `toast align-items-center text-bg-${variant} border-0`;
    el.role = 'alert';
    el.ariaLive = 'assertive';
    el.ariaAtomic = 'true';
    el.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${msg}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>`;
    toastHost.append(el);
    const t = new bootstrap.Toast(el, { delay: 3000 });
    t.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
  }
  function branchNameById(id){
    const b = branches.find(x => x.id === id);
    return b ? b.name : '';
  }
  function categoryById(id){
    return categories.find(c => c.id === id) || null;
  }

  // ======= NOTIFICATION PERMISSION =======
  if ("Notification" in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') showToast('Notificaciones del sistema activadas ✅', 'success');
        if (p === 'denied')  showToast('Has bloqueado las notificaciones del sistema.', 'warning');
      });
    }
  }

  // ======= FILTERS INIT =======
  filterMonthInput.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  filterMonthInput.addEventListener('change', renderTaskTable);
  filterDateInput.addEventListener('change', renderTaskTable);
  filterStatusSelect.addEventListener('change', renderTaskTable);
  filterCategorySelect?.addEventListener('change', renderTaskTable);

  // ======= UI HANDLERS =======
  alertCheck.addEventListener('change', () => {
    alertOptions.style.display = alertCheck.checked ? 'block' : 'none';
  });
  acceptCheck.addEventListener('change', () => {
    saveTaskBtn.disabled = !acceptCheck.checked;
  });

  viewSelect.addEventListener('change', () => {
    const v = viewSelect.value;
    weekdayHeaderEl.style.display = v === 'month' ? 'grid' : 'none';
    calendarEl.style.display     = v === 'month' ? 'grid' : 'none';
    yearViewEl.style.display     = v === 'year'  ? 'grid' : 'none';
    listViewEl.style.display     = v === 'list'  ? 'block' : 'none';
    renderAll();
  });

  prevMonthBtn.onclick = () => {
    currentMonth = (currentMonth + 11) % 12;
    if (currentMonth === 11) currentYear--;
    renderAll();
  };
  nextMonthBtn.onclick = () => {
    currentMonth = (currentMonth + 1) % 12;
    if (currentMonth === 0) currentYear++;
    renderAll();
  };
  prevYearBtn.onclick = () => { currentYear--; renderAll(); };
  nextYearBtn.onclick = () => { currentYear++; renderAll(); };

  // ======= FIRESTORE STREAMS =======
  onSnapshot(query(collection(db,'branches'), orderBy('createdAt')), snap => {
    branches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBranches();
    populateBranchSelect();
  });

  onSnapshot(query(collection(db,'categories'), orderBy('createdAt')), snap => {
    categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    populateCategorySelects();
    renderCategories();
    // refrescar vistas que muestran chips de categoría
    renderAll();
    renderTaskTable();
  });

  onSnapshot(query(collection(db,'tasks'), orderBy('createdAt')), snap => {
    tasks = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      completedDates: d.data().completedDates || [],
      color: d.data().color || '#ffffff',
      notes: d.data().notes || [],
      categoryId: d.data().categoryId || '' // puede ser ''
    }));
    renderAll();
    renderTaskTable();
    renderTodayTasks();
    notifyTodayTasks();
  });

  // ======= CRUD BRANCH =======
  branchForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = branchNameInput.value.trim();
    if (!name) { showToast('Ingresa un nombre de sucursal.', 'warning'); return; }

    try {
      if (branchIdInput.value) {
        await updateDoc(doc(db,'branches',branchIdInput.value), { name });
        showToast('Sucursal actualizada.', 'success');
      } else {
        await addDoc(collection(db,'branches'), { name, createdAt: Date.now() });
        showToast('Sucursal creada.', 'success');
      }
      branchForm.reset();
      bootstrap.Modal.getInstance(document.getElementById('branchModal')).hide();
    } catch (err) {
      console.error(err);
      showToast('Error al guardar la sucursal.', 'danger');
    }
  });

  // ======= CRUD CATEGORY =======
  categoryForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = categoryNameInput.value.trim();
    const color = document.querySelector('input[name="category-color"]:checked')?.value || '#FFD166';
    if (!name) { showToast('Ingresa un nombre de categoría.', 'warning'); return; }

    // evitar duplicado por nombre (case-insensitive)
    const dup = categories.some(c => c.name.trim().toLowerCase() === name.toLowerCase() && c.id !== categoryIdInput.value);
    if (dup) { showToast('Ya existe una categoría con ese nombre.', 'info'); return; }

    try {
      if (categoryIdInput.value) {
        await updateDoc(doc(db,'categories', categoryIdInput.value), { name, color });
        showToast('Categoría actualizada ✅', 'success');
      } else {
        await addDoc(collection(db,'categories'), { name, color, createdAt: Date.now() });
        showToast('Categoría creada ✅', 'success');
      }
      categoryIdInput.value = '';
      categoryNameInput.value = '';
    } catch (err) {
      console.error(err);
      showToast('Error al guardar la categoría.', 'danger');
    }
  });

  function renderCategories(){
    if (!categoriesListEl) return;
    categoriesListEl.innerHTML = '';
    if (!categories.length) {
      categoriesListEl.innerHTML = '<li class="list-group-item text-muted">Aún no hay categorías.</li>';
      return;
    }
    categories.forEach(c => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `
        <span class="cat-badge">
          <span class="cat-dot" style="background:${c.color}"></span>
          <span>${c.name}</span>
        </span>
        <span></span>
      `;
      const actions = li.lastElementChild;

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn btn-sm btn-outline-primary me-2';
      btnEdit.textContent = '✏️';
      btnEdit.onclick = () => {
        categoryIdInput.value = c.id;
        categoryNameInput.value = c.name;
        // marcar color
        const radio = document.querySelector(`input[name="category-color"][value="${c.color}"]`);
        if (radio) radio.checked = true;
      };

      const btnDel = document.createElement('button');
      btnDel.className = 'btn btn-sm btn-danger';
      btnDel.textContent = '🗑';
      btnDel.onclick = async () => {
        if (!confirm('¿Eliminar esta categoría?')) return;
        try {
          // Si hay tareas que la usan, las dejamos sin categoría
          const used = tasks.filter(t => t.categoryId === c.id);
          if (used.length) {
            const ok = confirm(`Esta categoría está asignada a ${used.length} tarea(s). Se quitará de ellas. ¿Continuar?`);
            if (!ok) return;
            await Promise.all(used.map(t => updateDoc(doc(db,'tasks',t.id), { categoryId: '' })));
          }
          await deleteDoc(doc(db,'categories', c.id));
          showToast('Categoría eliminada.', 'success');
        } catch (err) {
          console.error(err);
          showToast('Error al eliminar la categoría.', 'danger');
        }
      };

      actions.append(btnEdit, btnDel);
      categoriesListEl.append(li);
    });
  }

  function populateCategorySelects(){
    // Select de filtro en pestaña Tareas
    if (filterCategorySelect) {
      const current = filterCategorySelect.value || 'all';
      filterCategorySelect.innerHTML = '<option value="all">Todas</option>';
      categories.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.name;
        filterCategorySelect.append(o);
      });
      // restaurar selección
      const exists = [...filterCategorySelect.options].some(op => op.value === current);
      filterCategorySelect.value = exists ? current : 'all';
    }

    // Select de categoría en modal de Tarea
    if (taskCategorySelect) {
      const selected = taskCategorySelect.value;
      taskCategorySelect.innerHTML = '<option value="" selected>Sin categoría</option>';
      categories.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.name;
        taskCategorySelect.append(o);
      });
      // Restaurar si había un valor
      if (selected && categories.some(c => c.id === selected)) {
        taskCategorySelect.value = selected;
      }
    }
  }

  // ======= CRUD TASK =======
  taskForm.addEventListener('submit', async e => {
    e.preventDefault();

    // VALIDACIONES
    const vBranch = branchSelect.value;
    const vTitle  = titleInput.value.trim();
    const vDate   = dateInput.value;
    const vRepeat = Number.isFinite(parseInt(repeatInput.value,10)) ? parseInt(repeatInput.value,10) : -1;
    const vCatId  = taskCategorySelect?.value || '';

    if (!vBranch) { showToast('Selecciona una sucursal.', 'warning'); return; }
    if (!vTitle)  { showToast('Escribe un título.', 'warning'); return; }
    if (!vDate)   { showToast('Selecciona una fecha.', 'warning'); return; }
    if (isNaN(vRepeat) || vRepeat < 0) { showToast('Repetición debe ser un número ≥ 0.', 'warning'); return; }
    if (!acceptCheck.checked) { showToast('Debes aceptar las modificaciones.', 'warning'); return; }

    // Evitar duplicados si es creación
    if (!taskIdInput.value && tasks.some(t =>
      t.branchId === vBranch &&
      t.title.trim().toLowerCase() === vTitle.toLowerCase() &&
      t.date === vDate
    )) {
      showToast('Ya existe una tarea igual para esa fecha.', 'info');
      taskForm.reset();
      acceptCheck.checked = false; saveTaskBtn.disabled = true;
      bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
      return;
    }

    // Color elegido
    const selectedColor = document.querySelector('input[name="task-color"]:checked')?.value || TASK_COLORS[0];

    const data = {
      branchId: vBranch,
      title: vTitle,
      date: vDate,
      repeatDays: vRepeat,
      alert: alertCheck.checked,
      alertTime: alertTimeSelect.value,
      color: selectedColor,
      categoryId: vCatId || '',
      ...(taskIdInput.value ? {} : { completedDates: [], notes: [] }),
      createdAt: Date.now()
    };

    try {
      if (taskIdInput.value) {
        await updateDoc(doc(db,'tasks',taskIdInput.value), data);
        showToast('Tarea actualizada ✅', 'success');
      } else {
        await addDoc(collection(db,'tasks'), data);
        showToast('Tarea creada ✅', 'success');
      }
      taskForm.reset();
      acceptCheck.checked = false; saveTaskBtn.disabled = true;
      alertOptions.style.display = 'none';
      bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
    } catch (err) {
      console.error(err);
      showToast('Error al guardar la tarea.', 'danger');
    }
  });

  addNoteBtn.addEventListener('click', async () => {
    const id      = notesTaskIdInput.value;
    const content = newNoteTextarea.value.trim();
    if (!content) { showToast('Escribe una nota.', 'warning'); return; }
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.notes.some(n => n.content === content)) {
      showToast('La misma nota ya existe.', 'info');
      return;
    }
    try {
      await updateDoc(doc(db,'tasks',id), {
        notes: arrayUnion({ date: new Date().toISOString(), content })
      });
      newNoteTextarea.value = '';
      showToast('Nota agregada.', 'success');
      openNotesModal(task, notesTaskDateInput.value);
    } catch (err) {
      console.error(err);
      showToast('Error al agregar la nota.', 'danger');
    }
  });

  addNoteCompleteBtn.addEventListener('click', async () => {
    const id      = notesTaskIdInput.value;
    const ds      = notesTaskDateInput.value;
    const content = newNoteTextarea.value.trim();
    if (!content) { showToast('Escribe una nota.', 'warning'); return; }
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.notes.some(n => n.content === content)) {
      bootstrap.Modal.getInstance(notesModalEl).hide();
      return;
    }
    try {
      await updateDoc(doc(db,'tasks',id), {
        notes: arrayUnion({ date: new Date().toISOString(), content }),
        completedDates: arrayUnion(ds)
      });
      bootstrap.Modal.getInstance(notesModalEl).hide();
      showToast('Nota agregada y tarea marcada como completada.', 'success');
      renderAll(); renderTaskTable(); renderTodayTasks();
    } catch (err) {
      console.error(err);
      showToast('Error al guardar la nota/estado.', 'danger');
    }
  });

  // ======= RENDER HOY =======
  function renderTodayTasks() {
    const due = tasks.filter(t => {
      const diff = Math.floor((new Date(todayDs) - new Date(t.date)) / (1000*60*60*24));
      return diff >= 0 &&
        ((t.repeatDays === 0 ? t.date === todayDs : diff % t.repeatDays === 0)) &&
        !t.completedDates.includes(todayDs);
    });

    let alertEl = document.getElementById('today-alert');
    if (alertEl) alertEl.remove();

    alertEl = document.createElement('div');
    alertEl.id = 'today-alert';
    alertEl.className = 'alert alert-info alert-dismissible fade show';
    alertEl.innerHTML = due.length
      ? '<strong>Tareas de hoy:</strong><ul class="mb-0">' + due.map(t => {
          const cat = categoryById(t.categoryId);
          const catLabel = cat ? ` — ${cat.name}` : '';
          return `<li>${t.title} (${branchNameById(t.branchId)}${catLabel})</li>`;
        }).join('') + '</ul>'
      : '<strong>Tareas de hoy:</strong> No hay tareas pendientes.';
    alertEl.innerHTML += '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>';

    // 🛠 FIX: container seguro (antes fallaba con .container null)
    const containerEl = document.querySelector('.container, .container-fluid') || document.body;
    containerEl.prepend(alertEl);
  }

  function notifyTodayTasks() {
    if (!("Notification" in window) || Notification.permission !== 'granted') return;
    const due = tasks.filter(t => {
      const diff = Math.floor((new Date(todayDs) - new Date(t.date)) / (1000*60*60*24));
      return diff >= 0 &&
        ((t.repeatDays === 0 ? t.date === todayDs : diff % t.repeatDays === 0)) &&
        !t.completedDates.includes(todayDs);
    });
    if (due.length) {
      const titles = due.map(t => {
        const cat = categoryById(t.categoryId);
        return `${t.title} (${branchNameById(t.branchId)})${cat ? ' — '+cat.name : ''}`;
      }).join(', ');
      const n = new Notification('Tareas de hoy', { body: titles });
      setTimeout(() => n.close(), 5000);
    }
  }

  // ======= RENDER BRANCHES =======
  function renderBranches() {
    branchesList.innerHTML = '';
    branches.forEach(b => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.textContent = b.name;

      const edit = document.createElement('button');
      edit.className = 'btn btn-sm btn-outline-primary me-2';
      edit.textContent = '✏️';
      edit.onclick = () => {
        branchIdInput.value   = b.id;
        branchNameInput.value = b.name;
        new bootstrap.Modal(document.getElementById('branchModal')).show();
      };

      const del = document.createElement('button');
      del.className = 'btn btn-sm btn-danger';
      del.textContent = '🗑';
      del.onclick = async () => {
        if (!confirm('¿Eliminar esta sucursal?')) return;
        try {
          await deleteDoc(doc(db,'branches',b.id));
          showToast('Sucursal eliminada.', 'success');
        } catch (err) {
          console.error(err);
          showToast('Error al eliminar la sucursal.', 'danger');
        }
      };

      li.append(edit, del);
      branchesList.append(li);
    });
  }
  function populateBranchSelect() {
    branchSelect.innerHTML = `<option value="" disabled selected>Selecciona sucursal</option>`;
    branches.forEach(b => {
      const o = document.createElement('option');
      o.value       = b.id;
      o.textContent = b.name;
      branchSelect.append(o);
    });
  }

  // ======= RENDER ROOT =======
  function renderAll() {
    const v = viewSelect.value;
    if (v === 'month') renderMonth();
    if (v === 'year')  renderYear();
    if (v === 'list')  renderList();
  }

  // ======= VISTA MES =======
  function renderMonth() {
    calendarEl.innerHTML = '';
    weekdayHeaderEl.style.display = 'grid';
    calendarEl.style.display = 'grid';
    yearViewEl.style.display = 'none';
    listViewEl.style.display = 'none';

    const firstDay    = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth+1, 0).getDate();
    calendarTitle.textContent = monthLabel(currentYear, currentMonth);

    for (let i = 0; i < firstDay; i++) {
      const e = document.createElement('div');
      e.className = 'day empty';
      calendarEl.append(e);
    }

    const MAX_PER_DAY = 2;

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayTasks = tasks.filter(t => {
        const diff = Math.floor((new Date(ds) - new Date(t.date)) / (1000*60*60*24));
        return diff >= 0 && (t.repeatDays === 0 ? t.date === ds : diff % t.repeatDays === 0);
      });

      const cell = document.createElement('div');
      cell.className =
        'day' +
        (dayTasks.length ? ' has-task' : '') +
        (ds === todayDs ? ' today' : '');

      const dv = document.createElement('div');
      dv.className = 'date';
      dv.textContent = d;

      const tasksWrap = document.createElement('div');
      tasksWrap.className = 'tasks';

      const toShow = dayTasks.slice(0, MAX_PER_DAY);
      toShow.forEach(t => {
        const span = document.createElement('span');
        const done = t.completedDates.includes(ds);
        span.className = 'task-title' + (done ? ' completed' : '');
        const cat = categoryById(t.categoryId);
        const label = `${t.title} (${branchNameById(t.branchId)})`;
        span.textContent = label;
        span.title = cat ? `${label} — ${cat.name}` : label;
        span.style.backgroundColor = t.color;
        span.onclick = () => openNotesModal(t, ds);
        tasksWrap.append(span);
      });

      const hidden = dayTasks.length - toShow.length;
      if (hidden > 0) {
        const more = document.createElement('span');
        more.className = 'more-tasks';
        more.textContent = `+${hidden} más`;
        more.title = dayTasks
          .slice(MAX_PER_DAY)
          .map(t => {
            const cat = categoryById(t.categoryId);
            return `${t.title} (${branchNameById(t.branchId)})${cat ? ' — '+cat.name : ''}`;
          })
          .join('\n');
        tasksWrap.append(more);
      }

      cell.append(dv, tasksWrap);
      calendarEl.append(cell);
    }
  }

  // ======= VISTA AÑO =======
  function renderYear() {
    yearViewEl.innerHTML = '';
    weekdayHeaderEl.style.display = 'none';
    calendarEl.style.display = 'none';
    listViewEl.style.display = 'none';
    calendarTitle.textContent = `${currentYear}`;

    for (let m = 0; m < 12; m++) {
      const sm = document.createElement('div');
      sm.className = 'small-calendar';
      const mn = new Date(currentYear, m, 1).toLocaleString('es', { month: 'long' });
      sm.innerHTML = `<div class="month-name">${mn}</div><div class="days"></div>`;
      const daysEl = sm.querySelector('.days');
      const first  = new Date(currentYear, m, 1).getDay();
      const dm     = new Date(currentYear, m+1, 0).getDate();

      for (let i = 0; i < first; i++) {
        const e = document.createElement('div');
        e.className = 'day empty';
        daysEl.append(e);
      }
      for (let d = 1; d <= dm; d++) {
        const ds  = `${currentYear}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const has = tasks.some(t => {
          const diff = Math.floor((new Date(ds) - new Date(t.date)) / (1000*60*60*24));
          return diff >= 0 && (t.repeatDays === 0 ? t.date === ds : diff % t.repeatDays === 0);
        });
        const td = document.createElement('div');
        td.className = 'day' + (has ? ' has-task' : '');
        td.textContent = d;
        if (has) {
          td.title = tasks
            .filter(t => {
              const diff = Math.floor((new Date(ds) - new Date(t.date)) / (1000*60*60*24));
              return diff >= 0 && (t.repeatDays === 0 ? t.date === ds : diff % t.repeatDays === 0);
            })
            .map(t => {
              const cat = categoryById(t.categoryId);
              return `${t.title} (${branchNameById(t.branchId)})${cat ? ' — '+cat.name : ''}`;
            })
            .join('\n');
        }
        daysEl.append(td);
      }
      yearViewEl.append(sm);
    }
  }

  // ======= VISTA LISTA (en pestaña Calendario) =======
  function renderList() {
    listViewEl.innerHTML = '';
    weekdayHeaderEl.style.display = 'none';
    calendarEl.style.display = 'none';
    yearViewEl.style.display = 'none';
    calendarTitle.textContent = `${monthLabel(currentYear, currentMonth)} • Lista`;

    const table = document.createElement('table');
    table.className = 'table table-hover align-middle';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width:120px;">Fecha</th>
          <th style="width:220px;">Sucursal</th>
          <th style="width:220px;">Categoría</th>
          <th>Tarea</th>
          <th style="width:120px;">Estado</th>
          <th style="width:160px;">Acciones</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    const daysInMonth = new Date(currentYear, currentMonth+1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayTasks = tasks.filter(t => {
        const diff = Math.floor((new Date(ds) - new Date(t.date)) / (1000*60*60*24));
        return diff >= 0 && (t.repeatDays === 0 ? t.date === ds : diff % t.repeatDays === 0);
      });
      if (!dayTasks.length) continue;

      dayTasks.forEach(t => {
        const done = t.completedDates.includes(ds);
        const cat  = categoryById(t.categoryId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge text-bg-light">${ds}</span></td>
          <td>${branchNameById(t.branchId)}</td>
          <td>${cat ? `<span class="cat-badge"><span class="cat-dot" style="background:${cat.color}"></span>${cat.name}</span>` : '<span class="text-muted">—</span>'}</td>
          <td><span class="badge" style="background:${t.color};border:1px solid rgba(0,0,0,.05)">${t.title}</span></td>
          <td>${done ? 'Completada' : 'Pendiente'}</td>
          <td class="text-nowrap"></td>
        `;
        const actions = tr.lastElementChild;

        const btnToggle = document.createElement('button');
        btnToggle.className = 'btn btn-sm ' + (done ? 'btn-success' : 'btn-outline-secondary');
        btnToggle.textContent = done ? '✅' : '⬜';
        btnToggle.onclick = async () => {
          try {
            await updateDoc(doc(db,'tasks',t.id), {
              completedDates: done ? arrayRemove(ds) : arrayUnion(ds)
            });
            showToast(done ? 'Marcado como pendiente.' : 'Marcado como completado.', 'success');
            renderAll(); renderTaskTable(); renderTodayTasks();
          } catch (err) {
            console.error(err);
            showToast('Error al cambiar estado.', 'danger');
          }
        };

        const btnNote = document.createElement('button');
        btnNote.className = 'btn btn-sm btn-outline-secondary ms-1';
        btnNote.textContent = '📝';
        btnNote.onclick = () => openNotesModal(t, ds);

        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-sm btn-outline-primary ms-1';
        btnEdit.textContent = '✏️';
        btnEdit.onclick = () => {
          taskIdInput.value   = t.id;
          branchSelect.value  = t.branchId;
          titleInput.value    = t.title;
          dateInput.value     = t.date;
          repeatInput.value   = t.repeatDays;
          alertCheck.checked  = t.alert;
          alertOptions.style.display = t.alert ? 'block' : 'none';
          alertTimeSelect.value = t.alertTime;
          // marcar color
          const radio = document.querySelector(`input[name="task-color"][value="${t.color}"]`);
          if (radio) radio.checked = true;
          // categoría
          if (taskCategorySelect) taskCategorySelect.value = t.categoryId || '';
          acceptCheck.checked = false; saveTaskBtn.disabled = true;
          new bootstrap.Modal(document.getElementById('taskModal')).show();
        };

        const btnDel = document.createElement('button');
        btnDel.className = 'btn btn-sm btn-danger ms-1';
        btnDel.textContent = '🗑';
        btnDel.onclick = async () => {
          if (!confirm('¿Eliminar esta tarea?')) return;
          try {
            await deleteDoc(doc(db,'tasks',t.id));
            showToast('Tarea eliminada.', 'success');
          } catch (err) {
            console.error(err);
            showToast('Error al eliminar la tarea.', 'danger');
          }
        };

        actions.append(btnToggle, btnNote, btnEdit, btnDel);
        tbody.append(tr);
      });
    }

    if (!tbody.children.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" class="text-center text-muted py-4">Sin tareas en este mes.</td>`;
      tbody.append(tr);
    }

    listViewEl.append(table);
  }

  // ======= LISTA DE TAREAS (pestaña Tareas) =======
  function renderTaskTable() {
    taskListEl.innerHTML = '';
    if (tasks.length === 0) {
      taskListEl.innerHTML = '<li class="list-group-item">No hay tareas.</li>';
      return;
    }
    const selectedMonth = filterMonthInput.value;
    const selectedDate  = filterDateInput.value;
    const statusFilter  = filterStatusSelect.value;
    const categoryFilter = filterCategorySelect?.value || 'all';
    let dsList = [];

    if (selectedDate) {
      dsList = [selectedDate];
    } else if (selectedMonth) {
      const [fY,fM] = selectedMonth.split('-').map(n => parseInt(n,10));
      const dim = new Date(fY, fM, 0).getDate();
      for (let d = 1; d <= dim; d++) {
        dsList.push(`${fY}-${String(fM).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
      }
    } else {
      dsList = [todayDs];
    }

    tasks.forEach(t => {
      const base = new Date(t.date);
      dsList.forEach(ds => {
        const diff = Math.floor((new Date(ds) - base) / (1000*60*60*24));
        if (diff < 0) return;
        if (!(t.repeatDays === 0 ? t.date === ds : diff % t.repeatDays === 0)) return;
        const done = t.completedDates.includes(ds);
        if (statusFilter === 'completed' && !done) return;
        if (statusFilter === 'pending' && done) return;
        if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return;

        const cat = categoryById(t.categoryId);

        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        const info = document.createElement('div');
        info.innerHTML = `
          <strong style="background:${t.color};padding:2px 6px;border-radius:4px;">
            ${t.title}
          </strong>
          ${cat ? `<span class="ms-2 cat-badge"><span class="cat-dot" style="background:${cat.color}"></span>${cat.name}</span>` : ''}
          <br/>
          <small>${ds}</small><br/>
          <small>Sucursal: ${branchNameById(t.branchId)}</small><br/>
          <small>Estado: ${done?'Completada':'Pendiente'}</small>
        `;
        const actions = document.createElement('div');

        const cb = document.createElement('button');
        cb.className = 'btn btn-sm me-2 ' + (done ? 'btn-success' : 'btn-outline-secondary');
        cb.textContent = done ? '✅' : '⬜';
        cb.onclick = async () => {
          try {
            await updateDoc(doc(db,'tasks',t.id), {
              completedDates: done ? arrayRemove(ds) : arrayUnion(ds)
            });
            showToast(done ? 'Marcado como pendiente.' : 'Marcado como completado.', 'success');
            renderAll();
            renderTaskTable();
            renderTodayTasks();
          } catch (err) {
            console.error(err);
            showToast('Error al cambiar estado.', 'danger');
          }
        };

        const noteBtn = document.createElement('button');
        noteBtn.className = 'btn btn-sm btn-outline-secondary me-2';
        noteBtn.textContent = '📝';
        noteBtn.onclick = () => openNotesModal(t, ds);

        const edt = document.createElement('button');
        edt.className = 'btn btn-sm btn-outline-primary me-2';
        edt.textContent = '✏️';
        edt.onclick = () => {
          taskIdInput.value   = t.id;
          branchSelect.value  = t.branchId;
          titleInput.value    = t.title;
          dateInput.value     = t.date;
          repeatInput.value   = t.repeatDays;
          alertCheck.checked  = t.alert;
          alertOptions.style.display = t.alert ? 'block' : 'none';
          alertTimeSelect.value = t.alertTime;
          taskCategorySelect.value = t.categoryId || '';
          const radio = document.querySelector(`input[name="task-color"][value="${t.color}"]`);
          if (radio) radio.checked = true;
          acceptCheck.checked = false; saveTaskBtn.disabled = true;
          new bootstrap.Modal(document.getElementById('taskModal')).show();
        };

        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-danger';
        del.textContent = '🗑';
        del.onclick = async () => {
          if (!confirm('¿Eliminar esta tarea?')) return;
          try {
            await deleteDoc(doc(db,'tasks',t.id));
            showToast('Tarea eliminada.', 'success');
          } catch (err) {
            console.error(err);
            showToast('Error al eliminar la tarea.', 'danger');
          }
        };

        actions.append(cb, noteBtn, edt, del);
        li.append(info, actions);
        taskListEl.append(li);
      });
    });

    if (!taskListEl.children.length) {
      taskListEl.innerHTML = '<li class="list-group-item text-muted">No hay tareas con ese filtro.</li>';
    }
  }

  function openNotesModal(t, ds) {
    notesTaskIdInput.value   = t.id;
    notesTaskDateInput.value = ds;
    existingNotesEl.innerHTML = '';
    if (t.notes.length) {
      t.notes.forEach(n => {
        const div = document.createElement('div');
        div.className = 'note-item';
        const dt = new Date(n.date).toLocaleString();
        div.innerHTML = `<small class="text-muted">${dt}</small><p class="mb-1">${n.content}</p>`;
        existingNotesEl.append(div);
      });
    } else {
      existingNotesEl.innerHTML = '<p class="text-muted">No hay notas.</p>';
    }
    newNoteTextarea.value = '';
    notesModalEl.removeAttribute('aria-hidden');
    new bootstrap.Modal(notesModalEl).show();
  }

  // ======= PDF =======
  generatePdfBtn.addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const [yr,mo] = filterMonthInput.value.split('-');
    pdf.setFontSize(16);
    pdf.text(`Tareas - ${yr}-${mo}`, 20, 30);
    pdf.setFontSize(12);
    const cols = ['Sucursal','Categoría','Tarea','Estado'], rows = [];
    const dim = new Date(yr, mo, 0).getDate();
    tasks.forEach(t => {
      const base = new Date(t.date);
      for (let d = 1; d <= dim; d++) {
        const ds = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const diff = Math.floor((new Date(ds) - base) / (1000*60*60*24));
        if (diff < 0) continue;
        if (!(t.repeatDays===0 ? t.date===ds : diff%t.repeatDays===0)) continue;
        const done = t.completedDates.includes(ds);
        const cat = categoryById(t.categoryId);
        rows.push([
          branchNameById(t.branchId),
          cat ? cat.name : '—',
          `${t.title} (${ds})`,
          done ? 'Completada' : 'Pendiente'
        ]);
      }
    });
    pdf.autoTable({ startY:40, head:[cols], body:rows, styles:{fontSize:10} });
    pdf.save(`Reporte_${yr}-${mo}.pdf`);
  });

  // ======= BOOT =======
  renderAll();
  renderTaskTable();
});
