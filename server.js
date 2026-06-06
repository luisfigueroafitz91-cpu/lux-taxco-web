// =========================================
// 1. IMPORTACIONES Y CONFIGURACIÓN
// =========================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const sql = require('mssql');

const app = express();
const PORT = 3525;
// Importaciones de Seguridad
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// (Opcional pero recomendado) Tu secreto para firmar los tokens
const JWT_SECRET = process.env.JWT_SECRET || 'LuxTaxcoSecretoSuperSeguro2026';

// Configuración para recibir datos (Body Parser)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================================
// 2. CONEXIÓN A SQL SERVER
// =========================================
const dbSettings = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false, 
        trustServerCertificate: true 
    }
};

async function conectarBD() {
    try {
        await sql.connect(dbSettings);
        console.log('✅ Conexión exitosa a la base de datos de Lux Taxco.');
    } catch (error) {
        console.error('❌ Error conectando a la base de datos:', error);
    }
}
conectarBD();

// =========================================
// 3. RUTAS Y ENDPOINTS
// =========================================
// Archivos visuales (Front-end)
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint de reservaciones (Única declaración)
app.post('/api/disponibilidad', async (req, res) => {
    const { checkIn, checkOut, huespedes } = req.body;

    console.log(`\n🔔 Petición de disponibilidad:`);
    console.log(`📅 Check-In: ${checkIn} | Check-Out: ${checkOut} | 👥 Huéspedes: ${huespedes}`);

    try {
        const resultado = await sql.query`
            SELECT HabitacionID, NumeroHabitacion, Tipo, Capacidad, PrecioNoche, ImagenURL
            FROM Habitaciones 
            WHERE Estado = 'Disponible' AND Capacidad >= ${huespedes}
        `;

        res.json({
            success: true,
            total: resultado.recordset.length,
            habitaciones: resultado.recordset
        });

    } catch (error) {
        console.error('❌ Error al consultar en SQL Server:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor.'
        });
    }
});

// =========================================
// ENDPOINT PARA CREAR RESERVACIONES (CON CLIENTE REAL)
// =========================================

app.post('/api/reservar', async (req, res) => {
    const { habitacionID, checkIn, checkOut, huespedes, nombre, email } = req.body;
    const huespedesLimpios = parseInt(String(huespedes).match(/\d+/)?.[0] || 2);

    // 🧹 TRUCO NINJA: Cortamos el "Nombre Completo" en espacios
    const partesNombre = nombre.trim().split(' ');
    const nombreCliente = partesNombre[0]; // La primera palabra es el Nombre
    // El resto de palabras son los Apellidos (si no puso, ponemos un texto por defecto)
    const apellidoCliente = partesNombre.length > 1 ? partesNombre.slice(1).join(' ') : 'No especificado'; 

    console.log(`\n💾 Procesando reserva para: ${nombreCliente} ${apellidoCliente} (${email})`);

    try {
        let idClienteFinal;

        // PASO 1: Buscamos si el cliente ya existe por su correo
        const clienteExistente = await sql.query`SELECT ClienteID FROM Clientes WHERE Email = ${email}`;

        if (clienteExistente.recordset.length > 0) {
            // El cliente ya existe, tomamos su ID
            idClienteFinal = clienteExistente.recordset[0].ClienteID;
            console.log(`👤 Cliente recurrente encontrado con ID: ${idClienteFinal}`);
        } else {
            // PASO 2: El cliente es nuevo. Ahora SÍ mandamos la columna Apellido
            const nuevoCliente = await sql.query`
                INSERT INTO Clientes (Nombre, Apellido, Email) 
                OUTPUT INSERTED.ClienteID 
                VALUES (${nombreCliente}, ${apellidoCliente}, ${email});
            `;
            idClienteFinal = nuevoCliente.recordset[0].ClienteID;
            console.log(`🌟 Cliente nuevo registrado con ID: ${idClienteFinal}`);
        }

        // PASO 3: Guardamos la reservación con el ID 100% seguro y ocupamos el cuarto
        await sql.query`
            INSERT INTO Reservaciones (ClienteID, HabitacionID, FechaCheckIn, FechaCheckOut, NumeroHuespedes, EstadoReserva)
            VALUES (${idClienteFinal}, ${habitacionID}, ${checkIn}, ${checkOut}, ${huespedesLimpios}, 'Confirmada');
            
            UPDATE Habitaciones 
            SET Estado = 'Ocupada' 
            WHERE HabitacionID = ${habitacionID};
        `;

        res.json({ success: true, message: 'Reserva guardada con éxito.' });

    } catch (error) {
        console.error('❌ Error de SQL Server:', error);
        res.status(500).json({ success: false, message: 'Error interno de base de datos.' });
    }
});

// =========================================
// SISTEMA DE USUARIOS (UNIRSE / LOGIN)
// =========================================

// 1. REGISTRAR UN NUEVO USUARIO (Hashear contraseña)
app.post('/api/registro', async (req, res) => {
    const { nombre, email, password } = req.body;

    try {
        // Verificamos si el correo ya existe
        const existe = await sql.query`SELECT ClienteID FROM Clientes WHERE Email = ${email}`;
        if (existe.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'El correo ya está registrado.' });
        }

        // 🔒 BCRYPT EN ACCIÓN: Encriptamos la contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        // Guardamos al usuario con su contraseña ilegible
        await sql.query`
            INSERT INTO Clientes (Nombre, Apellido, Email, PasswordHash) 
            VALUES (${nombre}, 'Usuario Nuevo', ${email}, ${passwordEncriptada})
        `;

        res.json({ success: true, message: '¡Cuenta creada con éxito!' });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// 2. INICIAR SESIÓN (Verificar y dar JWT)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Buscamos al usuario en SQL
        const resultado = await sql.query`SELECT * FROM Clientes WHERE Email = ${email}`;
        const usuario = resultado.recordset[0];

        if (!usuario || !usuario.PasswordHash) {
            return res.status(400).json({ success: false, message: 'Usuario no encontrado o sin contraseña.' });
        }

        // 🔒 BCRYPT EN ACCIÓN: Comparamos la contraseña de texto con el Hash de SQL
        const contraseñaValida = await bcrypt.compare(password, usuario.PasswordHash);
        if (!contraseñaValida) {
            return res.status(400).json({ success: false, message: 'Contraseña incorrecta.' });
        }

        // 🔑 JWT EN ACCIÓN: Creamos el "Gafete Virtual" (Token) válido por 2 horas
        const token = jwt.sign(
            { id: usuario.ClienteID, email: usuario.Email, nombre: usuario.Nombre }, 
            JWT_SECRET, 
            { expiresIn: '2h' }
        );

        res.json({ success: true, message: 'Bienvenido a Lux Taxco', token: token });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
});

// =========================================
// 4. ARRANCAR EL SERVIDOR
// =========================================
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 Servidor de Lux Taxco activado.`);
    console.log(`🌐 Entra en tu navegador a: http://localhost:${PORT}`);
    console.log(`=========================================`);
});