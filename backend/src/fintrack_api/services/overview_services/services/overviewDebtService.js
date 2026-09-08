// src/fintrack_api/services/overview_services/services/overviewDebtService.js

// The Debt domain calculator behind GET /overview/debt.
//
// D1 is a net position, not a total owed: debtor balances are already signed —
// lending raises one, borrowing lowers it — so what the card publishes is what
// the user is owed minus what the user owes, in one figure. Splitting it into
// two would be a second formula for a number the ledger already keeps.
//
// The two legs published beside it are not that second formula. D1 still comes
// from the balance series and is never recomputed from them (§4.2 — one figure,
// one path); the legs are the same balances split by sign at the same cut, so
// `totalAmount = receivable - payable` is something the card can be checked
// against. The screen keeps deriving its "you owe" / "you're owed" label from
// the sign of the total; the backend publishes figures and no labels.
//
// No trend (§12). The catalog defines no monthly debt flow to draw a series
// from, and the field is absent rather than null for the same reason §6 omits
// return % instead of publishing it empty.
//
// Level 2 refuses the net series as well, and that refusal is the point of the
// level rather than an omission in it. The net balance series is already fetched
// here and would cost nothing to publish, but a net position that has not moved
// is exactly what hides both legs doubling — which is the reading level 2 exists
// to stop. So both debt analyses are per counterparty, from one new statement,
// at the full level only.

import {
 getDebtAccountIds,
} from '../db/overviewAccountRepository.js';
import {
 getDebtDomainFields,
 getMonthlyBalanceByAccount,
} from '../db/overviewBalanceRepository.js';
import { getDebtTransactionsPage } from '../db/overviewTransactionRepository.js';
import { makeDebtAnalysis } from '../core/makeDebtAnalysis.js';
import { readStockDomain } from './stockDomainCalculator.js';

const DEBT_DOMAIN = {
 domain: 'debt',
 getAccountIds: getDebtAccountIds,
 getTransactionsPage: getDebtTransactionsPage,
 publishesTrend: false,
 getDomainFields: getDebtDomainFields,
 // The one statement both level-2 debt analyses come from. Per counterparty per
 // month, so the ranking at the reference month and the two legs over the window
 // are folds of one result set rather than two reads that have to agree about
 // the same month.
 getAnalysisRows: getMonthlyBalanceByAccount,
 makeAnalysis: makeDebtAnalysis,
};

export const overviewDebtService = {
 /**
  * Everything GET /overview/debt returns, for one month and one page.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * @param {object} request - { window, page, pageSize, includeTransactionRows }
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} GetOverviewDomainData for domain 'debt'
  */
 async getDebtDomainData(pool, userId, request, timeZone = 'UTC') {
  return readStockDomain(pool, userId, request, timeZone, DEBT_DOMAIN);
 },
};
