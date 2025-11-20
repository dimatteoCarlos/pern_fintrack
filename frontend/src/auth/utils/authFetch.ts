// src/utils/authFetch.ts
import axios, { AxiosRequestConfig  } from 'axios';
import { url_refrestoken,  } from "../../endpoints"
import { logoutCleanup } from './logoutCleanup';
//----
/**
 * 🎯 FETCH WITH AUTO-REFRESH / HANDLE authentication automatically
 * ✅ Include token in headers
 * ✅ Auto-refresh expired tokens
 * ✅ Retries for failed request in case of auth. error 
*/
//MAIN FUNCTION authFetch
export const authFetch = async<T> (url: string, options: AxiosRequestConfig  = {})=>{
// 1. 🎯 GET ACCESS TOKEN
// get access token from sessionStorage
const accessToken = sessionStorage.getItem('accessToken')

// 2. 📨 CONFIGURE INITIAL REQUEST
//configure request with authentication
const requestConfig:AxiosRequestConfig ={
  ...options,
  withCredentials: true,
  headers:{
    'Content-Type':'application/json',
    ...options.headers,
    ...(accessToken && {'Authorization':`Bearer ${accessToken}`})
  }
}
// -------------------------------------
try {
// 3. 🎯 FIRST ATTEMP TO REQUEST FOR ACCESS
const authFetchResponse = await axios<T>(url, requestConfig);

// console.log("🚀 ~ authFetch ~ FIRST ATTEMPT authFetchResponse:", authFetchResponse)

return authFetchResponse

} catch (error) {
 if (axios.isAxiosError(error) && error.response?.status === 401) {
// 4. 🔄 AUTO-REFRESH IN CASE OF EXPIRED TOKEN(Unauthorized status code 401)
  try{
// 📞 CALL ENDPOINT OF REFRESH
  const refreshResponse = await axios.post(url_refrestoken, null, {
    withCredentials: true,
  });
// console.log("🚀 ~ authFetch 401 error ~ refreshResponse:", refreshResponse)

// 🚨 REFRESH ERROR 🚨
  if(refreshResponse.status !==200){
  console.error('Refresh Token Failed. Forcing logout.');
  logoutCleanup();
  //Throw an error so useFetch hooks will stop processing
  throw new Error ('REFRESH_FAILED_LOGOUT_FORCED') 
  }
//------
  const newAccessToken = refreshResponse.data.accessToken;
// console.log("🚀 ~ authFetch ~ refreshResponse:", refreshResponse)
// console.log("🚀 ~ authFetch ~ newAccessToken:", newAccessToken)
  if (!newAccessToken) {
    throw new Error('No access token received from refresh');
    }
// 💾 UPDATE ACCESS TOKEN
  sessionStorage.setItem('accessToken',newAccessToken)

// 🔁 RETRY ORIGINAL REQUEST
const retryConfig: AxiosRequestConfig = {
    ...requestConfig,
    headers: {
      ...requestConfig.headers,
      'Authorization': `Bearer ${newAccessToken}`,
    },
  };

const retryAuthFetchResponse = await axios(url, retryConfig);
// console.log("🚀 ~ authFetch ~ retryAuthFetchResponse:", retryAuthFetchResponse)
  return retryAuthFetchResponse

//🚨BLOCK FOR ERROR CAPTURING DURING REFRESH 🚨
//ANY ERROR DURING REFRESH CALL (Network, Server 5xx, or specific server error) FORCES LOGOUT
  } catch (refreshError) {
// Handle server errors during the refresh process (401: 'No access token' or 'REFRESH_FAILED_LOGOUT_FORCED')
// If the error is already the special forced logout error, re-throw it.
  if (refreshError instanceof Error && refreshError.message === 'REFRESH_FAILED_LOGOUT_FORCED') {
//abort
    throw refreshError;
  }
// For any other failure during the refresh process (e.g., network error or server non-401/403 response body error), clean up and throw.
  console.error('Error during token refresh attempt, forcing logout:', refreshError);
  logoutCleanup();
  throw new Error('REFRESH_FAILED_LOGOUT_FORCED');
  } 
//🚨BLOCK TO CAPTURE OTHER ERRORS (Non-401)🚨
}else {
// 🚨RE-THROW THE ERROR, WHETHER IT'S THE SPECIAL LOGOUT ERROR OR A NORMAL NON-401 ERROR (e.g., 400/403)🚨
  if (error instanceof Error && error.message === 'REFRESH_FAILED_LOGOUT_FORCED') {
    //This prevents to show it as a normal error / Esto previene que se muestre como un error normal en useFetch/useFetchLoad.
    console.error('🚨 Re-throw other errors', error) 
    throw error;
    }
    throw error;
 }
  }
};
