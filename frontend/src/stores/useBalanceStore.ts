//frontend/src/stores/useBalanceStore.ts

import { create } from 'zustand';

type BalanceStateType = {
  availableBudget: number;//Balances store state
  setAvailableBudget: (newBalance: number) => void;//Balance store action
};

export const useBalanceStore = create<BalanceStateType>((set) => ({
  availableBudget: 0,
  setAvailableBudget: (newBalance) => set({ availableBudget: newBalance }),
}));

export default useBalanceStore;



