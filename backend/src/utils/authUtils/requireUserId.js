//backend/src/utils/authUtils/requireUserId.js
import { respondError } from '../responseHelpers.js';
import { getAuthenticatedUserId } from './getAuthenticatedUserId.js';

/**
 * Guard: resolve the authenticated user's ID, or send a 401 and return null.
 *
 * ⚠️ SIDE EFFECT: on failure this function WRITES the HTTP response.
 * Callers MUST return immediately:
 *
 *   const userId = requireUserId(req, res);
 *   if (!userId) return;
 *
 * Omitting the early return leads to ERR_HTTP_HEADERS_SENT later in the
 * handler, far from its cause.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {string | null} the userId, or null when a 401 was already sent.
 */
export const requireUserId = (req, res) => {
 const userId = getAuthenticatedUserId(req);

 if (!userId) {
  respondError(res, 401, 'Unauthorized: missing user identity claim in token.');
  return null;
 }

 return userId;
};