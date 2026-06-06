document.addEventListener('DOMContentLoaded', () => {
    
    // =========================================
    // 1. INICIALIZAR CALENDARIO (FLATPICKR)
    // =========================================
    const calendario = flatpickr("#rango-fechas", {
        mode: "range",            
        minDate: "today",         
        showMonths: 2,            
        locale: "es",             
        dateFormat: "D, j M",      
        rangeSeparator: " → ",     
        onChange: function(selectedDates, dateStr, instance) {
            // Calcula las noches
            if (selectedDates.length === 2) {
                const diffTime = Math.abs(selectedDates[1] - selectedDates[0]);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                document.getElementById('noches-texto').textContent = `Noches: ${diffDays}`;
            } else {
                document.getElementById('noches-texto').textContent = `Noches: 0`;
            }
        }
    });

    // =========================================
    // 2. LÓGICA DEL MENÚ DE HUÉSPEDES
    // =========================================
    const toggleBtn = document.getElementById('btn-toggle-huespedes');
    const dropdown = document.getElementById('dropdown-huespedes');
    
    if (toggleBtn && dropdown) {
        toggleBtn.addEventListener('click', () => {
            dropdown.classList.toggle('activo');
        });
    }

    // Variables de control de huéspedes
    let adultos = 1;
    let ninos = 0;
    const MAX_CAPACIDAD = 4; // Límite estricto del hotel

    const contadorAdultos = document.getElementById('contador-adultos');
    const contadorNinos = document.getElementById('contador-ninos');
    const btnSumarAdultos = document.getElementById('btn-sumar-adultos');
    const btnRestarAdultos = document.getElementById('btn-restar-adultos');
    const btnSumarNinos = document.getElementById('btn-sumar-ninos');
    const btnRestarNinos = document.getElementById('btn-restar-ninos');
    const textoResumen = document.getElementById('huespedes-resumen');

    function actualizarHuespedes() {
        if (contadorAdultos) contadorAdultos.textContent = adultos;
        if (contadorNinos) contadorNinos.textContent = ninos;
        
        let textoA = adultos === 1 ? 'Adulto' : 'Adultos';
        let textoN = ninos === 1 ? 'Niño' : 'Niños';
        if (textoResumen) textoResumen.textContent = `${adultos} ${textoA}, ${ninos} ${textoN}`;

        if (btnRestarAdultos) btnRestarAdultos.disabled = (adultos <= 1);
        if (btnRestarNinos) btnRestarNinos.disabled = (ninos <= 0);

        let totalHuespedes = adultos + ninos;
        
        if (totalHuespedes >= MAX_CAPACIDAD) {
            if (btnSumarAdultos) btnSumarAdultos.disabled = true;
            if (btnSumarNinos) btnSumarNinos.disabled = true;
        } else {
            if (btnSumarAdultos) btnSumarAdultos.disabled = false;
            if (btnSumarNinos) btnSumarNinos.disabled = false;
        }
    }

    if (btnSumarAdultos) btnSumarAdultos.addEventListener('click', () => { if(adultos + ninos < MAX_CAPACIDAD) { adultos++; actualizarHuespedes(); }});
    if (btnRestarAdultos) btnRestarAdultos.addEventListener('click', () => { if(adultos > 1) { adultos--; actualizarHuespedes(); }});
    if (btnSumarNinos) btnSumarNinos.addEventListener('click', () => { if(adultos + ninos < MAX_CAPACIDAD) { ninos++; actualizarHuespedes(); }});
    if (btnRestarNinos) btnRestarNinos.addEventListener('click', () => { if(ninos > 0) { ninos--; actualizarHuespedes(); }});

    // =========================================
    // 3. LÓGICA DE BÚSQUEDA EN LA BASE DE DATOS
    // =========================================
    const btnBuscar = document.querySelector('.btn-buscar-disponibilidad');

    if (btnBuscar) {
        btnBuscar.addEventListener('click', () => {
            const fechasSeleccionadas = calendario.selectedDates;
            
            if (fechasSeleccionadas.length !== 2) {
                alert("Por favor, selecciona tus fechas de Check-in y Check-out.");
                return;
            }

            const fechaCheckIn = flatpickr.formatDate(fechasSeleccionadas[0], "Y-m-d");
            const fechaCheckOut = flatpickr.formatDate(fechasSeleccionadas[1], "Y-m-d");
            const sumaHuespedes = adultos + ninos;

            console.log("Consultando BD...");
            
            fetch('/api/disponibilidad', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checkIn: fechaCheckIn,     
                    checkOut: fechaCheckOut,   
                    huespedes: sumaHuespedes   
                })
            })
            .then(respuesta => respuesta.json())
            .then(datos => {
                console.log("Respuesta del servidor:", datos);
                if (datos.success) {
                    // Pasamos las habitaciones y los datos de la búsqueda
                    renderizarHabitaciones(datos.habitaciones, fechaCheckIn, fechaCheckOut, sumaHuespedes);

                    const seccionResultados = document.getElementById('seccion-resultados');
                    if (seccionResultados) {
                        seccionResultados.style.display = 'flex'; 
                        seccionResultados.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                } else {
                    alert("No se encontraron habitaciones o hubo un problema: " + datos.message);
                }
            })
            .catch(error => {
                console.error("Hubo un error al consultar la base de datos:", error);
                alert("Ocurrió un error al conectar con el servidor.");
            });
        });
    }

    // =========================================
    // 4. FUNCIÓN PARA DIBUJAR LAS HABITACIONES Y RESERVAR
    // =========================================
    function renderizarHabitaciones(habitaciones, checkInActual, checkOutActual, huespedesActual) {
        const contenedor = document.getElementById('seccion-resultados');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (habitaciones.length === 0) {
            contenedor.innerHTML = '<p style="text-align: center; width: 100%; font-size: 18px;">No hay habitaciones disponibles para estas fechas.</p>';
            return;
        }

        habitaciones.forEach(hab => {
            const precioFormateado = new Intl.NumberFormat('es-MX', { 
                style: 'currency', currency: 'MXN' 
            }).format(hab.PrecioNoche);

            const tarjeta = document.createElement('div');
            tarjeta.className = 'habitacion-card'; 
            
            tarjeta.innerHTML = `
                <div class="habitacion-imagen">
                    <img src="${hab.ImagenURL || 'https://res.cloudinary.com/djtu5t9cl/image/upload/v1779929610/pm_3_fd2atk.jpg'}" alt="${hab.Tipo}">
                </div>
                <div class="habitacion-info">
                    <h3 style="margin: 0 0 10px 0; color: #4a3b32;">${hab.Tipo} (Num. ${hab.NumeroHabitacion})</h3>
                    <p style="margin: 5px 0;">👥 Capacidad: Hasta ${hab.Capacidad} huéspedes</p>
                    <p style="margin: 5px 0; font-size: 18px; font-weight: bold; color: #b8860b;">${precioFormateado} MXN / noche</p>
                    <button class="btn-reservar-nav btn-seleccionar" style="margin-top: auto; width: 100%;">Seleccionar Cuarto</button>
                    
                    <div class="formulario-reserva" style="display: none; margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px;">
                        <input type="text" class="input-nombre" placeholder="Tu Nombre Completo" required style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        <input type="email" class="input-email" placeholder="Tu Correo Electrónico" required style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        <button class="btn-reservar-final" style="width: 100%; padding: 10px; background-color: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">Confirmar Reserva</button>
                    </div>
                </div>
            `;

            const btnSeleccionar = tarjeta.querySelector('.btn-seleccionar');
            const formularioOculto = tarjeta.querySelector('.formulario-reserva');
            const btnConfirmar = tarjeta.querySelector('.btn-reservar-final');
            const inputNombre = tarjeta.querySelector('.input-nombre');
            const inputEmail = tarjeta.querySelector('.input-email');

            btnSeleccionar.addEventListener('click', () => {
                btnSeleccionar.style.display = 'none';
                formularioOculto.style.display = 'block';
            });

            btnConfirmar.addEventListener('click', async () => {
                const nombreCliente = inputNombre.value.trim();
                const emailCliente = inputEmail.value.trim();

                if (!nombreCliente || !emailCliente) {
                    alert('⚠️ Por favor, ingresa tu nombre y correo para completar la reserva.');
                    return;
                }

                btnConfirmar.innerText = 'Procesando...';
                btnConfirmar.disabled = true;

                try {
                    const respuesta = await fetch('/api/reservar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            habitacionID: hab.HabitacionID,
                            checkIn: checkInActual,
                            checkOut: checkOutActual,
                            huespedes: huespedesActual,
                            nombre: nombreCliente,
                            email: emailCliente
                        })
                    });

                    const resJson = await respuesta.json();

                    if (resJson.success) {
                        alert(`✅ ¡Felicidades ${nombreCliente}! Tu reserva para la habitación ${hab.NumeroHabitacion} ha sido confirmada.`);
                        window.location.reload(); 
                    } else {
                        alert(`⚠️ Ocurrió un error: ${resJson.message}`);
                        btnConfirmar.innerText = 'Confirmar Reserva';
                        btnConfirmar.disabled = false;
                    }
                } catch (error) {
                    console.error('Error al enviar la reserva:', error);
                    alert('No se pudo contactar con el servidor.');
                    btnConfirmar.innerText = 'Confirmar Reserva';
                    btnConfirmar.disabled = false;
                }
            });

            contenedor.appendChild(tarjeta);
        });
    }

    // =========================================
    // 5. INTEGRACIÓN: API DE OPENWEATHER
    // =========================================
    async function obtenerClima() {
        const apiKey = '6aef863dfbc029936f3dbca610bf41ca'; 
        const ciudad = 'Taxco';
        const pais = 'MX';
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${ciudad},${pais}&appid=${apiKey}&units=metric&lang=es`;

        try {
            const respuesta = await fetch(url);
            const datos = await respuesta.json();

            if (respuesta.ok) {
                const temperatura = Math.round(datos.main.temp);
                const descripcion = datos.weather[0].description;
                const iconoCode = datos.weather[0].icon;
                const urlIcono = `https://openweathermap.org/img/wn/${iconoCode}.png`;
                const descCapitalizada = descripcion.charAt(0).toUpperCase() + descripcion.slice(1);
                
                const elTemp = document.getElementById('weather-temp');
                const elIcon = document.getElementById('weather-icon');
                if (elTemp) elTemp.innerText = `${descCapitalizada}, ${temperatura}°C`;
                if (elIcon) elIcon.innerHTML = `<img src="${urlIcono}" alt="Icono del clima">`;
            } else {
                console.error("Error de la API:", datos.message);
                const elTemp = document.getElementById('weather-temp');
                if (elTemp) elTemp.innerText = "Clima no disponible";
            }
        } catch (error) {
            console.error("Error de conexión:", error);
            const elTemp = document.getElementById('weather-temp');
            if (elTemp) elTemp.innerText = "Error al cargar";
        }
    }
    
    obtenerClima(); // Ejecuta el clima al cargar la página

    // =========================================
    // 6. LÓGICA DEL CARRUSEL PRINCIPAL (HERO)
    // =========================================
    const heroSlides = document.querySelectorAll('.slide-hero');
    const btnHeroPrev = document.querySelector('.btn-flecha.prev');
    const btnHeroNext = document.querySelector('.btn-flecha.next');

    if (heroSlides.length > 0 && btnHeroPrev && btnHeroNext) {
        let heroSlideActual = 0;
        let intervaloHero;

        function mostrarHeroSlide(indice) {
            heroSlides.forEach(slide => slide.classList.remove('activa'));
            if (indice >= heroSlides.length) heroSlideActual = 0;
            if (indice < 0) heroSlideActual = heroSlides.length - 1;
            heroSlides[heroSlideActual].classList.add('activa');
        }

        function heroSiguiente() {
            heroSlideActual++;
            mostrarHeroSlide(heroSlideActual);
            reiniciarHeroTemporizador();
        }

        function heroAnterior() {
            heroSlideActual--;
            mostrarHeroSlide(heroSlideActual);
            reiniciarHeroTemporizador();
        }

        function iniciarHeroTemporizador() {
            intervaloHero = setInterval(heroSiguiente, 5000);
        }

        function reiniciarHeroTemporizador() {
            clearInterval(intervaloHero);
            iniciarHeroTemporizador();
        }

        btnHeroNext.addEventListener('click', heroSiguiente);
        btnHeroPrev.addEventListener('click', heroAnterior);
        iniciarHeroTemporizador();
    }

}); // <-- CIERRA EL ÚNICO DOMCONTENTLOADED MAESTRO DEL ARCHIVO

