// src/utils/logoutCleanup.ts
import { useAuthStore } from "../stores/useAuthStore"
import { navigationHelper } from "./navigationHelper";
import { notifySessionExpired } from "./notification";

// 🚨 CLEANING FUNCTION 🚨
//Used when refresh token failed. Out of react context.
export const logoutCleanup = ()=>{
console.log('🚨 Refresh Token failed. Performing global cleanup and redirect...');

const {setIsAuthenticated, setUserData,clearError}=useAuthStore.getState()

//✅ SAFETY TOKENS AND STATES CLEANING
//1. Tokens and states cleaning
sessionStorage.removeItem('accessToken');
setIsAuthenticated(false);
setUserData(null);
clearError();
//2. Nofitification and redirect
notifySessionExpired()
navigationHelper.navigate('/auth');
}