//backend/src/utils/classifyAccessDevice.js

export function classifyAccessDevice(clientType) {
  switch (clientType) {
    case 'web':
    case 'tablet-browser':
    case 'mobile-browser':
      return 'web';

    case 'mobile-app':
      return 'mobile';

    case 'bot':
      return 'bot';

    default:
      return 'unknown';
  }
}

// if (clientType === 'bot') {
//   return res.status(403).json({ message: 'Los bots no requieren autenticación.' });

// }

// if (clientType === 'unknown') {
//   return res.status(400).json({ message: 'No se pudo determinar el tipo de cliente. Acceso denegado.' });
// }
