// src/utils/fintrackUtils/date-utils/getUserTimeZone.js

// The IANA zone a user's calendar is read on. Every period boundary depends on
// it, so it is fetched once per request at the controller and passed down: no
// service resolves identity on its own.

/**
 * Read the stored time zone of a user.
 *
 * Falls back to UTC instead of throwing. The column is NOT NULL with a 'UTC'
 * default and guarded by a trigger, so a row can only be missing when the id
 * does not exist — and a read must not die on that. The caller has already
 * checked ownership by the time it gets here.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} db - a pool, or the client
 *  of a transaction in flight so the read shares its snapshot.
 * @param {string} userId - UUID from the token, never from the client body.
 * @returns {Promise<string>} an IANA zone identifier.
 */
export async function getUserTimeZone(db, userId) {
 const { rows } = await db.query(
  `SELECT timezone FROM users WHERE user_id = $1`,
  [userId],
 );

 return rows[0]?.timezone ?? 'UTC';
}
