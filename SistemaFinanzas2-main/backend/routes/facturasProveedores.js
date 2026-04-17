// backend/routes/facturasProveedores.js
const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebaseAdmin');

// Middleware para verificar token de Firebase (Copiado de la lógica existente)
function getBearerToken(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

async function verifyFirebaseToken(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, message: 'Falta Authorization Bearer' });
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUser = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: 'Token inválido' });
  }
}

// 1) Crear factura
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid, email } = req.firebaseUser;
    
    // Extraer campos
    const {
      proveedor,
      numeroFactura,
      fecha,
      monto,
      sucursal,
      categoria,
      descripcion,
      observaciones,
      imageUrl,
      imagePath,
      imageName,
      imageContentType
    } = req.body;

    // Validación básica
    if (!proveedor) {
      return res.status(400).json({ ok: false, message: 'El campo "proveedor" es obligatorio.' });
    }
    if (!imageUrl) {
      return res.status(400).json({ ok: false, message: 'La "imageUrl" es obligatoria.' });
    }

    const facturaRef = db.collection('facturasProveedores').doc();
    const nuevaFactura = {
      id: facturaRef.id,
      proveedor,
      numeroFactura: numeroFactura || '',
      fecha: fecha || new Date().toISOString(),
      monto: Number(monto) || 0,
      sucursal: sucursal || '',
      categoria: categoria || '',
      descripcion: descripcion || '',
      observaciones: observaciones || '',
      imageUrl,
      imagePath: imagePath || '',
      imageName: imageName || '',
      imageContentType: imageContentType || '',
      createdByUid: uid,
      createdByEmail: email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await facturaRef.set(nuevaFactura);

    res.status(201).json({
      ok: true,
      message: 'Factura registrada con éxito',
      factura: nuevaFactura
    });
  } catch (error) {
    console.error('Error al crear factura:', error);
    res.status(500).json({ ok: false, message: 'Error interno al registrar factura' });
  }
});

// 2) Listar facturas
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    // Aquí puedes agregar validación de sucursal si el usuario es "viewer"
    // Consultar firestore (opcionalmente pasamos la sucursal por querystring: ?sucursal=XYZ )
    const { sucursal } = req.query;

    let query = db.collection('facturasProveedores').orderBy('createdAt', 'desc');

    if (sucursal) {
      query = query.where('sucursal', '==', sucursal);
    }

    const snapshot = await query.get();
    const facturas = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      // Parse timestamp to date string
      const createdAtDate = data.createdAt ? data.createdAt.toDate() : new Date();
      facturas.push({
        ...data,
        createdAt: createdAtDate.toISOString(),
      });
    });

    res.json({ ok: true, facturas });
  } catch (error) {
    console.error('Error al listar facturas:', error);
    res.status(500).json({ ok: false, message: 'Error interno al listar facturas' });
  }
});

// 3) Obtener factura por ID
router.get('/:id', verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('facturasProveedores').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ ok: false, message: 'Factura no encontrada' });
    }

    res.json({ ok: true, factura: doc.data() });
  } catch (error) {
    console.error('Error al obtener factura:', error);
    res.status(500).json({ ok: false, message: 'Error interno al buscar factura' });
  }
});

module.exports = router;
