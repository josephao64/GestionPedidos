// src/App.js
import React from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';

import PrivateRoute from './auth/PrivateRoute.js'; // tu guard mejorado por token/exp/roles
import DashboardLayout from './components/nav-bar/DashboardLayout.js';

import Finanzas from './components/finanzas/Finanzas.js';
import RegistrarCierre from './components/registrar-cierre/RegistrarCierre.js';
import HistorialCuadres from './components/historial/HistorialCuadres.js';

import Sucursales from './components/sucursales/Sucursales.js';
import Usuarios from './components/usuarios/Usuarios.js';

import RegistrarPagos from './components/registrar-pagos/RegistrarPagos.jsx';
import HistorialPagos from './components/historial/HistorialPagos.jsx';

import FacturasProveedores from './components/facturas-proveedores/FacturasProveedores.jsx';
import Proveedores from './components/proveedores/Proveedores.jsx';
import Servicios from './components/servicios/Servicios.jsx';

// Login import eliminado

function AuthBridge() {
  const [params] = useSearchParams();
  const role = params.get('role');
  const email = params.get('email');
  const permisos = params.get('permisos');

  if (role) localStorage.setItem('role', role);
  if (email) localStorage.setItem('email', email);
  if (permisos) localStorage.setItem('permisosFinanzas', permisos);

  return <Navigate to="/Finanzas" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Rutas públicas directas a dashboard */}
      <Route path="/bridge" element={<AuthBridge />} />
      <Route path="/" element={<Navigate to="/Finanzas" replace />} />
      <Route path="/login" element={<Navigate to="/Finanzas" replace />} />

      {/* Rutas protegidas: Dashboard y anidadas */}
      <Route
        path="/Finanzas"
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        {/* Cualquiera autenticado */}
        <Route index element={<Finanzas />} />
        <Route path="RegistrarCierre" element={<RegistrarCierre />} />
        <Route path="HistorialCuadres" element={<HistorialCuadres />} />
        <Route path="FacturasProveedores" element={<FacturasProveedores />} />

        {/* Oculto mediante requerimiento de roles o permisos individuales */}
        <Route
          path="HistorialPagos"
          element={
            <PrivateRoute requiredRoles="admin" requiredPerm="canViewHistorialPagos" redirectIfDenied="/Finanzas">
              <HistorialPagos />
            </PrivateRoute>
          }
        />
        <Route
          path="RegistrarPagos"
          element={
            <PrivateRoute requiredRoles="admin" requiredPerm="canRegistrarPagos" redirectIfDenied="/Finanzas">
              <RegistrarPagos />
            </PrivateRoute>
          }
        />
        <Route
          path="Sucursales"
          element={
            <PrivateRoute requiredRoles="admin" requiredPerm="canManageSucursales" redirectIfDenied="/Finanzas">
              <Sucursales />
            </PrivateRoute>
          }
        />
        <Route
          path="Proveedores"
          element={
            <PrivateRoute requiredRoles="admin" requiredPerm="canManageProveedores" redirectIfDenied="/Finanzas">
              <Proveedores />
            </PrivateRoute>
          }
        />
        <Route
          path="Servicios"
          element={
            <PrivateRoute requiredRoles="admin" requiredPerm="canManageServicios" redirectIfDenied="/Finanzas">
              <Servicios />
            </PrivateRoute>
          }
        />
        <Route
          path="Usuarios"
          element={
            <PrivateRoute requiredRoles="admin" requiredPerm="canManageUsuarios" redirectIfDenied="/Finanzas">
              <Usuarios />
            </PrivateRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
