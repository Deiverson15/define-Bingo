
require('dotenv').config();

// 2. Importa la clase 'Pool' desde la librería pg
const { Pool } = require('pg');

// 3. Crea una instancia del pool de conexiones (USANDO TU CONFIGURACIÓN ORIGINAL)
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// 4. (AÑADIDO) Función para verificar la conexión al iniciar el servidor
async function checkDBConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Conexión a la base de datos PostgreSQL exitosa:', result.rows[0].now);
  } catch (err) {
    console.error('❌ Error al conectar con la base de datos:', err);
    process.exit(1); // Detiene la aplicación si no puede conectar
  }
}

// 5. (MODIFICADO) Exportamos un objeto con el pool y la función de verificación
module.exports = { 
    pool, 
    checkDBConnection 
};