//backend/index.js
import app from './src/app.js';
// export default function handler(req, res) {
//   return app(req, res);
// }
export default async function handler(req, res) {
  // Ejecuta Express con los objetos req/res de Vercel
  await new Promise((resolve, reject) => {
    app(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
