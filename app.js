document.addEventListener('DOMContentLoaded', () => {
    
    const bookingForm = document.getElementById('bookingForm');

    if (bookingForm) {
        bookingForm.addEventListener('submit', function(event) {
            
            // Previene la recarga automática de la página
            event.preventDefault();
            
            // Captura de datos ingresados
            const checkin = document.getElementById('checkin').value;
            const checkout = document.getElementById('checkout').value;
            const huespedes = document.getElementById('huespedes').value;

            // Validación de lógica de negocio (Fechas)
            if (checkin >= checkout) {
                alert('⚠️ Error de fechas:\nLa fecha de Check-out debe ser posterior a la fecha de Check-in.');
                return; // Detiene la ejecución si hay error
            }

            // Simulación de éxito
            alert(`✅ ¡Búsqueda validada!\n\nSimulando conexión a la base de datos...\n\nDetalles:\n- Entrada: ${checkin}\n- Salida: ${checkout}\n- Paquete de huéspedes: ${huespedes}`);
        });
    }
});