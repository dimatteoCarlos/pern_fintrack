// src/fintrack_api/services/overview_services/core/makeDomainCard.js

// The DomainCardBase of §5 — the shape Income, Expense, Debt, Pocket and PnL
// share — and the rule behind the one field of it that can be absent.
//
// It lives apart from any single domain because §5 declares it once. Written
// into each calculator instead, one contract rule would have five copies, and
// D21 already showed what that costs: a counting rule stated in two places
// disagreed with itself for as long as nobody read them side by side.
//
// Investment does not come through here (§6). Its five figures are not a total,
// a count and a delta, so forcing them into this shape would lose information
// rather than share it.

import { money, toAmount } from '../../budget_services/core/money.js';

// Said when the card has no complete prior period to compare against — the
// guard the catalog states for I3/E3/D3/PL3 as "never compare against a period
// that did not exist".
export const NO_PRIOR_PERIOD_NOTICE =
 'There is no complete prior period to compare against, so the change against it is not reported.';

/**
 * Whether a full prior month existed to compare this one against.
 *
 * The rule is the account's age, not the presence of transactions: a month in
 * which the user owned an account and recorded nothing IS a complete period
 * worth comparing against, and reporting no delta for it would hide a real drop
 * to zero. What must never happen is a comparison against a month the user did
 * not yet exist for, which would read as a rise from nothing.
 *
 * A user with no accounts resolves to false for the same reason: there is no
 * prior period, not a prior period of zero.
 */
const hasCompletePriorPeriod = (oldestAccountDate, priorMonth) =>
 oldestAccountDate !== null && oldestAccountDate < priorMonth;

/**
 * The reference month read off the series, and its change against the month
 * before it.
 *
 * Both come back from one call because §4.2 asks for it: the figure on the card
 * and the figure the delta was measured from have to be the same read of the
 * same row. Searching the series twice, once here and once in the caller, is
 * two reads that a later edit can pull apart.
 *
 * @param {object} input
 * @param {Array<{month: string, totalAmount: number, transactionCount: number}>} input.months
 * @param {string} input.referenceMonth - 'YYYY-MM-01', always present in months
 * @param {string} input.priorMonth - 'YYYY-MM-01'
 * @param {string|null} input.oldestAccountDate - 'YYYY-MM-DD', or null
 * @returns {{currentPoint: object, delta: number|null, canCompare: boolean}}
 */
export const makePeriodDelta = ({ months, referenceMonth, priorMonth, oldestAccountDate }) => {
 const currentPoint = months.find((entry) => entry.month === referenceMonth);
 const priorPoint = months.find((entry) => entry.month === priorMonth);
 const canCompare = hasCompletePriorPeriod(oldestAccountDate, priorMonth);

 // priorPoint is inside the window for every request, since the window spans
 // several months and the delta reaches back one. The guard is on the calendar,
 // not on the row: a missing row would be a bug in the series, not a young
 // account.
 const delta = canCompare && priorPoint
  ? toAmount(money(currentPoint.totalAmount).minus(priorPoint.totalAmount))
  : null;

 return { currentPoint, delta, canCompare };
};

/**
 * Build a frozen DomainCardBase, with whatever fields the domain adds to it.
 *
 * domainFields is placed between delta and currency so the object reads in the
 * order §5 declares: the three shared figures, then the domain's own, then the
 * envelope every card carries. A card that spread its extras after meta would
 * still be correct and would still be harder to compare against the contract.
 *
 * @param {object} input
 * @param {string} input.domain - one of the six of §3
 * @param {number} input.totalAmount - never null: 0 is real activity at zero
 * @param {number} input.transactionCount - the rows totalAmount is made of (D21)
 * @param {number|null} input.delta - null when no complete prior period exists
 * @param {string} input.currency
 * @param {{periodStart: string, periodEnd: string}} input.window
 * @param {string[]} [input.notices]
 * @param {object} [input.domainFields] - the fields this domain adds to the base
 * @returns {object} frozen card
 */
export const makeDomainCard = ({
 domain,
 totalAmount,
 transactionCount,
 delta,
 currency,
 window,
 notices = [],
 domainFields = {},
}) => Object.freeze({
 domain,
 totalAmount,
 transactionCount,
 delta,
 ...domainFields,
 currency,
 window,
 // Always an object with an array in it, never absent and never a bare string:
 // a caller that iterates needs no null check, and the shape does not change
 // the day a second notice appears. provenance is null until D7's accounting
 // and display currencies can diverge — the field is reserved now so the
 // contract does not break on the day they do.
 meta: Object.freeze({
  notices: Object.freeze([...notices]),
  provenance: null,
 }),
});
