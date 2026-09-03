// src/fintrack_api/services/overview_services/core/makeTrendSeries.js

// D18 — the six-month series behind a domain card's chart.
//
// It is not a second calculation. The points are the rows the monthly repository
// already returned for the card, relabelled: the last point of the trend and the
// card's totalAmount are the same figure read twice, which is the only
// arrangement in which they cannot disagree (§4.2).

/**
 * Turn the monthly rows into the contract's MonthlyTrendPoint[].
 *
 * The month is truncated to 'YYYY-MM' because that is what §12 publishes: a
 * trend point names a month, not a day, and sending 'YYYY-MM-01' would invite
 * the client to render the first of the month as if the figure belonged to it.
 *
 * Every month in the window is present with a real value, zero included. A month
 * with no spending is a flat month, and dropping it would bend the line between
 * the two months around it — the difference D18 draws against MS2/MS3, which do
 * exclude empty months because they answer "how much do I need in an ACTIVE
 * month".
 *
 * @param {Array<{month: string, totalAmount: number}>} months - ascending, no gaps
 * @returns {Array<{month: string, value: number}>}
 */
export const makeTrendSeries = (months) =>
 months.map((entry) => ({
  month: entry.month.slice(0, 7),
  value: entry.totalAmount,
 }));
