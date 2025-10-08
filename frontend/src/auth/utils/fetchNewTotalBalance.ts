// src/utils/fetchNewTotalBalance.ts
import { url_get_total_account_balance_by_type } from "../../endpoints";
import { BalanceBankRespType } from "../../types/responseApiTypes";
import { authFetch } from "./authFetch";

/**
 * 🎯 Utility function to get the total bank account balance
*/
export async function fetchNewBalance():Promise<number | null> {
 try {
   const url = `${url_get_total_account_balance_by_type}?type=bank`

   const balanceBankResponse = await authFetch<BalanceBankRespType>(url)

   const total_balance =balanceBankResponse.data?.data.total_balance

   if(typeof total_balance ==='number'){
    return total_balance
    }
    return null

// console.log("🚀 ~ Income ~ balanceBankResponse:", balanceBankResponse)

  } catch (error) {
     console.error('Error fetching new balance:', error);
     return null
  }
} 
