//src/middlewares/detectClienttype.js
import { classifyAccessDevice } from '../../utils/classifyAccessDevice.js';

export function authDetectClienttype(req, res, next) {
  //Después de aplicar el middleware useragent.express() en index.js, la información del User-Agent se adjunta al objeto req automaticamente.

  const ua = req.useragent;
  console.log('User-Agent:', req.headers['user-agent']); // Log del User-Agent
  if (!ua) {
    console.warn('Useragent not found ');
    req.clientTypeAccess = 'unknown';
    req.clientDeviceType = 'unknown';
    return next();
  }
  let clientType = 'unknown';
  //---
  const userAgentHeader = req.headers['user-agent'];
  const isApiClient = userAgentHeader?.includes('insomnia') ||
    userAgentHeader?.includes('postman') ||
    userAgentHeader?.includes('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36') ||
    userAgentHeader?.includes('bruno') ||
    userAgentHeader?.includes('apidog') ||
    userAgentHeader?.includes('hoppscotch') ||
    userAgentHeader?.includes('curl') ||
    userAgentHeader?.includes('httpie') ||
    userAgentHeader?.includes('paw') ||
    userAgentHeader?.includes('restclient');

  if (isApiClient) {
    req.clientTypeAccess = 'api-client';
    req.clientDeviceType = 'web'; // mobile o web segun la prueba a realizar
    console.log( `'Client type detected: ${req.clientTypeAccess}, handled as: ${req.clientDeviceType}`);
    return next();
  }
  //---
  if (ua.isMobile) {
    if (ua.isTablet) {
      if (
        /wv|crosswalk|cordova|ionic|reactnative|flutter/i.test(
          req.headers['user-agent']
        )
      ) {
        clientType = 'mobile-app';
      } else {
        clientType = 'tablet-browser';
      }
    } else {
      if (
        /wv|crosswalk|cordova|ionic|reactnative|flutter/i.test(
          req.headers['user-agent']
        )
      ) {
        clientType = 'mobile-app';
      } else {
        clientType = 'mobile-browser';
      }
    }
  } else if (ua.isDesktop) {
    clientType = 'web';
  } else if (ua.isBot) {
    clientType = 'bot';
  }
  const logicalClientType = classifyAccessDevice(clientType);

  req.clientTypeAccess = clientType; // ej. "mobile-app"
  req.clientDeviceType = logicalClientType; // ej. "mobile" or "web"

  console.log(`Client type detected: ${clientType}`);

  next();
}
