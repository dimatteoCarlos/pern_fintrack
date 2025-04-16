import pg from 'pg';
import pc from 'picocolors';
import dotenv from 'dotenv';
dotenv.config();

const uri = {
  connectionString: process.env.DATABASE_URI,
  ssl: { rejectUnauthorized: false }, //Never use this in production. alternative: mkcert
  connectionTimeoutMillis: 10000, // Tiempo de espera para la conexión (5 segundos)
  idleTimeoutMillis: 30000, // Tiempo de espera para conexiones inactivas (30 segundos)
};

export const pool = new pg.Pool(uri); // Ojo, Pool espera un objeto

export async function checkConnection() {
  try {
    await pool.query('SELECT 1');
    console.log(
      pc.italic(pc.yellowBright('Conexión a la base de datos verificada.'))
    ); //Data base connection verified
  } catch (error) {
    console.error(
      pc.red('Error al verificar la conexión a la base de datos:', error)
    ); //Error when connecting to data base.
    throw error;
  }
}
// pool.on('error', (err) => {
// console.error('Unexpected error on idle client', err);
// Termina la aplicación si hay un error grave
// process.exit(-1);
// });
