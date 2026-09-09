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

// Said when the prior month did not exist for this owner at all: the oldest
// account was opened during the reference month or later, so there is no earlier
// month to measure against. This is the case the catalog's I3/E3/D3/PL3 guard is
// actually about — "never compare against a period that did not exist" — and it
// is the only one that still withholds the figure.
export const NO_PRIOR_PERIOD_NOTICE =
 'There is no prior period to compare against, so no change is reported.';

// Said when the prior month existed but the owner did not own an account for the
// whole of it. Carlos, 2026-09-09: "lo que no hay es un mes previo completo (...)
// de todas maneras que aparezca la comparacion, asi sea parcial". So the delta is
// computed and this sentence travels with it, rather than the delta being
// suppressed: a partial baseline is a weaker comparison, not an absent one, and
// the reader is the one who decides how much weight it carries.
export const PARTIAL_PRIOR_PERIOD_NOTICE =
 'The oldest account was opened during the prior month, so the change is measured against a partial month.';

/**
 * The notice the coverage earns, as the array every card's notices list splices
 * in. One function and not a ternary at each call site, because five calculators
 * choosing their own sentence is how the same rule ends up worded three ways.
 *
 * @param {'complete'|'partial'|'none'} coverage
 * @returns {string[]} empty for a complete prior month
 */
export const priorPeriodNotices = (coverage) => {
 if (coverage === 'complete') return [];
 if (coverage === 'partial') return [PARTIAL_PRIOR_PERIOD_NOTICE];

 return [NO_PRIOR_PERIOD_NOTICE];
};

/**
 * How much of the prior month this owner actually existed for. Three answers and
 * not two, which is the correction of 2026-09-09.
 *
 * The rule is the account's age, not the presence of transactions: a month in
 * which the user owned an account and recorded nothing IS a period worth
 * comparing against, and reporting no delta for it would hide a real drop to
 * zero.
 *
 * - 'complete' — an account already existed when the prior month opened, the
 *                first day of it included: an account opened on the first was
 *                held for every day of that month.
 * - 'partial'  — the oldest account was opened DURING the prior month. The month
 *                exists and holds real rows; what it does not hold is a full
 *                month of them. Previously this returned false and the delta was
 *                suppressed, which told the reader "there is no prior month"
 *                while August sat on the screen with a figure in it.
 * - 'none'     — the oldest account was opened during the reference month or
 *                later, or there are no accounts. Comparing here would read as a
 *                rise from nothing, so nothing is reported.
 *
 * The comparisons are string comparisons and that is deliberate: oldestAccountDate
 * is 'YYYY-MM-DD' and both months are 'YYYY-MM-01', so lexical order is calendar
 * order and no Date is constructed in a server timezone that is not the owner's.
 *
 * @param {string|null} oldestAccountDate - 'YYYY-MM-DD', or null with no accounts
 * @param {string} priorMonth - 'YYYY-MM-01'
 * Exported because Investment needs the same three answers and cannot reach
 * them through makePeriodDelta: that builder searches a monthly series for the
 * two points it subtracts, and the investment card has no series - its figures
 * are accumulations read at one month's close. One rule, two callers, rather
 * than the same three comparisons written twice.
 *
 * @param {string} referenceMonth - 'YYYY-MM-01'
 * @returns {'complete'|'partial'|'none'}
 */
export const priorPeriodCoverageOf = (oldestAccountDate, priorMonth, referenceMonth) => {
 if (oldestAccountDate === null) return 'none';
 if (oldestAccountDate <= priorMonth) return 'complete';
 if (oldestAccountDate < referenceMonth) return 'partial';

 return 'none';
};

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
 * @returns {{currentPoint: object, priorTotalAmount: number|null, delta: number|null, priorPeriodCoverage: string}}
 */
export const makePeriodDelta = ({ months, referenceMonth, priorMonth, oldestAccountDate }) => {
 const currentPoint = months.find((entry) => entry.month === referenceMonth);
 const priorPoint = months.find((entry) => entry.month === priorMonth);
 const priorPeriodCoverage =
  priorPeriodCoverageOf(oldestAccountDate, priorMonth, referenceMonth);

 // priorPoint is inside the window for every request, since the window spans
 // several months and the delta reaches back one. The guard is on the calendar,
 // not on the row: a missing row would be a bug in the series, not a young
 // account.
 //
 // 'partial' computes the difference like 'complete' does. The two are told
 // apart by the coverage the card publishes and by the notice that travels with
 // it, not by withholding the figure — which is the whole of the 2026-09-09
 // correction. Only 'none' still resolves to null, and there the prior row is
 // generate_series' zero for a month the owner did not exist in.
 const isComparable = priorPeriodCoverage !== 'none' && Boolean(priorPoint);

 // The prior month's own figure, published rather than kept here. Carlos,
 // 2026-09-09, asked the card to show the change as a PERCENTAGE, and a
 // percentage needs a denominator: with only the difference on the wire the
 // client would have to invent one. It is the figure and not the percentage
 // that travels, because the percentage is a reading and the figure is a fact -
 // the server would have to decide what to answer when this is 0, which is a
 // presentation decision the card is better placed to make.
 //
 // Same nullity as delta, deliberately: the two describe one comparison, and a
 // card holding a baseline with no change measured against it would be a state
 // no consumer knows how to read.
 const priorTotalAmount = isComparable ? priorPoint.totalAmount : null;

 const delta = isComparable
  ? toAmount(money(currentPoint.totalAmount).minus(priorPoint.totalAmount))
  : null;

 return { currentPoint, priorTotalAmount, delta, priorPeriodCoverage };
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
 * @param {number|null} input.priorTotalAmount - the prior month's own figure, the
 *   denominator a percentage reading needs. Null exactly when delta is.
 * @param {number|null} input.delta - null only when no prior period exists at all
 * @param {'complete'|'partial'|'none'} [input.priorPeriodCoverage] - how much of
 *   the prior month the owner existed for. Defaults to 'complete', which is what
 *   a card that does not measure a delta at all should say rather than claiming
 *   a gap it never looked for.
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
 priorTotalAmount = null,
 delta,
 priorPeriodCoverage = 'complete',
 currency,
 window,
 notices = [],
 domainFields = {},
}) => Object.freeze({
 domain,
 totalAmount,
 transactionCount,
 // Before delta, because it is what delta was measured from. A reader going
 // down the object meets the baseline, then the change, then how much of the
 // baseline month the owner was there for.
 priorTotalAmount,
 delta,
 // Published beside the figure it qualifies, because the client cannot derive
 // it: with 'partial' the delta is a number like any other, and reading the
 // English of meta.notices to find out otherwise would tie the frontend to the
 // wording of a sentence.
 priorPeriodCoverage,
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
