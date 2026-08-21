// src/fintrack_api/services/overview_services/services/overviewDebtService.js

// The Debt domain calculator behind GET /overview/debt.
//
// D1 is a net position, not a total owed: debtor balances are already signed —
// lending raises one, borrowing lowers it — so what the card publishes is what
// the user is owed minus what the user owes, in one figure. Splitting it into
// two would be a second formula for a number the ledger already keeps.
//
// No trend (§12). The catalog defines no monthly debt flow to draw a series
// from, and the field is absent rather than null for the same reason §6 omits
// return % instead of publishing it empty.

import {
 getDebtAccountIds,
} from '../db/overviewAccountRepository.js';
import { getDebtTransactionsPage } from '../db/overviewTransactionRepository.js';
import { readStockDomain } from './stockDomainCalculator.js';

const DEBT_DOMAIN = {
 domain: 'debt',
 getAccountIds: getDebtAccountIds,
 getTransactionsPage: getDebtTransactionsPage,
 publishesTrend: false,
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
