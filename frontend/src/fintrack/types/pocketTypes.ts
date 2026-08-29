// frontend/src/fintrack/types/pocketTypes.ts
// Response contract of the /pocket module.
//
// Rewritten 2026-08-29 against the server that actually answers. The previous
// version described the retired model — a pocket as an account, with
// accountId, accountName and a figure called `saved` — and the board rendered
// against it produced links to `pockets/undefined`, blank card titles and one
// React key shared by every row. Three of the eight names it destructured did
// not exist in the payload.
//
// Measured field by field against the row builder
// (backend/.../core/makePocketStatus.js:109-131) and the header fold
// (services/pocketBoardService.js:99-160). Where this file and the server
// disagree, the server is right: it is the one being called.
//
// Currency codes are lowercase — 'usd', not 'USD' — because that is what the
// endpoint serves, and the row builder throws on anything else.

import { CurrencyType } from './types.ts';

// One pocket on the board.
//
// Nothing here is clamped, and that is deliberate at the level of one pocket:
// a negative `remaining` means over-funded by that amount, which is a fact and
// not an error. The card prints the excess as its own line. Only the header
// totals clamp before summing.
export type PocketStatus = {
 pocketId: number;
 name: string;
 // Nullable column. A pocket with no note renders a dash, never an empty line
 // — and never '', which would be a note the user wrote and then cleared.
 note: string | null;
 // Required and positive: the creation validator refuses anything else
 // (pocketValidators.js:77). A pocket without a goal is not a pocket in this
 // model, so this is not nullable and neither is `progress` below.
 target: number;
 // What the funding accounts have committed to this pocket. Never called
 // `saved`: the money has not moved and nothing was set aside.
 allocated: number;
 // target - allocated. Negative when the goal was passed.
 remaining: number;
 // 0-100, and above 100 when over-funded. Not a ratio, and not clamped.
 progress: number;
 // YYYY-MM-DD on the OWNER's calendar, never an ISO instant. new Date() on one
 // of these is UTC midnight and renders as the previous day west of UTC, so
 // every label is built from the parts instead.
 desiredDate: string;
 // Negative once the deadline has passed.
 daysRemaining: number;
 // The only nullable figure on the row, and the null has a meaning the caller
 // must respect: the deadline passed, so there is no monthly pace to state. It
 // is 0 — not null — when the pocket is already funded.
 requiredMonthly: number | null;
 funded: boolean;
 overdue: boolean;
 // How many distinct accounts fund this pocket.
 sourceCount: number;
 currency: CurrencyType;
 // The funding accounts no longer hold what this pocket says they committed.
 // Folded by the server across accounts, so no component can derive it.
 uncovered: boolean;
};

// The header figures, folded by the server from the rows above so no component
// adds amounts up.
//
// Every amount is nullable and each null has a reason: the board is empty, or
// it mixes currencies and the module refuses to add them at an implicit 1:1.
// Neither of those is an amount of zero. The counts are never null — they are
// answerable on any board, including an empty one.
export type PocketBoardSummary = {
 totalAllocated: number | null;
 totalTarget: number | null;
 // What is still short of the goals, summed over the pockets that are short.
 totalRemaining: number | null;
 // What is committed past the goals, summed over the pockets that passed them.
 // Kept apart from the shortfall on purpose: netting them would let one
 // over-funded pocket hide another that is behind.
 totalExcess: number | null;
 // 0-100. Clamped per pocket before folding, unlike the per-row figure.
 overallProgress: number | null;
 // null when the board is empty, and null when it mixes currencies. The two
 // are told apart by pocketCount, which is why it travels.
 currency: CurrencyType | null;
 pocketCount: number;
 fundedCount: number;
 overdueCount: number;
 uncoveredCount: number;
};

// What the endpoint answers, inside the envelope every route of this API wraps
// its payload in.
export type PocketBoardPayload = {
 summary: PocketBoardSummary;
 pockets: PocketStatus[];
 // Why the totals read as dashes, in the server's own words. Empty, never
 // absent.
 meta: { notices: string[] };
};

export type PocketBoardResponse = {
 status: number;
 message: string;
 data: PocketBoardPayload;
};
