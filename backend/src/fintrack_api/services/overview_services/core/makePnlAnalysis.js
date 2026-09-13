// src/fintrack_api/services/overview_services/core/makePnlAnalysis.js

// The level-2 section of the realized P/L domain, and it adds no statement.
//
// The card publishes no series at level 1 (§12) because the catalog defines no
// monthly P/L flow for one, and the months are fetched anyway — the delta needs
// the prior month read off the same rows the reference month came from. Level 2
// is where that fetch stops being thrown away: a series over the long bound of
// the window, from the statement the delta already ran.
//
// The decomposition is the other half of a field the card added and left
// incomplete on purpose. The card says how much of the month's realised result
// landed on investment accounts and refuses the remainder as a second field,
// because a figure a client obtains by subtracting two published numbers is not
// one the server owes it. That refusal is a rule about a CARD. A decomposition
// is the level-2 shape, so here the two parts are named and published together
// and neither is left to a client's subtraction.

import { money, toAmount } from '../../budget_services/core/money.js';
import { makeTrendSeries } from './makeTrendSeries.js';

/**
 * Build the frozen profit-and-loss analysis.
 *
 * Both parts are always present and both may be negative, which is the whole
 * difference between this decomposition and an expense one: a losing month is a
 * loss, not an absent figure, and a part that is 0 is a real answer rather than
 * a withheld one. So there is no notice and no null branch here — the terms
 * exist for every owner, including one who has never traded.
 *
 * investment and bank are each a FILTER over exactly the rows the total summed.
 * other is what is left - debtor, pocket and any other non-boundary account -
 * and is stated rather than derived downstream, so the three parts partition
 * the card's totalAmount by construction and no client subtracts.
 *
 * @param {object} input
 * @param {string} input.level - the requested depth
 * @param {Array<{month: string, totalAmount: number}>} input.months - the long series
 * @param {number} input.totalAmount - PL1 over every account except the counterparty
 * @param {number} input.realizedFromInvestment - the part of it on investment accounts
 * @param {number} input.realizedFromBank - the part of it on bank and cash accounts
 * @returns {object} frozen analysis section
 */
export const makePnlAnalysis = ({
 level,
 months,
 totalAmount,
 realizedFromInvestment,
 realizedFromBank,
}) =>
 Object.freeze({
  domain: 'pnl',
  level,
  series: Object.freeze(makeTrendSeries(months)),
  byAccountType: Object.freeze({
   investment: realizedFromInvestment,
   bank: realizedFromBank,
   other: toAmount(
    money(totalAmount).minus(realizedFromInvestment).minus(realizedFromBank),
   ),
  }),
  meta: Object.freeze({ notices: Object.freeze([]) }),
 });