// =========================================
// LÓGICA DEL BOTÓN "UNIRSE" (Seguridad Simplificada)
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    // Buscamos el enlace "Unirse" en tu menú de navegación
    const btnUnirse = document.querySelector('a[href="#unirse"]');

    if (btnUnirse) {
        btnUnirse.addEventListener('click', async (e) => {
            e.preventDefault(); // Evitamos que la página salte

            // Preguntamos qué quiere hacer el usuario
            const accion = prompt("¿Qué deseas hacer? Escribe '1' para Registrarte o '2' para Iniciar Sesión");

            if (accion === '1') {
                // FLUJO DE REGISTRO
                const nombre = prompt("Ingresa tu Nombre:");
                const email = prompt("Ingresa tu Correo:");
                const password = prompt("Crea una Contraseña secreta:");

                if (nombre && email && password) {
                    const res = await fetch('/api/registro', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nombre, email, password })
                    });
                    const data = await res.json();
                    alert(data.message);
                }

            } else if (accion === '2') {
                // FLUJO DE LOGIN
                const email = prompt("Ingresa tu Correo:");
                const password = prompt("Ingresa tu Contraseña:");

                if (email && password) {
                    const res = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password })
                    });
                    const data = await res.json();
                    
                    if (data.success) {
                        alert(data.message + "\n\nTu Token de seguridad es:\n" + data.token);
                        // En un sistema real, guardaríamos este token así:
                        // sessionStorage.setItem('tokenLuxTaxco', data.token);
                    } else {
                        alert(data.message);
                    }
                }
            }
        });
    }
});