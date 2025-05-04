import { create } from 'zustand';

type BalanceStateType = {
  availableBudget: number;
  setAvailableBudget: (newBalance: number) => void;
};

export const useBalanceStore = create<BalanceStateType>((set) => ({
  availableBudget: 0,
  setAvailableBudget: (newBalance) => set({ availableBudget: newBalance }),

  // Nueva función que centraliza la lógica de fetching
  /*
fetchAndUpdateBalance: async (user) => {
  try {
    const { data: apiResponse } = await axios.get<BalanceBankRespType>(
      `${url_get_total_account_balance_by_type}/?type=bank&user=${user}`
    );

    if (typeof apiResponse.data.total_balance === 'number') {
      set({ availableBudget: apiResponse.data.total_balance }); // Actualiza el store
    }
  } catch (error) {
    console.error('Error fetching balance:', error);
  }
},
*/
}));

export default useBalanceStore;
