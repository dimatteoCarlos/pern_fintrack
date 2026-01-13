// frontend/src/auth/utils/extractErrorMessge.ts

// =====================================
// 🔧 TYPE-SAFE ERROR HANDLING UTILITY
// =====================================
//Extracts AxiosError or Regular error message
export const extractErrorMessage =(err:unknown):string=>{
//Verify if error is from Axios
if(err && typeof err==='object' &&
 'response' in err &&
 err.response &&
 typeof err.response ==='object' &&
 'data' in err.response &&
 err.response.data  &&
 typeof err.response.data === 'object' &&
 'message' in err.response.data
){
  return String(err.response.data.message);
}

//Verify if it is regular error instance
if(err instanceof Error){
 return err.message;
}
//Default fallback
return 'An unexpected error occurred';
}
