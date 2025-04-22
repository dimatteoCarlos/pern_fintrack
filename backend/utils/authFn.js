import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const salt = Number(process.env.SALT_ROUNDS);

export const hashed = async (word) => {
  const salted = await bcrypt.genSalt(salt);
  const hashedWord = await bcrypt.hash(word, salted);
  return hashedWord;
};

//---
export const isRight = async (userPwd, hashedPwd) => {
  try {
    const isRightPwd = await bcrypt.compare(userPwd, hashedPwd);
    return isRightPwd;
  } catch (error) {
    process.env.ENV === 'development'
      ? console.error(error, 'error message comparing password')
      : console.error('error:', 'something went error');
  }
};

//--
export const createToken = (id, role) => {
  if (!id) {
    throw new Error('the user id is required to generate the token.');
  }

  if (!role) {
    throw new Error('the user role is required to generate the token.');
  }

  // Verificar que la clave secreta esté configurada
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'Secret JWT key is not configured on environment variables. La clave secreta JWT no está configurada en las variables de entorno.'
    );
  }

  return jwt.sign(
    { userId: id, type: 'access_token', role },
    process.env.JWT_SECRET,
    {
      expiresIn: '1h',
    }
  );
};

//--
export const createRefreshToken = (id) => {
  if (!id) {
    throw new Error('the user id is required to generate the token.');
  }

  // Verificar que la clave secreta esté configurada
  if (!process.env.JWT_REFRESH_TOKEN_SECRET) {
    throw new Error(
      'Secret refresh JWT key is not configured on environment variables. La clave secreta JWT no está configurada en las variables de entorno.'
    );
  }

  return jwt.sign(
    { userId: id, type: 'refresh_token' },
    process.env.JWT_REFRESH_TOKEN_SECRET,
    {
      expiresIn: '1d',
    }
  );
};
