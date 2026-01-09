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


