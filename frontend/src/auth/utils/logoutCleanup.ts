//📂 frontend/src/utils/logoutCleanup.ts
import { LOCAL_STORAGE_KEY } from "../../helpers/constants";
import { useAuthStore } from "../stores/useAuthStore"
import { navigationHelper } from "./navigationHelper";
import { notifySessionExpired } from "./notification";

/**
 * 🚨 GLOBAL CLEANUP FUNCTION 🚨
 * Centralizes the removal of all session data and redirects the user.
 * * @param shouldNotify If true, triggers a "Session Expired" toast and adds state to navigation.
*/

export const logoutCleanup = (shouldNotify:boolean = false)=>{
console.log(`🚨 Performing cleanup: ${shouldNotify?'Session expired': 'Manual logout'}`);

// 0. Get actions from Zustand store (directly from the state)
 const {setIsAuthenticated, setUserData,clearError,clearSuccessMessage}=useAuthStore.getState();
//----------------------------------
// ✅ SAFETY CLEANING: ACCESS TOKEN & SESSION STATE
//----------------------------------
//1. Tokens and states cleaning
 sessionStorage.removeItem('accessToken');

 // ✅ ZUSTAND RESET STORE
 //2. Reset global store.
 // Reset global authentication states in RAM
 setIsAuthenticated(false);
 clearError();
 clearSuccessMessage(); //no "Signed Up" messages remain

// -------------------------------
// ✅ LOCAL STORAGE CLEANING: CONDITIONAL PERSISTENCE
 const isRemembered=localStorage.getItem(LOCAL_STORAGE_KEY.REMEMBER_ME)==='true';

 if(!isRemembered){
//not remembered - full cleanup
 setUserData(null);
// Explicitly remove keys from LocalStorage
 localStorage.removeItem(LOCAL_STORAGE_KEY.REMEMBER_ME ||'fintrack_remember_me');
 localStorage.removeItem(LOCAL_STORAGE_KEY.USER_DATA ||'fintrack_user_data');

 console.log('🚨 Full cleanup performed: All persistent data removed.');
}else{
// Remembered - keep data for next visit
 console.log('Persistence kept for next visit (remember me enabled)');
}
// ----------------------------------
// ✅ MANAGE NOTIFICATION AND REDIRECT
// ----------------------------------
// 🚨 TEMPORARY DEBUG LOGS - REMOVE AFTER FIXING
 console.log('🔍 logoutCleanup - shouldNotify:', shouldNotify);
 console.log('🔍 logoutCleanup - stack trace:', new Error().stack);

// 4. Manage Nofitification and redirect with state
 if(shouldNotify){
 // 🔴 SESSION EXPIRED - Show notification and expired state
  console.log('🔴 Session expired - showing notification');  
//expired:true. Session expired - show notification and specific state
 notifySessionExpired();

// Redirect to auth page with 'expired' state so the UI knows to show a specific message
 navigationHelper.navigate('/auth', {state:{expired:true}});
 }else{
   // 🟢 MANUAL LOGOUT - No notification, no expired state
  console.log('🟢 Manual logout - redirecting without state');
  
  // ✅ IMPORTANT: Navigate WITHOUT any state to prevent "expired" message
  navigationHelper.navigate('/auth');
  }
 };


