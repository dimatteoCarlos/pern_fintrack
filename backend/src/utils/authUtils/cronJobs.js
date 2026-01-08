// cronJobs.js
import cron from 'node-cron';
import pc from 'picocolors';
import { pool } from '../../db/configDB.js';

// Schedule a task to run once a day at a specific time (e.g., 7:00 AM)

//The cron syntax is: second minute hour dayOfMonth month dayOfWeek. 0 3 * * * means 0 seconds, 3rd hour, every day of the month, every month, and every day of the week.
cron.schedule('0 0 7 * * *', async () => {
  console.log(
    pc.bgBlue('Running cron job to delete old revoked refresh tokens...')
  );
  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - 2);

    const result = await pool.query(
      'DELETE FROM refresh_tokens WHERE revoked = TRUE AND updated_at < $1',
      [daysAgo]
    );

    console.log(
      pc.green(
        `Successfully deleted ${result.rowCount} old revoked refresh tokens.`
      )
    );
  } catch (error) {
    console.error(pc.red('Error deleting old revoked refresh tokens:', error));
  }
});

console.log(
  pc.yellow('Cron job for deleting old revoked refresh tokens scheduled.')
);
