// src/fintrack_api/services/overview_services/services/overviewDebtService.js

// The Debt domain calculator behind GET /overview/debt.
//
// D1 is a net position, not a total owed: debtor balances are already signed —
// lending raises one, borrowing lowers it — so the figure the card publishes is
// what the user is owed minus what the user owes.
//
// That figure alone is insufficient, which is what D39 decided: a net of -550
// does not distinguish "owes 550" from "is owed 1,750 and owes 2,300", and the
// two call for opposite decisions. So the card also publishes the position's two
// legs as positive magnitudes, under the names the screen already gives them:
// receivable and payable (DebtsLayout.tsx:44,48). "you owe" / "you're owed" is
// not a pair of figures — it is the label the sign of the net picks at :66, and
// the view keeps deriving it from the sign of totalAmount.
//
// This is not the second formula an earlier version of this comment warned
// against. The legs are read from the same balances, over the same account set,
// at the same close (§5.1): the account dimension is simply kept until the sign
// has been read instead of being summed away first. totalAmount still comes from
// getMonthlyBalance and is never recomputed from the legs — and when the two
// reads fail to add up, the calculator says so rather than letting the card
// publish three numbers that do not reconcile.
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
 // §5.1. Pocket inherits false: a pocket balance has no second side to split.
 publishesLegs: true,
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
