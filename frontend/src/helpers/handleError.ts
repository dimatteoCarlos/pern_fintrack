//frontend/src/helpers/handleError.ts
//Parent: Expense.tsx
import { normalizeError } from "./normalizeError";

export const handleError = (
  error: unknown
): { message: string; status: number; isAuthError: boolean } => {
  const { message, status } = normalizeError(error);

  return {
    message,
    status, 
    isAuthError: status === 401 ||  status === 403,
  };
};

