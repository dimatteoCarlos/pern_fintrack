// 📄 frontend/src/edition/hooks/usePatchAccount.ts
import { useFetchLoad, FetchResponseType } from '../../hooks/useFetchLoad';
import { AccountByTypeResponseType } from '../../types/responseApiTypes';

/**
 * 🎣 CUSTOM HOOK: CONFIG OF PATCH FOR EDITING ACCOUNTS
 * useFetchLoad TO handle send state and error 
 */

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const usePatchAccount = (accountId: string): FetchResponseType<AccountByTypeResponseType, any> => {
// 🔗 URL BLOCK: Construye la URL del endpoint PATCH del backend
    const url = `/api/accounts/${accountId}/updateEdit`;

    // 🚀 EXECUTE FETCHLOAD: Inicializa el hook para la mutación
    // D es 'any' o BaseAccountEditFormData (el payload parcial)

//eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patchHook = useFetchLoad<AccountByTypeResponseType, any>({
        url: url,
        method: 'PATCH', // PATCH method for partial updating
    });

    // 📤 RETURN BLOCK: returns configured hook 
    return patchHook;
};