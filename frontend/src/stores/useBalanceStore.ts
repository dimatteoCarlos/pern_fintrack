import { create } from 'zustand';

type BalanceStateType = {
  availableBudget: number;
  setAvailableBudget: (newBalance: number) => void;
};

export const useBalanceStore = create<BalanceStateType>((set) => ({
  availableBudget: 0,
  setAvailableBudget: (newBalance) => set({ availableBudget: newBalance }),

}));

export default useBalanceStore;
