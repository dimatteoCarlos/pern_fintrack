// 📄 frontend/src/stores/useAccountStore.ts
//Ref: useRTAImpactAndDeletions.ts, EditAccount.tsx

import { create } from 'zustand';
import { AccountListType } from '../types/responseApiTypes';

// ---------------------------------
// 1. 📚 ACCOUNT STORE TYPES
// ---------------------------------
// AccountListType is the type used in the dashboard list
type AccountStoreStateType = {
  allAccounts: AccountListType[];
};

// What PATCH /account/edit/:id returns: account_id plus only the fields that
// changed, with the id serialized as text because it comes from the URL.
export type AccountPatchType = Partial<AccountListType> & {
  account_id: number | string;
};

//Action type definitions
type AccountStoreActionsType = {
  setAllAccounts: (accounts: AccountListType[]) => void;

  updateAccount: (updatedAccount: AccountPatchType) => void;

  removeAccount: (accountId: number | string) => void;
};

//===========================
// 2. ZUSTAND STORE IMPLEMENTATION
//===========================
export const useAccountStore = create<
  AccountStoreStateType & AccountStoreActionsType
>((set) => ({
  allAccounts: [],

  setAllAccounts: (accounts: AccountListType[]): void =>
    set({ allAccounts: accounts }),

  // 🔄 IN-PLACE MUTATION LOGIC FOR EDITION
  // Merged, not replaced: the response carries only the edited fields, so
  // overwriting the row would drop the balance, the currency and the type.
  updateAccount: (updatedAccount) =>
    set((state) => ({
      allAccounts: state.allAccounts.map((account) =>
        // The id arrives as text and the list holds it as a number.
        String(account.account_id) === String(updatedAccount.account_id)
          ? { ...account, ...updatedAccount }
          : account,
      ),
    })),

  // 🗑️ LOGIC TO REMOVE ACCOUNT
  removeAccount: (accountId) =>
    set((state) => ({
      allAccounts: state.allAccounts.filter(
        (account) => String(account.account_id!) !== String(accountId),
      ),
    })),
}));
