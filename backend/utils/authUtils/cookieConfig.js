// utils/cookieConfig.js
import pc from 'picocolors';

export const setRefreshTokenCookie = (res, refreshToken) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax', // O 'Strict'
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: '/api'
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);
  console.log(pc.green('🍪 Refresh token cookie set successfully.'));
};