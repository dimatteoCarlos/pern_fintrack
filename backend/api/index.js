// backend/api/index.js
import app from '../src/app.js';
import serverless from 'serverless-http';

export default serverless(app);