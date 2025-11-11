// 📄 frontend/src/stores/useAccountStore.ts 
import { create } from "zustand";
import { AccountListType } from "../types/responseApiTypes";

// AccountListType is the type used in the dashboard list
type AccountStoreState = {
  allAccounts: AccountListType[];
};
//Action type definitions 
type AccountStoreActionsType = {
  setAllAccounts: (accounts: AccountListType[]) => void;

  updateAccount: (updatedAccount: AccountListType) => void; 
};
//===========================
//ZUSTAND STORE IMPLEMENTATION
export const useAccountStore = create<AccountStoreState & AccountStoreActionsType>((set) => ({
  allAccounts: [],
  setAllAccounts: (accounts: AccountListType[]): void => set({ allAccounts: accounts }),

  // 🔄 IMPLEMENTACIÓN DE LA LÓGICA DE MUTACIÓN IN-PLACE
  updateAccount: (updatedAccount) => set((state) => ({
   allAccounts: state.allAccounts
    .map(account => 
    account.account_id === updatedAccount.account_id 
        ? updatedAccount 
        : account
    ),
  })),
}));