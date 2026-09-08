// src/fintrack_api/services/overview_services/core/makeIncomeAnalysis.js

// The level-2 section of the Income domain.
//
// Three analyses and one of them is free. The thirteen-month series is the same
// monthly rows the card was already built from, read over the long bound of the
// window instead of the short one — one statement serving two lengths, so the
// six-point chart and the thirteen-point one cannot disagree about a month they
// both contain.
//
// The other two are one statement and its arithmetic. Concentration is NOT a
// second division: it is the share the ranked rows already carry, read off the
// first of them, because a ratio computed twice at two scales prints two numbers
// for one fact on one screen.

import { makeDistribution } from './makeDistribution.js';
import { makeTrendSeries } from './makeTrendSeries.js';

// Said when the month has no income at all. The distribution is absent rather
// than empty: empty says the owner has sources and none of them moved, absent
// says there is nothing to distribute.
export const NO_INCOME_IN_PERIOD_NOTICE =
 'No income was received in this period, so it is not broken down by source.';

// Said when a row's source account cannot be resolved. source_account_id is
// nullable (003_transactions.sql:49), so an income written without it is real
// money with no attributable origin — it is reported as its own part rather
// than dropped, because dropping it would make the parts fail to sum to the
// card's total.
export const UNATTRIBUTED_INCOME_NOTICE =
 'Some income in this period names no source account and is reported as unattributed.';

/**
 * Build the frozen income analysis.
 *
 * bySource and concentration are absent together, in the two cases where the
 * question has no answer: the level did not ask for the statement, or the month
 * received nothing. Absent and not null, for §6's reason — a null field invites
 * a client to ask why it is blank.
 *
 * @param {object} input
 * @param {string} input.level - the requested depth
 * @param {Array<{month: string, totalAmount: number}>} input.months - the long series
 * @param {number} input.totalAmount - the card's figure, which the shares are taken against
 * @param {Array<{accountId: number|null, accountName: string|null, amount: number}>} [input.sources]
 * @returns {object} frozen analysis section
 */
export const makeIncomeAnalysis = ({ level, months, totalAmount, sources }) => {
 const notices = [];

 // Absent when the statement was not run at all, which is what the derived
 // level means. An empty array here would be a claim about the owner's sources
 // that no query was asked to make.
 let bySource;
 let concentration;

 if (sources !== undefined) {
  if (sources.length === 0) {
   notices.push(NO_INCOME_IN_PERIOD_NOTICE);
  } else {
   if (sources.some((source) => source.accountId === null)) {
    notices.push(UNATTRIBUTED_INCOME_NOTICE);
   }

   bySource = makeDistribution(
    sources.map((source) => ({
     accountId: source.accountId,
     accountName: source.accountName,
     // The label the ranking breaks ties on. An unattributed part has no name,
     // so it sorts under the empty string — deterministic, which is all the tie
     // break owes.
     label: source.accountName ?? '',
     amount: source.amount,
    })),
    totalAmount,
   );

   // The largest source's share, read and never recomputed. It is null exactly
   // when the shares are — a month whose income sums to zero — and the notice
   // §4.1 asks for is the one already pushed above when there is nothing at all.
   concentration = bySource[0].share;
  }
 }

 return Object.freeze({
  domain: 'income',
  level,
  // Whole, and thirteen points rather than six: the reference month is the
  // figure being judged and the twelve before it are what it is judged against.
  series: Object.freeze(makeTrendSeries(months)),
  ...(bySource === undefined ? {} : { bySource: Object.freeze(bySource) }),
  ...(concentration === undefined ? {} : { concentration }),
  meta: Object.freeze({ notices: Object.freeze(notices) }),
 });
};
