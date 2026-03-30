// frontend/src/auth/hooks/useSuccessAutoClose.ts

import { useAutoClose } from '../../fintrack/hooks/useAutoClose';

//frontend/src/auth/hooks/useAutoClose.ts
export const useSuccessAutoClose = (
  successMessage: string | null,
  onClose: () => void,
  durationMs: number = 5000,
) => {
  useAutoClose(durationMs, onClose, Boolean(successMessage));
};
