import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { storage, auth, db } from '../../services/firebase'; // Ensure this points to frontend firebase.js
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import './FacturasProveedores.css';

// Proveedores se cargan dinámicamente desde Firestore

const CATEGORIAS_DEFAULT = [
  "",
  "Insumos y Alimentos",
  "Bebidas"
];

export default function FacturasProveedores() {
  const [facturas, setFacturas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Auth y sucursales
  const [isAdmin, setIsAdmin] = useState(false);
  const [userSucursalId, setUserSucursalId] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [proveedoresList, setProveedoresList] = useState([]); // Lista dinámica de proveedores
  const [authLoaded, setAuthLoaded] = useState(false);

  // Filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterSucursal, setFilterSucursal] = useState(''); // 'all' o ID

  // Form state
  const [formData, setFormData] = useState({
    proveedor: '', numeroFactura: '', fecha: '', monto: '',
    sucursal: '', categoria: '', descripcion: '', observaciones: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  const getAuthToken = () => localStorage.getItem('token') || '';

  const fetchFacturas = async (sucursalIdParams) => {
    try {
      let url = '/api/facturas-proveedores';
      const params = new URLSearchParams();
      if (sucursalIdParams && sucursalIdParams !== 'all') {
        params.append('sucursal', sucursalIdParams);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      const data = await res.json();
      if (data.ok) {
        setFacturas(data.facturas);
      }
    } catch (error) {
      console.error('Error fetching facturas:', error);
    }
  };

  useEffect(() => {
    // 1) Cargar lista de sucursales y proveedores
    const loadData = async () => {
      try {
        const snap = await getDocs(collection(db, 'sucursales'));
        const list = snap.docs.map(d => ({ id: d.id, nombre: d.data().name || d.data().nombre || d.data().ubicacion || d.id }));
        setSucursales(list.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      } catch (err) {
        console.error("Error cargando sucursales:", err);
      }

      try {
        const pSnap = await getDocs(collection(db, 'proveedores'));
        const pList = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setProveedoresList(pList.sort((a,b) => a.nombre.localeCompare(b.nombre)));
      } catch (err) {
        console.error("Error cargando proveedores:", err);
      }
    };
    loadData();

    // 2) Cargar rol y sucursal del usuario
    const getSesion = () => {
      const r = localStorage.getItem('role') || 'viewer';
      const email = localStorage.getItem('email') || '';
      const pStr = localStorage.getItem('permisosFinanzas') || '{}';
      let perms = {};
      try { perms = JSON.parse(pStr); } catch {}
      
      return {
        role: (r.toLowerCase() === 'administrador') ? 'admin' : r.toLowerCase(),
        sucursalId: localStorage.getItem('sucursalId') || '',
        permisos: perms,
        email
      };
    };

    const s = getSesion();
    const adminFlag = s.role === 'admin' || s.permisos?.canManageFacturas === true;
    setIsAdmin(adminFlag);
    setUserSucursalId(s.sucursalId);
    
    if (!adminFlag) {
      setFormData(prev => ({ ...prev, sucursal: s.sucursalId }));
    }

    const initialFilter = adminFlag ? 'all' : s.sucursalId;
    setFilterSucursal(initialFilter);
    fetchFacturas(initialFilter);
    setAuthLoaded(true);

    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update fetch when filterSucursal changes manually
  useEffect(() => {
    if (authLoaded) {
      fetchFacturas(filterSucursal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSucursal]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setUploadProgress(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');
    if (!formData.proveedor.trim()) return setErrorMsg('El proveedor es requerido');
    if (!imageFile) return setErrorMsg('La imagen de la factura es requerida');

    setLoading(true);
    try {
      const uid = localStorage.getItem('token') ? JSON.parse(atob(localStorage.getItem('token').split('.')[1])).user_id : 'unknown';
      const timestamp = Date.now();
      const storageRef = ref(storage, `facturas-proveedores/${uid}/${timestamp}_${imageFile.name}`);
      const uploadTask = uploadBytesResumable(storageRef, imageFile);

      uploadTask.on('state_changed',
        (snapshot) => { setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); },
        (error) => { setErrorMsg('Error al subir la imagen'); setLoading(false); },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const res = await fetch('/api/facturas-proveedores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
            body: JSON.stringify({
              ...formData, imageUrl: downloadURL, imagePath: uploadTask.snapshot.ref.fullPath,
              imageName: imageFile.name, imageContentType: imageFile.type
            })
          });
          const data = await res.json();
          if (data.ok) {
            setSuccessMsg('Factura registrada con éxito');
            setShowForm(false);
            setFormData({ proveedor: '', numeroFactura: '', fecha: '', monto: '', sucursal: isAdmin ? '' : userSucursalId, categoria: '', descripcion: '', observaciones: '' });
            setImageFile(null); setImagePreview(''); setUploadProgress(0);
            fetchFacturas(filterSucursal);
          } else {
            setErrorMsg(data.message || 'Error al guardar factura');
          }
          setLoading(false);
        }
      );
    } catch (error) {
      setErrorMsg('Error general al procesar la solicitud'); setLoading(false);
    }
  };

  const filteredFacturas = facturas.filter(f => {
    if (!startDate && !endDate) return true;
    const fDate = new Date(f.fecha);
    fDate.setHours(0, 0, 0, 0);
    let startMatch = true;
    let endMatch = true;

    if (startDate) {
      const sDate = new Date(`${startDate}T00:00:00`);
      startMatch = fDate >= sDate;
    }
    if (endDate) {
      const eDate = new Date(`${endDate}T23:59:59`);
      endMatch = fDate <= eDate;
    }
    return startMatch && endMatch;
  });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Reporte de Facturas de Proveedores', 14, 15);

    let subTitle = '';
    if (startDate || endDate) {
      subTitle = `Periodo: ${startDate || 'Inicio'} al ${endDate || 'Final'}`;
    } else {
      subTitle = 'Todas las facturas históricas';
    }
    doc.setFontSize(10);
    doc.text(subTitle, 14, 23);

    const tableColumn = ["Fecha", "Proveedor", "Factura N°", "Monto", "Sucursal", "Categoria"];
    const tableRows = [];

    let totalMonto = 0;

    filteredFacturas.forEach(fac => {
      const facData = [
        fac.fecha ? new Date(fac.fecha).toLocaleDateString() : '-',
        fac.proveedor || '-',
        fac.numeroFactura || '-',
        `$${(fac.monto || 0).toFixed(2)}`,
        fac.sucursal || '-',
        fac.categoria || '-'
      ];
      totalMonto += parseFloat(fac.monto || 0);
      tableRows.push(facData);
    });

    // Añadir fila de totales
    tableRows.push(["", "", "TOTAL", `$${totalMonto.toFixed(2)}`, "", ""]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 184, 102] } // Var(--primary) aprox
    });

    doc.save(`Reporte_Facturas_${Date.now()}.pdf`);
  };

  return (
    <div className="facturas-container">
      <div className="facturas-header">
        <h2>Facturas de Proveedores</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={exportPDF}>
            <i className='bx bx-export'></i> Exportar PDF
          </button>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <i className={`bx ${showForm ? 'bx-x' : 'bx-plus'}`}></i>
            {showForm ? 'Cancelar' : 'Registrar'}
          </button>
        </div>
      </div>

      {!showForm && (
        <div className="filters-container">
          {isAdmin && (
            <div className="filter-group">
              <label>Sucursal:</label>
              <select value={filterSucursal} onChange={e => setFilterSucursal(e.target.value)} className="filter-input">
                <option value="all">Todas las sucursales</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div className="filter-group">
            <label>Desde:</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="filter-input" />
          </div>
          <div className="filter-group">
            <label>Hasta:</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="filter-input" />
          </div>
          {(startDate || endDate || (isAdmin && filterSucursal !== 'all')) && (
            <button className="btn-clear-filters" onClick={() => { setStartDate(''); setEndDate(''); if (isAdmin) setFilterSucursal('all'); }}>
              Limpiar
            </button>
          )}
        </div>
      )}

      {successMsg && (
        <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          {errorMsg}
        </div>
      )}

      {showForm && (
        <div className="facturas-form-card">
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Proveedor *</label>
                <select name="proveedor" value={formData.proveedor} onChange={handleInputChange} required>
                  <option value="" disabled>Selecciona un proveedor...</option>
                  {proveedoresList.map((prov) => (
                    <option key={prov.id} value={prov.nombre}>{prov.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Número de Factura</label>
                <input type="text" name="numeroFactura" value={formData.numeroFactura} onChange={handleInputChange} placeholder="EJ-12345" />
              </div>

              <div className="form-group">
                <label>Fecha</label>
                <input type="date" name="fecha" value={formData.fecha} onChange={handleInputChange} />
              </div>

              <div className="form-group">
                <label>Monto</label>
                <input type="number" step="0.01" name="monto" value={formData.monto} onChange={handleInputChange} placeholder="0.00" />
              </div>

              <div className="form-group">
                <label>Sucursal *</label>
                <select
                  name="sucursal"
                  value={formData.sucursal}
                  onChange={handleInputChange}
                  required
                  disabled={!isAdmin && !!userSucursalId}
                >
                  <option value="" disabled>Selecciona una sucursal...</option>
                  {sucursales.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Categoría</label>
                <select name="categoria" value={formData.categoria} onChange={handleInputChange}>
                  {CATEGORIAS_DEFAULT.map((cat, index) => (
                    <option key={index} value={cat} disabled={cat === ""}>{cat === "" ? "Selecciona una categoría..." : cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width file-upload-container">
                <label>Imagen de la Factura *</label>
                <div className="file-input-wrapper">
                  <div className="file-input-btn">
                    <i className='bx bx-cloud-upload'></i>
                    {imageFile ? imageFile.name : 'Seleccionar Archivo'}
                  </div>
                  <input type="file" accept="image/*,application/pdf" onChange={handleImageChange} required />
                </div>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '4px', height: '6px', marginTop: '8px' }}>
                    <div style={{ width: `${uploadProgress}%`, backgroundColor: 'var(--primary-color)', height: '100%', borderRadius: '4px' }}></div>
                  </div>
                )}
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="image-preview" />
                )}
              </div>

              <div className="form-group full-width">
                <label>Descripción</label>
                <textarea name="descripcion" value={formData.descripcion} onChange={handleInputChange} rows="2" placeholder="Detalle de los productos..."></textarea>
              </div>

              <div className="form-group full-width">
                <label>Observaciones</label>
                <textarea name="observaciones" value={formData.observaciones} onChange={handleInputChange} rows="2"></textarea>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} disabled={loading}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar Factura'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de Listado */}
      {!showForm && (
        <div className="facturas-table-container">
          <table className="facturas-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>N° Factura</th>
                <th>Monto</th>
                <th>Sucursal</th>
                <th>Archivo</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacturas.length > 0 ? (
                filteredFacturas.map(fac => (
                  <tr key={fac.id}>
                    <td>{new Date(fac.fecha).toLocaleDateString()}</td>
                    <td>{fac.proveedor}</td>
                    <td>{fac.numeroFactura || '-'}</td>
                    <td>${fac.monto?.toFixed(2)}</td>
                    <td><span className="tag">{fac.sucursal || 'N/A'}</span></td>
                    <td>
                      {fac.imageUrl ? (
                        <a href={fac.imageUrl} target="_blank" rel="noreferrer" className="btn-view-receipt">
                          <i className='bx bx-file-find'></i> Ver Comprobante
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <i className='bx bx-receipt'></i>
                      <p>No hay facturas registradas.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
