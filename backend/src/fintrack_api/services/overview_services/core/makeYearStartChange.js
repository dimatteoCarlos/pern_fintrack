// src/fintrack_api/services/overview_services/core/makeYearStartChange.js

// The change in a point-in-time balance since the prior calendar year's
// December 31 close: PLAN_EXPORT.md commit 5a, feeding the Period Statement's
// Year to date column for net worth, cash position, free cash, investment,
// receivable, payable, net debt position and pockets committed.
//
// A pure difference and nothing else. This function invents no notice of its
// own: when a close arrives null (liquid net worth with no payable leg, for
// example), the reason is already known to whichever function computed that
// close - makeHeroSection.js already pushes NO_DEBT_LEGS_NOTICE for exactly
// that case - and the caller carries that same notice forward instead of this
// generic diff inventing a second, less specific one.
//
// The five repositories PLAN_EXPORT.md §9 names (getBankBalance,
// getFreeCash, getInvestmentFigures, getDebtDomainFields,
// pocketBoardService.getBoard's committed total) already accept any past
// month, so the prior close is read by calling each with `'(year-1)-12-01'` -
// no new query, only a second call to a reader that already exists.

import { money, toAmount } from '../../budget_services/core/money.js';

/**
 * @param {number|null} currentClose - the reference month's close
 * @param {number|null} priorClose - the prior December 31 close
 * @returns {number|null} the rounded difference, or null if either close is null
 */
export const makeYearStartChange = (currentClose, priorClose) =>
 currentClose === null || priorClose === null
  ? null
  : toAmount(money(currentClose).minus(priorClose));
