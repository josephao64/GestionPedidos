// createUser.js

import { db } from './createUser.html'; // Asegúrate de que la ruta es correcta
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
    const createUserForm = document.getElementById('createUserForm');

    createUserForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        let password = document.getElementById('password').value.trim();
        const role = document.getElementById('role').value;
        const permisosCheckboxes = document.querySelectorAll('#permisosCheckboxes input[type="checkbox"]');
        const permisos = [];

        permisosCheckboxes.forEach(cb => {
            if (cb.checked) permisos.push(cb.value);
        });

        // Validaciones
        if (!username || !role) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Por favor, completa los campos requeridos (Nombre de Usuario y Rol).',
            });
            return;
        }

        // Si la contraseña está vacía, establecerla como "1"
        if (!password) {
            password = "1";
        }

        // Crear objeto de usuario
        const nuevoUsuario = {
            username: username,
            password: password,
            role: role,
            permisos: permisos
        };

        try {
            // Agregar el nuevo usuario a Firestore
            await addDoc(collection(db, "usuarios"), nuevoUsuario);

            Swal.fire({
                icon: 'success',
                title: 'Usuario Creado',
                text: `El usuario "${username}" ha sido creado exitosamente.`,
                timer: 1500,
                showConfirmButton: false
            });

            // Reiniciar el formulario
            createUserForm.reset();
        } catch (error) {
            console.error("Error al crear el usuario: ", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Ocurrió un error al crear el usuario. Inténtalo de nuevo.',
            });
        }
    });
});
