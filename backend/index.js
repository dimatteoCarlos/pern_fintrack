//backend/index.js
// import app from './src/app.js';
import serverless from 'serverless-http';

// export default serverless(app);

function handler(req, res) {
  console.log('Handler funciona');
  res.status(200).json({
    ok: true,
    message: 'Handler envuelto por serverless-http - FUNCIONA!',
  });
}

export default serverless(handler);
