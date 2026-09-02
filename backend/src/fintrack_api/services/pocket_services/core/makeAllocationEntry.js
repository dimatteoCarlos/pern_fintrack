// backend/src/fintrack_api/services/pocket_services/core/makeAllocationEntry.js

// One row of a pocket's history: one decision, and what was typed to make it.
//
// The sign is the decision. A positive row committed money to the goal, a
// negative row released it back to the account's unassigned cash, and neither
// ever moved a balance. The screen prints the word beside the sign, because
// colour alone survives neither colour blindness nor print.

import { toAmount, money } from '../../budget_services/core/money.js';

/**
 * Build one allocation history entry.
 *
 * The date is when the decision was taken, not when the row was written, and it
 * arrives already resolved onto the owner's calendar as a YYYY-MM-DD label. A
 * TIMESTAMPTZ crossing the driver becomes a Date at the node process's local
 * midnight, and a client doing new Date('2026-08-01') reads UTC midnight, which
 * renders as July west of UTC. Neither happens to a label.
 *
 * The time of day is a second label off the same instant and the same zone, for
 * the same reason: two decisions taken on one day are told apart by it, and a
 * client that had to derive it would be deriving it from a Date this contract
 * deliberately never sends.
 *
 * originalAmount and its currency are audit metadata, never a second unit to do
 * arithmetic in: they exist so the conversion can be shown and re-checked.
 *
 * @param {object} row
 * @returns {Readonly<object>}
 */
export function makeAllocationEntry({
 allocationId,
 amount,
 allocationDate,
 allocationTime,
 sourceAccountId,
 sourceAccountName,
 originalAmount,
 originalCurrency,
 exchangeRate,
 exchangeRateSource,
 exchangeRateTimestamp,
}) {
 return Object.freeze({
  // BIGSERIAL crosses the pg driver as a string so nothing is lost on a value
  // JavaScript could not hold. Allocation ids stay far below that bound, and the
  // client compares them as numbers.
  allocationId: Number(allocationId),
  amount: toAmount(amount),
  allocationDate,
  allocationTime,
  sourceAccountId,
  sourceAccountName,
  originalAmount: toAmount(originalAmount),
  originalCurrency,
  // Not an amount: it keeps the ten decimals of its column, so a rate that
  // produced the stored figure can be re-applied and checked against it.
  exchangeRate: money(exchangeRate).toNumber(),
  exchangeRateSource,
  exchangeRateTimestamp,
 });
}
