// import { create } from 'zustand';
// import { USER_ID } from '../endpoints';

// export type UserDataType = {
//   userId: string | null;
//   username: string;
//   user_firstname: string;
//   user_lastname: string;
//   email: string;
// };

// export type UserStoreType = {
//   userData: UserDataType;
//   user: UserDataType | null;
//   setUser: (userData: UserDataType) => void;
//   clearUser: () => void;
//   updateUser: (updates: Partial<UserDataType>) => void;
// };

// const USERID = USER_ID //temporarily meanwhile auth module is under construction

// const initialUserState: UserDataType = {
//   // userId: null,
//   userId: USERID,
//   username: '',
//   user_firstname: '',
//   user_lastname: '',
//   email: '',
// };

// export const useUserStore = create<UserStoreType>((set) => ({
//   userData: initialUserState,
//   user: null,
//   setUser: (userData: UserDataType) =>
//     set({
//       userData,
//       user: userData,
//     }),

//   clearUser: () => set({ userData: initialUserState, user: null }),
//   updateUser: (updates: Partial<UserDataType>) =>
//     set((state) => ({ userData: { ...state.userData, ...updates } })),
// }));


