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
 * 8 account-opening, 9 pnl, 10 account-closure, and 11 balance-reversal seeded
 * by 037_add_balance_reversal.sql. Only the eight this module reads are named
 * here; naming the other three would invent readers that do not exist.
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

/**
 * Every movement_type_name the catalog holds, in catalog order.
 *
 * The ids above are what statements select on; this is what a READER picks from.
 * The two are different jobs: an id is an argument to a predicate, a name is a
 * value a client sends and a schema validates, and a client that had to send 9
 * for a realised result would be holding the catalog in its head.
 *
 * A literal list and not a query, for the same reason OVERVIEW_DOMAINS is one:
 * a schema has to answer 400 for an unknown value at the door, before any
 * connection is opened, and a catalog read cannot run there.
 *
 * It is the whole catalog and not the eight this module's statements select on.
 * The activity list shows every movement the owner made, so a filter over it
 * has to be able to name every one of them - including the two the closing path
 * writes, which are exactly the rows an owner would go looking for.
 */
export const MOVEMENT_TYPE_NAMES = [
 'expense',
 'income',
 'investment',
 'debt',
 'pocket',
 'transfer',
 'receive',
 'account-opening',
 'pnl',
 'account-closure',
 'balance-reversal',
];

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

/**
 * The neutralisation of an account's balance so that it can be closed.
 *
 * An account whose type is in CLOSE_ZERO_BALANCE_TYPES (deleteAccountService.js
 * :68-73) can only be closed at zero, and the owner is offered one action for a
 * balance that blocks it: FinTrack posts -currentBalance and closes, in one
 * transaction. Two legs, one on the account and one on the compensation
 * account, both carrying this type and both naming the same account in
 * transactions.reversal_of_account_id.
 *
 * It is not capital the owner moved and it is not a result: read it beside the
 * closure settlement, in whatever term already answers for what the closing
 * path wrote.
 */
export const BALANCE_REVERSAL_MOVEMENT_TYPE_ID = 11;
