// backend/src/fintrack_api/services/overview_services/db/movementTypes.js
/**
 * The movement type ids this module's statements select on, by name.
 *
 * Why this exists. Eighteen statements across four repositories compared
 * movement_type_id against a bare integer. The number says nothing about which
 * movement it means, so a reader had to hold the catalog in their head to tell
 * an expense from a transfer, and a grep for one domain's rows returned every
 * statement that happened to use the same digit for a different purpose.
 *
 * The values are the movement_types catalog as measured on 2026-09-07:
 * 1 expense, 2 income, 3 investment, 4 debt, 5 pocket, 6 transfer, 7 receive,
 * 8 account-opening, 9 pnl, 10 account-closure. Only the seven this module reads
 * are named here; naming the other three would invent readers that do not exist.
 *
 * The two an account's ledger already defines are re-exported rather than
 * restated. Two constants holding the same number under one name is the
 * divergence this file exists to prevent, so there is one definition and this is
 * not it.
 */

import {
 ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID,
 ACCOUNT_OPENING_MOVEMENT_TYPE_ID,
} from '../../../../utils/fintrackUtils/accountDataRetrieval/derivedBalance.js';

export { ACCOUNT_CLOSURE_MOVEMENT_TYPE_ID, ACCOUNT_OPENING_MOVEMENT_TYPE_ID };

/** Money leaving the owner's accounts for a category. */
export const EXPENSE_MOVEMENT_TYPE_ID = 1;

/** Money arriving from an income source. */
export const INCOME_MOVEMENT_TYPE_ID = 2;

/** A debt leg, lent or borrowed, whose sign carries the direction. */
export const DEBT_MOVEMENT_TYPE_ID = 4;

/**
 * Money moved between two accounts the same owner holds.
 *
 * Read beside the expense type wherever a figure asks what left a bank account,
 * because a transfer out of it spends it as far as that account is concerned.
 */
export const TRANSFER_MOVEMENT_TYPE_ID = 6;

/**
 * A realised gain or loss.
 *
 * Carries three populations that only a description prefix separates: a real
 * result, an annulment pair written by the deletion path, and a closure
 * settlement. The type alone is not enough to read profit from.
 */
export const PNL_MOVEMENT_TYPE_ID = 9;
