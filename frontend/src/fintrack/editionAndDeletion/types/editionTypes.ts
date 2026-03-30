//frontend\src\edition\types\editionTypes.ts

import { CategoryBudgetAccountListType } from '../../types/responseApiTypes';

// 🎯 EXTENDED TYPES FOR CATEGORY BUDGET ACCOUNTS
// 🧾 ENRICHED CATEGORY ACCOUNT TYPE
export type EnrichedCategoryAccountType = CategoryBudgetAccountListType & {
  remain: number;
  statusAlert: boolean;
};

// 📍 CATEGORY DETAIL ROUTE STATE TYPE
export type CategoryDetailRouteStateType = {
  accountDetailed?: EnrichedCategoryAccountType | null;
  previousRoute: string;
};
