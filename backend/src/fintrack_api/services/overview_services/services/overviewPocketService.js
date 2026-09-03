// src/fintrack_api/services/overview_services/services/overviewPocketService.js

// The Pocket domain calculator behind GET /overview/pocket.
//
// P1 is the balance held across every pocket_saving account. The card is about
// those accounts in general; the per-goal view with its target and desired date
// is the Financial goals widget (§9), a different question about the same kind
// of account.
//
// The trend §12 grants this domain is a series of BALANCES, one per month end,
// not a series of monthly inflows. Two readings were possible and they are not
// interchangeable: a flow series would put "80 moved in" under a card that says
// "1,200 saved", two numbers on one card with no relation between them. The
// balance series ends exactly on the card's figure, which is the arrangement
// §4.2 asks for everywhere else in this module.
//
// It costs D18 nothing in substance. A month with no movement is still present
// and still carries a real number — the balance, unchanged — so the series has
// no gap and a flat month still looks flat. What it cannot be is 0, because a
// month in which the user saved nothing did not empty their pockets.

import {
 getPocketAccountIds,
} from '../db/overviewAccountRepository.js';
import { getPocketTransactionsPage } from '../db/overviewTransactionRepository.js';
import { readStockDomain } from './stockDomainCalculator.js';

const POCKET_DOMAIN = {
 domain: 'pocket',
 getAccountIds: getPocketAccountIds,
 getTransactionsPage: getPocketTransactionsPage,
 publishesTrend: true,
};

export const overviewPocketService = {
 /**
  * Everything GET /overview/pocket returns, for one month and one page.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * @param {object} request - { window, page, pageSize, includeTransactionRows }
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} GetOverviewDomainData for domain 'pocket'
  */
 async getPocketDomainData(pool, userId, request, timeZone = 'UTC') {
  return readStockDomain(pool, userId, request, timeZone, POCKET_DOMAIN);
 },
};
