//backend/src/db/configDB.js
import pg from 'pg';
import pc from 'picocolors';
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const uri = {
 connectionString: process.env.DATABASE_URI,
 //,  ssl: { rejectUnauthorized: false }, //Never use this in production. alternative: mkcert
 ssl: isProduction ? { rejectUnauthorized: false } : false,

 connectionTimeoutMillis: 10000, // Tiempo de espera para la conexión (5 segundos)

 idleTimeoutMillis: 30000, // Tiempo de espera para conexiones inactivas (30 segundos)
};

export const pool = new pg.Pool(uri); // Ojo, Pool espera un objeto

// Manejo de errores globales del pool (Muy recomendado)
pool.on('error', (err) => {
 console.error(pc.red('Error inesperado en un cliente inactivo de la DB:'), err);
 // No cerramos el proceso necesariamente, pero lo registramos
});

export async function checkConnection() {
  try {
   const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

   console.log(
    pc.italic(pc.yellowBright('Conexión a la base de datos verificada.'))
   ); //Data base connection verified
  } catch (error) {
    console.error(
     pc.red('❌ Error crítico al conectar con la base de datos:', error.message)
    ); //Error when connecting to data base.
    // if (isProduction) throw error;
    throw error;
  }
}
