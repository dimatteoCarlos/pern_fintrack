// backend/src/utils/authUtils/cookieConfig.js

//functions: getCookieOptions, setRefreshTokenCookie,clearRefreshTokenCookie

import pc from 'picocolors';

// === DEFINE AND GET COOKIE OPTIONS ===
export const getCookieOptions = (type = 'set') => {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseOptions = {
   httpOnly: true,
   secure: isProduction,
   sameSite: isProduction ? 'none' : 'lax',
   path: '/api',
  };

  if (type === 'clear') {
// Para clearCookie no necesitas httpOnly ni sameSite? En realidad sí, deben coincidir.
    return { ...baseOptions };
  }

  return baseOptions;
};

//=== SET REFRESH TOKEN =======
export const setRefreshTokenCookie = (res, refreshToken) => {

  res.cookie('refreshToken', refreshToken, getCookieOptions('set'));

  console.log(pc.green('🍪 Refresh token cookie set successfully.'));
};

// === CLEAR REFRESH TOKEN ====
export const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', getCookieOptions('clear'));
  console.log(pc.yellow('🗑️ Refresh token cookie cleared.'));
};

// == CLEAR ACCESS TOKEN (for future use just in case) ===
export const clearAccessTokenCookie = (res) => {
  res.clearCookie('accessToken', getCookieOptions('clear'));
  console.log(pc.yellow('🗑️ Access token cookie cleared.'));
};
