//backend/index.js
// import app from './src/app.js';
// import serverless from 'serverless-http';

// export default serverless(app);

export default function handler(req, res) {
  console.log("Handler funciona");
  res.status(200).json({ ok: true, message: "Handler directo funciona" });
}

