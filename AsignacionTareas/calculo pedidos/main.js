// Datos iniciales de Sucursales
const data = [
    { Empresa: "VIPIZZA", Sucursal: "jalapa", PizzaMensual: 3462, FingersMensual: 356 },
    { Empresa: "VIPIZZA", Sucursal: "poptun", PizzaMensual: 3992, FingersMensual: 312 },
    { Empresa: "VIPIZZA", Sucursal: "zacapa", PizzaMensual: 5706, FingersMensual: 611 },
    { Empresa: "AMERICAN PIZZA", Sucursal: "santa elena", PizzaMensual: 5893, FingersMensual: 287 },
    { Empresa: "AMERICAN PIZZA", Sucursal: "pinula", PizzaMensual: 4639, FingersMensual: 379 },
    { Empresa: "AMERICAN PIZZA", Sucursal: "eskala", PizzaMensual: 2460, FingersMensual: 211 },
  ];
  
  // Inicialización de datos
  let pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
  let pagos = JSON.parse(localStorage.getItem('pagos')) || [];
  let lastIdPedidos = parseInt(localStorage.getItem('lastIdPedidos')) || 0;
  let lastIdPagos = parseInt(localStorage.getItem('lastIdPagos')) || 0;
  let selectedSucursal = '';
  let selectedMes = '';
  
  // Inicializar con datos predefinidos si no hay pedidos
  if (pedidos.length === 0) {
    const datosIniciales = [
      { id: 1, Empresa: "VIPIZZA", Sucursal: "jalapa", TipoCaja: "Pizza", Fecha: "2024-01-10", Cantidad: 50, PrecioUnitario: 10.00, PrecioTotal: 500.00, CantidadPagada: 0 },
      { id: 2, Empresa: "VIPIZZA", Sucursal: "poptun", TipoCaja: "Fingers", Fecha: "2024-01-15", Cantidad: 30, PrecioUnitario: 5.00, PrecioTotal: 150.00, CantidadPagada: 0 },
      { id: 3, Empresa: "AMERICAN PIZZA", Sucursal: "santa elena", TipoCaja: "Pizza", Fecha: "2024-02-05", Cantidad: 60, PrecioUnitario: 12.00, PrecioTotal: 720.00, CantidadPagada: 0 },
      { id: 4, Empresa: "AMERICAN PIZZA", Sucursal: "pinula", TipoCaja: "Fingers", Fecha: "2024-02-20", Cantidad: 40, PrecioUnitario: 6.00, PrecioTotal: 240.00, CantidadPagada: 0 },
    ];
    pedidos = datosIniciales;
    lastIdPedidos = 4;
    localStorage.setItem('pedidos', JSON.stringify(pedidos));
    localStorage.setItem('lastIdPedidos', lastIdPedidos);
  }
  
  // Elementos del DOM
  const selectSucursalMessage = document.getElementById('selectSucursalMessage');
  const appContent = document.getElementById('appContent');
  const pedidoModal = document.getElementById('pedidoModal');
  const modalTitlePedido = document.getElementById('modalTitlePedido');
  const pedidoForm = document.getElementById('pedidoForm');
  const pagoModal = document.getElementById('pagoModal');
  const modalTitlePago = document.getElementById('modalTitlePago');
  const pagoForm = document.getElementById('pagoForm');
  
  // Pedidos
  const empresaSelectPedido = document.getElementById('empresaPedido');
  const tipoCajaSelectPedido = document.getElementById('tipoCajaPedido');
  const sucursalSelectPedido = document.getElementById('sucursalPedido');
  const fechaPedidoInput = document.getElementById('fechaPedido');
  const cantidadInputPedido = document.getElementById('cantidadPedido');
  const precioUnitarioInputPedido = document.getElementById('precioUnitarioPedido');
  const precioTotalInputPedido = document.getElementById('precioTotalPedido');
  
  // Pagos
  const fechaPagoInput = document.getElementById('fechaPago');
  const boletaPagoInput = document.getElementById('boletaPago');
  const precioTotalPagadoInputPago = document.getElementById('precioTotalPagado');
  
  // Filtros y Búsqueda Pedidos
  const searchInputPedidos = document.getElementById('searchInputPedidos');
  const filterTipoCajaPedidos = document.getElementById('filterTipoCajaPedidos');
  const filterFechaDesdePedidos = document.getElementById('filterFechaDesdePedidos');
  const filterFechaHastaPedidos = document.getElementById('filterFechaHastaPedidos');
  const sortOrderPedidos = document.getElementById('sortOrderPedidos');
  const resetFiltersPedidos = document.getElementById('resetFiltersPedidos');
  
  // Filtros y Búsqueda Pagos
  const searchInputPagos = document.getElementById('searchInputPagos');
  const filterFechaDesdePagos = document.getElementById('filterFechaDesdePagos');
  const filterFechaHastaPagos = document.getElementById('filterFechaHastaPagos');
  const sortOrderPagos = document.getElementById('sortOrderPagos');
  const resetFiltersPagos = document.getElementById('resetFiltersPagos');
  
  // Resumen
  const totalPizzaPedidosEl = document.getElementById('totalPizzaPedidos');
  const totalFingersPedidosEl = document.getElementById('totalFingersPedidos');
  const totalPrecioPedidosEl = document.getElementById('totalPrecioPedidos');
  const totalPagadoEl = document.getElementById('totalPagado');
  const totalPendienteEl = document.getElementById('totalPendiente');
  const saldoEl = document.getElementById('saldo');
  
  // Opciones de Tipo de Caja por Empresa
  const tipoCajaOpciones = {
    "VIPIZZA": ["Pizza", "Fingers"],
    "AMERICAN PIZZA": ["Pizza", "Fingers"],
    "AMERICAN EXPRESSO": ["Pizza", "Fingers"]
  };
  
  // Actualizar opciones de Tipo de Caja según la Empresa seleccionada
  empresaSelectPedido.addEventListener('change', function() {
    const empresaSeleccionada = empresaSelectPedido.value;
    tipoCajaSelectPedido.innerHTML = '<option value="">Selecciona un tipo</option>';
    if (tipoCajaOpciones[empresaSeleccionada]) {
      tipoCajaOpciones[empresaSeleccionada].forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo;
        option.textContent = tipo;
        tipoCajaSelectPedido.appendChild(option);
      });
    }
  });
  
  // Funciones para el Modal de Pedido
  function abrirModalPedido() {
    if (!selectedSucursal || selectedSucursal === '') {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, selecciona una Sucursal antes de agregar un Pedido.'
      });
      return;
    }
    pedidoForm.reset();
    precioTotalInputPedido.value = '';
    modalTitlePedido.textContent = "Agregar Pedido";
    tipoCajaSelectPedido.innerHTML = '<option value="">Selecciona un tipo</option>';
    pedidoModal.style.display = "block";
  }
  
  function cerrarModalPedido() {
    pedidoModal.style.display = "none";
  }
  
  // Funciones para el Modal de Pago
  function abrirModalPago() {
    if (!selectedSucursal || selectedSucursal === '') {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, selecciona una Sucursal antes de registrar un Pago.'
      });
      return;
    }
    pagoForm.reset();
    precioTotalPagadoInputPago.value = '';
    let mesPago = selectedMes;
    if (!mesPago) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, selecciona un Mes Inicial antes de registrar un Pago.'
      });
      return;
    }
    modalTitlePago.textContent = "Registrar Pago";
    pagoModal.style.display = "block";
  }
  
  function cerrarModalPago() {
    pagoModal.style.display = "none";
  }
  
  // Cerrar los modales al hacer clic fuera
  window.onclick = function(event) {
    if (event.target == pedidoModal) {
      cerrarModalPedido();
    }
    if (event.target == pagoModal) {
      cerrarModalPago();
    }
  };
  
  // Calcular Precio Total automáticamente en Pedido
  function actualizarPrecioTotalPedido() {
    const cantidad = parseInt(cantidadInputPedido.value) || 0;
    const precioUnitario = parseFloat(precioUnitarioInputPedido.value) || 0;
    const precioTotal = cantidad * precioUnitario;
    precioTotalInputPedido.value = precioTotal.toFixed(8);
  }
  
  cantidadInputPedido.addEventListener('input', actualizarPrecioTotalPedido);
  precioUnitarioInputPedido.addEventListener('input', actualizarPrecioTotalPedido);
  
  // Manejar el envío del formulario para agregar/editar Pedido
  pedidoForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Verificar si se ingresó la cadena de texto
    const cadenaPedido = document.getElementById('pedidoCadena').value.trim();
    
    let empresa, tipoCaja, sucursal, fecha, cantidad, precioUnitario, precioTotal;
    
    if(cadenaPedido !== '') {
      // Se espera que la cadena tenga 6 valores separados por comas:
      // Empresa, TipoCaja, Sucursal, Fecha, Cantidad, PrecioUnitario
      const partes = cadenaPedido.split(',');
      if(partes.length !== 6) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'La cadena debe tener 6 valores separados por comas: Empresa, TipoCaja, Sucursal, Fecha, Cantidad, PrecioUnitario.'
        });
        return;
      }
      empresa = partes[0].trim();
      tipoCaja = partes[1].trim();
      sucursal = partes[2].trim();
      fecha = partes[3].trim();
      cantidad = parseInt(partes[4].trim());
      precioUnitario = parseFloat(partes[5].trim());
      precioTotal = cantidad * precioUnitario;
    } else {
      // Si no se usó la cadena, se recogen los datos de los campos individuales
      empresa = empresaSelectPedido.value;
      tipoCaja = tipoCajaSelectPedido.value;
      sucursal = sucursalSelectPedido.value;
      fecha = fechaPedidoInput.value;
      cantidad = parseInt(cantidadInputPedido.value) || 0;
      precioUnitario = parseFloat(precioUnitarioInputPedido.value) || 0;
      precioTotal = parseFloat(precioTotalInputPedido.value) || 0;
    }
    
    // Validar que se hayan ingresado todos los campos correctamente
    if (!empresa || !tipoCaja || !sucursal || !fecha || cantidad <= 0 || precioUnitario <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, completa todos los campos correctamente.'
      });
      return;
    }
    
    // Determinar si se está editando o agregando un pedido
    const isEditing = modalTitlePedido.textContent === "Editar Pedido";
    if (isEditing) {
      const pedidoId = parseInt(pedidoForm.dataset.pedidoId);
      const pedidoIndex = pedidos.findIndex(p => p.id === pedidoId);
      if (pedidoIndex !== -1) {
        pedidos[pedidoIndex].Empresa = empresa;
        pedidos[pedidoIndex].TipoCaja = tipoCaja;
        pedidos[pedidoIndex].Sucursal = sucursal;
        pedidos[pedidoIndex].Fecha = fecha;
        pedidos[pedidoIndex].Cantidad = cantidad;
        pedidos[pedidoIndex].PrecioUnitario = precioUnitario;
        pedidos[pedidoIndex].PrecioTotal = precioTotal;
        Swal.fire({
          icon: 'success',
          title: 'Actualizado',
          text: 'Pedido actualizado correctamente.'
        });
      }
    } else {
      lastIdPedidos += 1;
      const nuevoPedido = {
        id: lastIdPedidos,
        Empresa: empresa,
        Sucursal: sucursal,
        TipoCaja: tipoCaja,
        Fecha: fecha,
        Cantidad: cantidad,
        PrecioUnitario: precioUnitario,
        PrecioTotal: precioTotal,
        CantidadPagada: 0
      };
      pedidos.push(nuevoPedido);
      Swal.fire({
        icon: 'success',
        title: 'Agregado',
        text: 'Pedido agregado correctamente.'
      });
    }
    
    localStorage.setItem('pedidos', JSON.stringify(pedidos));
    localStorage.setItem('lastIdPedidos', lastIdPedidos);
    
    mostrarPedidos(selectedSucursal);
    mostrarPagos();
    cerrarModalPedido();
  });
  
  // Manejar el envío del formulario para agregar/editar Pago
  pagoForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const fechaPago = fechaPagoInput.value;
    const boletaPago = boletaPagoInput.value.trim();
    const precioTotalPagado = parseFloat(precioTotalPagadoInputPago.value) || 0;
    const mesPago = document.getElementById('filterMesInicial').value;
    
    if (!fechaPago || !boletaPago || precioTotalPagado <= 0 || !mesPago) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, completa todos los campos correctamente y asegúrate de que el Mes Inicial esté seleccionado.'
      });
      return;
    }
    
    const isEditing = modalTitlePago.textContent === "Editar Pago";
    if (isEditing) {
      const pagoId = parseInt(pagoForm.dataset.pagoId);
      const pagoIndex = pagos.findIndex(p => p.id === pagoId);
      if (pagoIndex !== -1) {
        pagos[pagoIndex].precioTotalPagado = precioTotalPagado;
        pagos[pagoIndex].fechaPago = fechaPago;
        pagos[pagoIndex].boletaPago = boletaPago;
        pagos[pagoIndex].mes = mesPago;
        
        Swal.fire({
          icon: 'success',
          title: 'Actualizado',
          text: 'Pago actualizado correctamente.'
        });
      }
    } else {
      lastIdPagos += 1;
      const nuevoPago = {
        id: lastIdPagos,
        Sucursal: selectedSucursal,
        fechaPago: fechaPago,
        boletaPago: boletaPago,
        precioTotalPagado: precioTotalPagado,
        mes: mesPago
      };
      pagos.push(nuevoPago);
      Swal.fire({
        icon: 'success',
        title: 'Registrado',
        text: 'Pago registrado correctamente.'
      });
    }
    
    localStorage.setItem('pagos', JSON.stringify(pagos));
    localStorage.setItem('lastIdPagos', lastIdPagos);
    
    mostrarPagos();
    mostrarPedidos(selectedSucursal);
    cerrarModalPago();
  });
  
  // Mostrar los pedidos en la tabla y actualizar el resumen
  function mostrarPedidos(sucursalFiltrada) {
    let pedidosFiltrados = [...pedidos];
    
    if (sucursalFiltrada !== '') {
      pedidosFiltrados = pedidosFiltrados.filter(pedido => pedido.Sucursal.toLowerCase() === sucursalFiltrada.toLowerCase());
    }
    
    if (selectedMes !== '') {
      const [year, month] = selectedMes.split('-').map(num => parseInt(num));
      pedidosFiltrados = pedidosFiltrados.filter(pedido => {
        const pedidoDate = new Date(pedido.Fecha);
        return pedidoDate.getFullYear() === year && (pedidoDate.getMonth() + 1) === month;
      });
    }
    
    const tipoCajaFilter = filterTipoCajaPedidos.value;
    const fechaDesdeFilter = filterFechaDesdePedidos.value;
    const fechaHastaFilter = filterFechaHastaPedidos.value;
    const searchTerm = searchInputPedidos.value.toLowerCase();
    const sort = sortOrderPedidos.value;
    
    if (tipoCajaFilter) {
      pedidosFiltrados = pedidosFiltrados.filter(pedido => pedido.TipoCaja === tipoCajaFilter);
    }
    
    if (fechaDesdeFilter) {
      pedidosFiltrados = pedidosFiltrados.filter(pedido => pedido.Fecha >= fechaDesdeFilter);
    }
    
    if (fechaHastaFilter) {
      pedidosFiltrados = pedidosFiltrados.filter(pedido => pedido.Fecha <= fechaHastaFilter);
    }
    
    if (searchTerm) {
      pedidosFiltrados = pedidosFiltrados.filter(pedido =>
        pedido.id.toString().includes(searchTerm) ||
        pedido.Empresa.toLowerCase().includes(searchTerm) ||
        pedido.Sucursal.toLowerCase().includes(searchTerm) ||
        pedido.TipoCaja.toLowerCase().includes(searchTerm)
      );
    }
    
    pedidosFiltrados.sort((a, b) => {
      if (sort === 'idAsc') {
        return a.id - b.id;
      } else if (sort === 'idDesc') {
        return b.id - a.id;
      } else if (sort === 'fechaAsc') {
        return new Date(a.Fecha) - new Date(b.Fecha);
      } else if (sort === 'fechaDesc') {
        return new Date(b.Fecha) - new Date(a.Fecha);
      }
      return 0;
    });
    
    const pedidoTableBody = document.querySelector('#pedidoTable tbody');
    pedidoTableBody.innerHTML = '';
    
    let totalPizza = 0;
    let totalFingers = 0;
    let totalPrecio = 0;
    
    pedidosFiltrados.forEach(pedido => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${pedido.id}</td>
        <td>${pedido.Empresa}</td>
        <td>${capitalizeFirstLetter(pedido.Sucursal)}</td>
        <td>${pedido.TipoCaja}</td>
        <td>${pedido.Fecha}</td>
        <td>${pedido.Cantidad}</td>
        <td>Q${pedido.PrecioUnitario.toFixed(8)}</td>
        <td>Q${pedido.PrecioTotal.toFixed(8)}</td>
        <td>
          <button class="action-btn edit-btn" onclick="editarPedido(${pedido.id})">Editar</button>
          <button class="action-btn delete-btn" onclick="eliminarPedido(${pedido.id})">Eliminar</button>
        </td>
      `;
      pedidoTableBody.appendChild(tr);
      
      if (pedido.TipoCaja.toLowerCase() === 'pizza') {
        totalPizza += pedido.Cantidad;
      } else if (pedido.TipoCaja.toLowerCase() === 'fingers') {
        totalFingers += pedido.Cantidad;
      }
      totalPrecio += pedido.PrecioTotal;
    });
    
    totalPizzaPedidosEl.textContent = totalPizza;
    totalFingersPedidosEl.textContent = totalFingers;
    totalPrecioPedidosEl.textContent = `Q${Math.round(totalPrecio)}`;
  }
  
  // Mostrar los pagos en la tabla y actualizar el resumen
  function mostrarPagos() {
    let pagosFiltrados = [...pagos];
    
    if (selectedSucursal !== '') {
      pagosFiltrados = pagosFiltrados.filter(pago => pago.Sucursal.toLowerCase() === selectedSucursal.toLowerCase());
    }
    
    const filtroMesPago = document.getElementById('filterMesPago').value;
    if (filtroMesPago) {
      pagosFiltrados = pagosFiltrados.filter(pago => pago.mes === filtroMesPago);
    } else if (selectedMes) {
      pagosFiltrados = pagosFiltrados.filter(pago => pago.mes === selectedMes);
    }
    
    const fechaDesdeFilter = filterFechaDesdePagos.value;
    const fechaHastaFilter = filterFechaHastaPagos.value;
    const searchTerm = searchInputPagos.value.toLowerCase();
    const sort = sortOrderPagos.value;
    
    if (fechaDesdeFilter) {
      pagosFiltrados = pagosFiltrados.filter(pago => pago.fechaPago >= fechaDesdeFilter);
    }
    
    if (fechaHastaFilter) {
      pagosFiltrados = pagosFiltrados.filter(pago => pago.fechaPago <= fechaHastaFilter);
    }
    
    if (searchTerm) {
      pagosFiltrados = pagosFiltrados.filter(pago =>
        pago.id.toString().includes(searchTerm) ||
        pago.boletaPago.toLowerCase().includes(searchTerm)
      );
    }
    
    pagosFiltrados.sort((a, b) => {
      if (sort === 'idAsc') {
        return a.id - b.id;
      } else if (sort === 'idDesc') {
        return b.id - a.id;
      } else if (sort === 'fechaAsc') {
        return new Date(a.fechaPago) - new Date(b.fechaPago);
      } else if (sort === 'fechaDesc') {
        return new Date(b.fechaPago) - new Date(a.fechaPago);
      }
      return 0;
    });
    
    const pagoTableBody = document.querySelector('#pagoTable tbody');
    pagoTableBody.innerHTML = '';
    
    let totalPagado = 0;
    
    pagosFiltrados.forEach(pago => {
      totalPagado += pago.precioTotalPagado;
    });
    
    let totalPrecioCajas = 0;
    if (selectedMes !== '') {
      const [year, month] = selectedMes.split('-').map(num => parseInt(num));
      totalPrecioCajas = pedidos
        .filter(pedido => 
          pedido.Sucursal.toLowerCase() === selectedSucursal.toLowerCase() &&
          new Date(pedido.Fecha).getFullYear() === year &&
          (new Date(pedido.Fecha).getMonth() + 1) === month
        )
        .reduce((sum, pedido) => sum + pedido.PrecioTotal, 0);
    }
    
    const saldo = totalPagado - totalPrecioCajas;
    
    pagosFiltrados.forEach(pago => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${pago.id}</td>
        <td>${pago.mes}</td>
        <td>${pago.fechaPago}</td>
        <td>${pago.boletaPago}</td>
        <td>Q${Math.round(pago.precioTotalPagado)}</td>
        <td>
          <button class="action-btn edit-btn" onclick="editarPago(${pago.id})">Editar</button>
          <button class="action-btn delete-btn" onclick="eliminarPago(${pago.id})">Eliminar</button>
        </td>
      `;
      pagoTableBody.appendChild(tr);
    });
    
    const totalPendiente = totalPrecioCajas - totalPagado > 0 ? totalPrecioCajas - totalPagado : 0;
    
    totalPagadoEl.textContent = `Q${Math.round(totalPagado)}`;
    totalPendienteEl.textContent = `Q${Math.round(totalPendiente)}`;
    saldoEl.textContent = saldo > 0 ? `Q${Math.round(saldo)}` : `Q${Math.round(Math.abs(saldo))}`;
    
    if (saldo > 0) {
      saldoEl.style.color = 'green';
    } else if (saldo < 0) {
      saldoEl.style.color = 'red';
    } else {
      saldoEl.style.color = '#004d40';
    }
    
    if (totalPendiente > 0) {
      totalPendienteEl.style.color = 'red';
    } else {
      totalPendienteEl.style.color = 'green';
    }
  }
  
  // Función para filtrar por Sucursal de manera global
  function filtrarPorSucursal(sucursal, buttonSeleccionado) {
    selectedSucursal = sucursal.toLowerCase();
    actualizarBotonesSucursal(buttonSeleccionado);
    selectSucursalMessage.style.display = "none";
    appContent.style.display = "flex";
    mostrarPedidos(selectedSucursal);
    mostrarPagos();
  }
  
  // Función para actualizar la apariencia de los botones de sucursal
  function actualizarBotonesSucursal(buttonSeleccionado) {
    const botones = document.querySelectorAll('.sucursal-btn');
    botones.forEach(btn => {
      btn.classList.remove('active');
    });
    buttonSeleccionado.classList.add('active');
  }
  
  // Resetear los filtros de Pedidos
  resetFiltersPedidos.addEventListener('click', function() {
    searchInputPedidos.value = '';
    filterTipoCajaPedidos.value = '';
    filterFechaDesdePedidos.value = '';
    filterFechaHastaPedidos.value = '';
    sortOrderPedidos.value = 'idAsc';
    mostrarPedidos(selectedSucursal);
  });
  
  // Resetear los filtros de Pagos
  resetFiltersPagos.addEventListener('click', function() {
    searchInputPagos.value = '';
    filterFechaDesdePagos.value = '';
    filterFechaHastaPagos.value = '';
    sortOrderPagos.value = 'idAsc';
    mostrarPagos();
  });
  
  // Función para editar un Pedido
  function editarPedido(id) {
    const pedido = pedidos.find(p => p.id === id);
    if (pedido) {
      modalTitlePedido.textContent = "Editar Pedido";
      empresaSelectPedido.value = pedido.Empresa;
      const event = new Event('change');
      empresaSelectPedido.dispatchEvent(event);
      tipoCajaSelectPedido.value = pedido.TipoCaja;
      sucursalSelectPedido.value = pedido.Sucursal;
      fechaPedidoInput.value = pedido.Fecha;
      cantidadInputPedido.value = pedido.Cantidad;
      precioUnitarioInputPedido.value = pedido.PrecioUnitario;
      precioTotalInputPedido.value = pedido.PrecioTotal.toFixed(8);
      pedidoForm.dataset.pedidoId = pedido.id;
      pedidoModal.style.display = "block";
    }
  }
  
  // Función para eliminar un Pedido
  function eliminarPedido(id) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "Esto eliminará el Pedido. ¡No podrás revertir esto!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar!'
    }).then((result) => {
      if (result.isConfirmed) {
        pedidos = pedidos.filter(p => p.id !== id);
        localStorage.setItem('pedidos', JSON.stringify(pedidos));
        mostrarPedidos(selectedSucursal);
        mostrarPagos();
        Swal.fire(
          'Eliminado!',
          'Tu pedido ha sido eliminado.',
          'success'
        );
      }
    });
  }
  
  // Función para capitalizar la primera letra
  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
  
  // Función para editar un Pago
  function editarPago(id) {
    const pago = pagos.find(p => p.id === id);
    if (pago) {
      modalTitlePago.textContent = "Editar Pago";
      fechaPagoInput.value = pago.fechaPago;
      boletaPagoInput.value = pago.boletaPago;
      precioTotalPagadoInputPago.value = pago.precioTotalPagado.toFixed(8);
      pagoForm.dataset.pagoId = pago.id;
      pagoModal.style.display = "block";
    }
  }
  
  // Función para eliminar un Pago
  function eliminarPago(id) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "No podrás revertir esto!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar!'
    }).then((result) => {
      if (result.isConfirmed) {
        pagos = pagos.filter(p => p.id !== id);
        localStorage.setItem('pagos', JSON.stringify(pagos));
        mostrarPagos();
        mostrarPedidos(selectedSucursal);
        Swal.fire(
          'Eliminado!',
          'Tu pago ha sido eliminado.',
          'success'
        );
      }
    });
  }
  
  // Función para filtrar por Mes Inicial
  const filterMesInicial = document.getElementById('filterMesInicial');
  filterMesInicial.addEventListener('change', function() {
    const mesSeleccionado = filterMesInicial.value;
    if (mesSeleccionado) {
      selectedMes = mesSeleccionado;
      if (selectedSucursal !== '') {
        mostrarPedidos(selectedSucursal);
        mostrarPagos();
      }
    }
  });
  
  // Función para realizar el cierre de mes
  function realizarCierreMes() {
    if (!selectedSucursal || selectedSucursal === '') {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, selecciona una Sucursal antes de realizar el Cierre de Mes.'
      });
      return;
    }
    const filterMesInput = document.getElementById('filterMesInicial');
    const mesSeleccionado = filterMesInput.value;
    if (!mesSeleccionado) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, selecciona un Mes para realizar el Cierre de Mes.'
      });
      return;
    }
    window.open(`cierre_mes.html?sucursal=${selectedSucursal}&mes=${mesSeleccionado}`, '_blank');
  }
  
  // Inicializar las tablas al cargar la página
  window.onload = function() {
    mostrarPedidos(selectedSucursal);
    mostrarPagos();
  };
  