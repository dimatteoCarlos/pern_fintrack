// src/utils/notification.ts
import { toast } from 'react-toastify';

export const notifySuccess = (message: string) => toast.success(message);

export const notifyError = (message: string) => toast.error(message);

export const notifyWarning = (message: string) => toast.warn(message);

export const notifySessionExpired = () => {
  toast.error('Your session has expired. Please, sign in again.', {
    toastId: 'session-expired', // Evita duplicar el mensaje
    autoClose: 5000,
    closeOnClick: true,  
  });
};



