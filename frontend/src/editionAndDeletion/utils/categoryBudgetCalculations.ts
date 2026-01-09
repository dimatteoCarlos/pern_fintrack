// frontend/src/helpers/categoryBudgetCalculations.ts
// 🎯 CATEGORY BUDGET DATA ENRICHMENT UTILITIES

//📊 ENRICH CATEGORY ACCOUNT WITH BUDGET DATA
import { AccountListType, CategoryBudgetAccountListType } from "../../types/responseApiTypes";


//  📊 VALIDATE CATEGORY BUDGET ACCOUNT
//Type guard to check if account is category budget type
export const isCategoryBudgetAccount = (account:AccountListType):account is CategoryBudgetAccountListType=>{
  return account.account_type_name.toLowerCase().trim() === 'category_budget'
  
}

export const enrichCategoryAccountData = (account:CategoryBudgetAccountListType):CategoryBudgetAccountListType & {remain:number; statusAlert:boolean}=>{


const remain = Math.round(account.budget-account.account_balance)
const statusAlert = remain<=0

console.log('account', account, )
return {
 ...account, remain, statusAlert
}

}

// 🛡️ VALIDATE ACCOUNT HAS REQUIRED BUDGET DATA
// export const hasCompleteBudgetData = (account: any): boolean => {
//   return account && 
//          account.budget !== undefined && 
//          account.budget !== null;
// };