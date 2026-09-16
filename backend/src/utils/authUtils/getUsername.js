//backend/src/utils/authUtils/getUsername.js

// The account owner's name for a download's filename. Fetched once per
// request and passed down, same shape as getUserTimeZone.js: no service
// resolves identity on its own.

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db - a pool, or the client
 *  of a transaction in flight so the read shares its snapshot.
 * @param {string} userId - UUID from the token, never from the client body.
 * @returns {Promise<string>}
 */
export async function getUsername(db, userId) {
 const { rows } = await db.query(
  `SELECT username FROM users WHERE user_id = $1`,
  [userId],
 );

 return rows[0]?.username ?? 'user';
}
