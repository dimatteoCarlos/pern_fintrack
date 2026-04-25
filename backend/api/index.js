// backend/api/index.js
// import app from '../src/app.js';
// import serverless from 'serverless-http';

export default function handler(req, res) {
  res.status(200).json({
    from: 'api index',
    method: req.method,
    url: req.url,
  });
}
