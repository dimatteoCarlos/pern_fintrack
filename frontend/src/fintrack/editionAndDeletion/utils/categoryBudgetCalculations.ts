// frontend/src/helpers/categoryBudgetCalculations.ts
// 🎯 CATEGORY BUDGET DATA ENRICHMENT UTILITIES

//📊 ENRICH CATEGORY ACCOUNT WITH BUDGET DATA
import {
  AccountListType,
  CategoryBudgetAccountListType,
} from '../../types/responseApiTypes';

//  📊 VALIDATE CATEGORY BUDGET ACCOUNT
//Type guard to check if account is category budget type
export const isCategoryBudgetAccount = (
  account: AccountListType,
): account is CategoryBudgetAccountListType => {
  return account.account_type_name.toLowerCase().trim() === 'category_budget';
};

// Retired 2026-09-07. Nothing imports this function, and every render site of
// remain and statusAlert is already commented out (ListCategory.tsx:218-221,
// CategoryAccountList.tsx:175-182, ListAccountOfCategory.tsx:226-229).
//
// The subtraction was wrong in the same way the backend's was: account_balance
// on a category_budget account is the accumulated spend since the account
// opened, with no period, while budget is one month's plan. Math.round also
// dropped the cents the DECIMAL(15,2) column stores.
//
// The figure for a stated period comes from GET /api/fintrack/budget/summary,
// which returns remainingBudget and executionPercentage already computed.
//
// export const enrichCategoryAccountData = (
//   account: CategoryBudgetAccountListType,
// ): CategoryBudgetAccountListType & { remain: number; statusAlert: boolean } => {
//   const remain = Math.round(account.budget - account.account_balance);
//   const statusAlert = remain <= 0;
//
//   return {
//     ...account,
//     remain,
//     statusAlert,
//   };
// };

// 🛡️ VALIDATE ACCOUNT HAS REQUIRED BUDGET DATA
// export const hasCompleteBudgetData = (account: any): boolean => {
//   return account &&
//          account.budget !== undefined &&
//          account.budget !== null;
// };
