//backend/src/utils/authUtils/getAuthenticatedUserId.js

/**
 * Resolve the authenticated user's ID from the verified JWT payload.
 *
 * The claim is named `userId`: see createToken() and createRefreshToken()
 * in authFn.js, which sign `{ userId: id, ... }`. The token is the ONLY
 * acceptable source of identity — never read a user ID from req.body,
 * req.query or req.params.
 *
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export const getAuthenticatedUserId = (req) => {
 return req.user?.userId ?? null;
};
