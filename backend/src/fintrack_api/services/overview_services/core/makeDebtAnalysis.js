// src/fintrack_api/services/overview_services/core/makeDebtAnalysis.js

// The level-2 section of the Debt domain, and the one domain whose derived level
// publishes nothing.
//
// That is a ruling and not an omission. The card's figure is a NET position, and
// the monthly balance series behind it is already fetched — so a net series
// would be free here. §4.5 refuses it in as many words: a net position that has
// not moved can hide both legs doubling, and level 2's job in this domain is
// precisely to separate them. Publishing the free figure would answer the
// question level 2 exists to stop answering.
//
// So both analyses need the same new statement, and they are built from ONE
// statement on purpose. The per-account closing balances at every month of the
// window carry both: the reference month's rows are the counterparty ranking,
// and the same rows folded by sign per month are the two legs over time. A
// second statement for the second analysis would let the ranking's largest
// debtor disagree with the last point of the series it appears in.

import { money, toAmount } from '../../budget_services/core/money.js';

// Said when the owner has no debt of either direction. Absent rather than empty:
// empty says the debtors exist and all sit at zero, which is a settled book and
// a different fact from having no debtors.
export const NO_DEBT_NOTICE =
 'There is no debt in either direction, so it is not broken down by counterparty.';

// Said at the derived level, where this domain publishes nothing. A section
// carrying only its own name reads as a failure; the sentence says it is a
// consequence of the depth requested and names the one that answers.
export const ANALYSIS_NEEDS_FULL_NOTICE =
 'Both debt analyses need a statement of their own and are only served at the full analysis level.';

// What a counterparty's balance means, named rather than left to the sign.
//
// The card's own legs are positive magnitudes because the field name carries the
// direction; a row here has one field for the amount and several rows of
// opposite signs, so the direction has to travel beside it. A client rendering
// "you owe" and "you're owed" from the sign of a number is the derivation §6
// keeps taking off the client.
export const OWED_TO_USER = 'receivable';
export const OWED_BY_USER = 'payable';
export const SETTLED = 'settled';

const directionOf = (balance) => {
 if (balance > 0) return OWED_TO_USER;
 if (balance < 0) return OWED_BY_USER;
 return SETTLED;
};

/**
 * Fold the per-account monthly balances into the two legs of each month.
 *
 * Both legs come out as POSITIVE MAGNITUDES, the same convention the card's own
 * legs follow, so a reader plotting the two series never has to flip one of
 * them. An account at exactly zero enters neither leg and contributes 0 to both.
 *
 * A month in which the owner had no debtor at all reports 0 on both legs rather
 * than disappearing. The series is drawn over the window's months, and a missing
 * month bends the line between its neighbours — the falsehood D18 forbids for
 * every series in this module.
 *
 * @param {Array<{month: string, accountId: number, accountName: string, balance: number}>} rows
 * @param {string[]} months - every month of the window, ascending, as 'YYYY-MM-01'
 * @returns {Array<{month: string, receivable: number, payable: number}>}
 */
const foldLegs = (rows, months) => {
 const legs = new Map(months.map((month) => [month, { receivable: money(0), payable: money(0) }]));

 rows.forEach((row) => {
  const entry = legs.get(row.month);
  // A row outside the requested months cannot arrive from the statement, which
  // generates its months from the same bounds. Guarded anyway because the fold
  // would otherwise throw on a shape change rather than report one.
  if (!entry) return;

  if (row.balance > 0) {
   entry.receivable = entry.receivable.plus(row.balance);
  } else if (row.balance < 0) {
   entry.payable = entry.payable.plus(-row.balance);
  }
 });

 return months.map((month) => {
  const entry = legs.get(month);
  return {
   month: month.slice(0, 7),
   receivable: toAmount(entry.receivable),
   payable: toAmount(entry.payable),
  };
 });
};

/**
 * Build the frozen debt analysis.
 *
 * byCounterparty is ordered by MAGNITUDE and not by signed value, which is what
 * "largest first" means for a list holding both directions: the biggest thing
 * the owner owes and the biggest thing they are owed both belong at the top, and
 * a signed sort would bury every debt under every credit. The name breaks the
 * tie, so two counterparties at the same magnitude cannot swap between two
 * identical requests.
 *
 * A counterparty settled at exactly zero stays in the list. It is a debtor with
 * a history whose balance came back to nothing, which is the outcome the card's
 * own settled count already reports as a figure worth having.
 *
 * @param {object} input
 * @param {string} input.level - the requested depth
 * @param {Array<{month: string, accountId: number, accountName: string, balance: number}>} [input.balances]
 * @param {string[]} [input.months] - every month of the window, ascending
 * @param {string} [input.referenceMonth] - which of those months the ranking is taken at
 * @returns {object} frozen analysis section
 */
export const makeDebtAnalysis = ({ level, balances, months, referenceMonth }) => {
 const notices = [];

 let byCounterparty;
 let legsOverTime;

 if (balances === undefined) {
  notices.push(ANALYSIS_NEEDS_FULL_NOTICE);
 } else if (balances.length === 0) {
  notices.push(NO_DEBT_NOTICE);
 } else {
  // filter first, which is also what keeps the sort off the caller's array: the
  // rows arrive from the repository and sorting them in place would reorder the
  // set the legs are folded from.
  byCounterparty = balances
   .filter((row) => row.month === referenceMonth)
   .sort((a, b) => {
    const difference = Math.abs(b.balance) - Math.abs(a.balance);
    return difference !== 0 ? difference : a.accountName.localeCompare(b.accountName);
   })
   .map((row, index) => ({
    accountId: row.accountId,
    accountName: row.accountName,
    balance: row.balance,
    direction: directionOf(row.balance),
    rank: index + 1,
   }));

  legsOverTime = foldLegs(balances, months);
 }

 return Object.freeze({
  domain: 'debt',
  level,
  ...(byCounterparty === undefined
   ? {}
   : { byCounterparty: Object.freeze(byCounterparty) }),
  ...(legsOverTime === undefined ? {} : { legsOverTime: Object.freeze(legsOverTime) }),
  meta: Object.freeze({ notices: Object.freeze(notices) }),
 });
};
