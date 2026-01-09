// 📄 frontend/src/stores/useAccountStore.ts 
import { create } from "zustand";
import { AccountListType } from "../types/responseApiTypes";

// ---------------------------------
// 1. 📚 ACCOUNT STORE TYPES
// ---------------------------------
// AccountListType is the type used in the dashboard list
type AccountStoreStateType = {
  allAccounts: AccountListType[];
};

//Action type definitions 
type AccountStoreActionsType = {
  setAllAccounts: (accounts: AccountListType[]) => void;

  updateAccount: (updatedAccount: AccountListType) => void; 

  removeAccount:(accountId:number|string)=>void;
};

//===========================
// 2. ZUSTAND STORE IMPLEMENTATION
//===========================
export const useAccountStore = create<AccountStoreStateType & AccountStoreActionsType>
((set) => ({
  allAccounts: [],

  setAllAccounts: (accounts: AccountListType[]): void => set({ allAccounts: accounts }),

// 🔄 IN-PLACE MUTATION LOGIC FOR EDITION
  updateAccount: (updatedAccount) => set((state) => ({
   allAccounts: state.allAccounts
    .map(account => 
    account.account_id === updatedAccount.account_id 
        ? updatedAccount 
        : account
    ),
  })),

// 🗑️ NEW: LOGIC TO REMOVE ACCOUNT
removeAccount:(accountId)=>set((state)=>({
 allAccounts:state.allAccounts.filter(
  account => String(account.account_id!)!==String(accountId)
 )
 }))  

}));