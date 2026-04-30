// app.js
import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";
import { Calendar } from "https://cdn.jsdelivr.net/npm/fullcalendar@5.11.3/main.min.js";

document.addEventListener("DOMContentLoaded", () => {
  // Mostrar / ocultar secciones
  const configBtn = document.getElementById("configBtn");
  const configSection = document.getElementById("configSection");
  const homeScreen = document.getElementById("homeScreen");
  configBtn.addEventListener("click", () => {
    homeScreen.classList.add("d-none");
    configSection.classList.remove("d-none");
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      document
        .querySelectorAll(".nav-link")
        .forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      const target = link.dataset.target;
      document.querySelectorAll(".section").forEach((s) =>
        s.id === target
          ? s.classList.add("active")
          : s.classList.remove("active")
      );
    });
  });

  // 2. Parámetros: guarda en Firestore
  document
    .getElementById("formParametros")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const categoria = document.getElementById("inputCategoria").value.trim();
      const unidad = document.getElementById("inputUnidad").value.trim();
      const tipoInv = document.getElementById("inputTipoInv").value.trim();
      const usuario = document.getElementById("inputUsuario").value.trim();
      await addDoc(collection(db, "parametros"), {
        categoria,
        unidad,
        tipoInventario: tipoInv,
        usuario: usuario || null,
      });
      e.target.reset();
      alert("Parámetros guardados");
    });

  // 3. Sucursales: CRUD básico
  const sucCol = collection(db, "sucursales");
  const listaSuc = document.getElementById("listaSucursales");
  document
    .getElementById("formSucursal")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const nombre = document.getElementById("inputNombreSuc").value.trim();
      await addDoc(sucCol, { nombre });
      e.target.reset();
    });
  // Actualiza lista en tiempo real
  onSnapshot(sucCol, (snap) => {
    listaSuc.innerHTML = "";
    snap.forEach((docu) => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between";
      li.textContent = docu.data().nombre;
      const btn = document.createElement("button");
      btn.className = "btn btn-sm btn-danger";
      btn.textContent = "Eliminar";
      btn.onclick = () => deleteDoc(doc(db, "sucursales", docu.id));
      li.appendChild(btn);
      listaSuc.appendChild(li);
    });
  });

  // 4. Calendario de inventarios
  const calendarEl = document.getElementById("calendar");
  const calendar = new Calendar(calendarEl, {
    initialView: "dayGridMonth",
    dateClick: (info) => {
      const fecha = info.dateStr;
      const sucursal = prompt("Ingrese ID de sucursal para inventario:");
      if (sucursal) {
        addDoc(collection(db, "inventarios"), {
          fecha,
          sucursalId: sucursal,
          creadoEn: new Date(),
        }).then(() => alert("Inventario agendado"));
      }
    },
    events: async (fetchInfo, successCallback) => {
      const invSnap = await getDocs(collection(db, "inventarios"));
      const events = invSnap.docs.map((d) => ({
        title: `Inv. Sucursal ${d.data().sucursalId}`,
        start: d.data().fecha,
      }));
      successCallback(events);
    },
  });
  calendar.render();
});
