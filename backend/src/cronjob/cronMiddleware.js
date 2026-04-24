// backend/src/cronjob/cronMiddleware.js

// Middleware to protect cron job endpoints (e.g., token cleanup)
// Expects: Authorization: Bearer <CRON_SECRET>

export const verifyCronSecret = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET is not defined in environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!token || token !== cronSecret) {
    console.warn(`Unauthorized attempt to access cron endpoint from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: invalid or missing cron secret' });
  }

  next();
};