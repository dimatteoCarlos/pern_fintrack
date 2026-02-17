// src/utils/notification.ts
import { toast } from 'react-toastify';

export const notifySuccess = (message: string) => toast.success(message);

export const notifyError = (message: string) => toast.error(message);

export const notifyWarning = (message: string) => toast.warn(message);

export const notifySessionExpired = () => {
  toast.error('Your session has expired. Please, sign in again.', {
    toastId: 'session-expired', // Avoid msg duplicating / Evita duplicar el mensaje
    autoClose: 2000,
    closeOnClick: true,  
  });
};

// export const notifySuccess = (message: string , option?:object) => toast.success(message, option);

// export const notifyError = (message: string , option?:object) => toast.error(message, option);

// export const notifyWarning = (message: string , option?:object) => toast.warn(message, option);