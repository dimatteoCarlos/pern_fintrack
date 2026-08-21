// frontend/src/fintrack/types/pocketTypes.ts
// Response contract of the /pocket module, written against POCKET_INDICATORS §5.
// That section was frozen before these screens read it: when this file and the
// server disagree, the server is what has to change.
//
// Currency codes are lowercase here — 'usd', not 'USD' — because that is what
// the endpoint serves. CurrencyType is already a lowercase union, and a type
// written from an uppercase example would never match a single response.

import { CurrencyType, DesiredDateSourceType } from './types.ts';

// One pocket on the board.
//
// The pace fields — runRate, requiredMonthly, projectedDate, status — are NOT
// declared yet. They need the transaction history and are not served, and a
// field typed as `number | null` before it exists cannot be told apart from one
// the server withheld on purpose.
export type PocketStatus = {
 accountId: number;
 accountName: string;
 // Nullable column. A pocket with no note renders a dash, not an empty line.
 note: string | null;
 // Nullable column: a pocket is allowed to have no goal. null is not 0 — a
 // pocket with no goal has nothing to be short of.
 target: number | null;
 // user_accounts.account_balance, NOT NULL. Negative when the pocket was drawn
 // below its opening amount.
 saved: number;
 // 0–100, not a ratio. null when target is null or 0: there is no percentage of
 // zero, and 0 would announce that nothing has been saved.
 progress: number | null;
 // target - saved. Negative when the goal was passed, null when there is none.
 remaining: number | null;
 // YYYY-MM-DD on the OWNER's calendar, never an ISO instant. new Date() on one
 // of these is UTC midnight and renders as the previous day west of UTC, so
 // every label below is built from the parts instead.
 desiredDate: string;
 // 'default' means the controller invented this deadline because the caller
 // sent none. Nothing derived from it may render as a figure the user asked for.
 desiredDateSource: DesiredDateSourceType;
 startDate: string;
 currency: CurrencyType;
};

// The header figures, folded by the server from the rows above so no component
// adds amounts up.
//
// Every amount is nullable and each null has a reason: the board is empty, or
// it mixes currencies and the module refuses to add them at an implicit 1:1.
// Neither of those is an amount of zero.
export type PocketBoardSummary = {
 totalSaved: number | null;
 totalTarget: number | null;
 // null when no pocket carries a goal — there is nothing to remain of.
 totalRemaining: number | null;
 // 0–100, null on the same condition as totalRemaining.
 overallProgress: number | null;
 // null when the board is empty, and null when it mixes currencies. The two are
 // told apart by pocketCount, which is why it travels.
 currency: CurrencyType | null;
 pocketCount: number;
};

export type PocketBoardResponse = {
 status: number;
 message: string;
 data: {
  summary: PocketBoardSummary;
  pockets: PocketStatus[];
  // Why the totals read as dashes, in the server's own words. Empty, never
  // absent.
  meta: { notices: string[] };
 };
};
