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
 // How many distinct accounts hold an allocation greater than zero to any
 // pocket. The board's fold of the sourceCount each row above already carries,
 // and it cannot be derived here: summing the rows counts an account once per
 // pocket it funds.
 sourceAccountCount: number;
 // The furthest deadline on the board, YYYY-MM-DD on the OWNER's calendar, and
 // null when there are no pockets — the one nullable field here that is not an
 // amount. Same handling as the row's own desiredDate: never new Date() on it,
 // which reads UTC midnight and renders the previous day west of UTC.
 latestDesiredDate: string | null;
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

// ---------------------------------------------------------------------------
// The detail of one pocket.
//
// Measured against the service that answers it
// (backend/.../services/pocketDetailService.js:96-131). The same five shapes
// serve five endpoints, not one: create, edit, allocate and release all answer
// with this payload, so typing it once types every write's response too.
// ---------------------------------------------------------------------------

// The pocket itself, on its own screen.
//
// Every field of the board row EXCEPT the count of funding accounts, which the
// service deletes on purpose (pocketDetailService.js:123): the sources table
// below lists those accounts one by one, and a count beside the table would be
// a second answer to a question the rows already answer. Derived from the row
// type rather than restated, so a change to the row cannot leave the two
// disagreeing.
export type PocketDetailPocket = Omit<PocketStatus, 'sourceCount'>;

// One account funding this pocket.
//
// Four fields are nullable together, and the null is not "zero": it means the
// allocation ledger names an account the account read cannot resolve — one the
// owner soft-deleted, or the internal account the read filters out. What that
// account holds for this pocket is still real and still counted, so the row is
// served with the figures it has no answer for left null.
//
// An account whose net fell to zero after a full release is absent from this
// list entirely. It stopped contributing, and listing it would put a source on
// screen that holds nothing; the history keeps the trace of the one that left.
export type PocketSource = {
 accountId: number;
 accountName: string | null;
 accountType: string | null;
 // The instant the account was opened, which is the floor of what may be dated
 // onto it. null on an account the allocation read cannot resolve.
 accountStartDate: string | null;
 // What THIS account has committed to THIS pocket.
 heldByThisPocket: number;
 // What the account has committed across every pocket it funds.
 accountAllocated: number | null;
 accountBalance: number | null;
 // The balance minus everything committed. Never called "available": a pocket
 // blocks no spending, so this is the cash no plan has claimed yet.
 accountUnassignedCash: number | null;
 // The ACCOUNT's own state, not this pocket's share of it. False means the
 // account no longer covers everything committed to it. The missing amount
 // belongs to the account and is never split across the pockets drawing on it,
 // because any split would need a policy the app would have to invent.
 covered: boolean | null;
};

// One decision in the pocket's history.
//
// The sign is the decision: positive committed cash to the goal, negative
// released it back to the account's unassigned cash. Neither ever moved a
// balance, so the screen prints the word beside the sign — colour alone
// survives neither colour blindness nor print.
export type PocketAllocationEntry = {
 allocationId: number;
 amount: number;
 // YYYY-MM-DD on the OWNER's calendar. When the decision was taken, never when
 // the row was written: one agreed on Friday and typed on Monday is Friday's.
 allocationDate: string;
 // HH:MM off the same instant and the same zone, so two decisions taken on one
 // day are told apart. A label like the date above, never derived here: the
 // contract sends no instant to derive it from.
 allocationTime: string;
 sourceAccountId: number;
 sourceAccountName: string | null;
 // Audit metadata proving the conversion ran, never a second unit to do
 // arithmetic in.
 originalAmount: number;
 originalCurrency: CurrencyType;
 // Not an amount: it keeps the ten decimals of its column so the rate that
 // produced the stored figure can be re-applied and checked against it.
 exchangeRate: number;
 exchangeRateSource: string;
 exchangeRateTimestamp: string;
};

export type PocketDetailPayload = {
 pocket: PocketDetailPocket;
 sources: PocketSource[];
 history: PocketAllocationEntry[];
 meta: { notices: string[] };
};

export type PocketDetailResponse = {
 status: number;
 message: string;
 data: PocketDetailPayload;
};

// The body POST /pocket accepts, and nothing else: the schema behind it is
// strict, so an extra key is a 400 rather than a field the server ignores. The
// form used to send `type` and `user`, both of which that schema now rejects —
// identity comes from the token.
//
// note is omitted rather than sent empty: the column is nullable and an empty
// string is a note the user never wrote.
export type CreatePocketBody = {
 name: string;
 note?: string;
 targetAmount: number;
 currency: CurrencyType;
 // YYYY-MM-DD on the OWNER's calendar, never an instant. A Date sent over the
 // wire serialises to UTC, which is the previous day west of UTC for every
 // deadline typed in the evening.
 desiredDate: string;
};

// The body PATCH /pocket/:pocketId accepts. Every field is optional and the
// schema behind it is strict, so an extra key is a 400 and an empty body is a
// 400 too — at least one field must be sent.
//
// Two rules of that schema the caller has to respect, because neither is
// expressible in this type:
//
// - `note` is nullable AND optional, and the two mean different things. null
//   clears the note; an absent key leaves it as it was. Collapsing them would
//   make "remove this note" impossible to say.
// - `currency` is required whenever `targetAmount` is sent. The amount is a
//   figure typed in some unit, and a figure without its unit is not an amount;
//   the server converts and stores what it did.
//
// The pocket's own accounting currency is not editable. Restating it would
// restate every allocation already made against it.
export type EditPocketBody = {
 name?: string;
 note?: string | null;
 targetAmount?: number;
 currency?: CurrencyType;
 desiredDate?: string;
};

// What one account gets back when the pocket it was funding is deleted.
//
// The account is named and not just numbered, because this list is read by the
// owner and an id tells them nothing about where their cash went.
export type PocketFreedCash = {
 accountId: number;
 accountName: string;
 freedCash: number;
};

// The one write of this module that does NOT answer with the detail payload,
// and it could not: the screen that payload describes no longer exists.
//
// It answers with what the deletion released instead. Deleting a pocket moves
// no money — the cash was only ever committed, so it simply stops being
// committed — and this list is the same promise the confirmation made, kept in
// the server's own figures rather than recomputed by the screen.
//
// An empty list is a real answer and not a missing one: a pocket nothing was
// ever committed to frees nothing.
export type DeletePocketResult = {
 pocketId: number;
 name: string;
 freed: PocketFreedCash[];
};

export type DeletePocketResponse = {
 status: number;
 message: string;
 data: DeletePocketResult;
};

// The body both money endpoints accept, and they accept the same one: the
// schema behind them is a single strict object over these four keys, because
// committing and releasing are the same decision with opposite effect and the
// endpoint is the only thing that tells them apart.
//
// The amount is ALWAYS positive. The client never sends a sign — a release row
// is written negative on the server — so a minus in the field would be a second
// way to say a direction the URL has already said.
export type PocketAllocationBody = {
 sourceAccountId: number;
 amount: number;
 // The unit the amount was TYPED in, not the pocket's. The server converts and
 // records the rate it used.
 currency: CurrencyType;
 // YYYY-MM-DD on the OWNER's calendar. When the decision was taken, never when
 // the row was written: one agreed on Friday and typed on Monday is Friday's.
 // Omitted means today.
 allocationDate?: string;
};

// One account the owner may commit cash from.
//
// Served by the accounts-by-type read, which attaches the two pocket figures to
// every bank row. The three amounts are shown side by side on purpose, so that
// no single one of them can be read as "available": a pocket blocks no spending,
// so the available balance is still the whole balance, and the remainder is
// only the cash no plan has claimed.
//
// The two pocket figures are absent rather than zero when the allocation read
// could not answer for the row. A zero there would state that nothing is
// committed to an account nobody measured.
export type PocketEligibleAccount = {
 account_id: number;
 account_name: string;
 account_balance: number;
 // Snake case because this row comes from the account list endpoint, which
 // serves the column's own name. The floor of what may be dated onto it.
 account_start_date?: string;
 currency_code: CurrencyType;
 allocated?: number;
 unassignedCash?: number;
 isOverAllocated?: boolean;
};

export type PocketEligibleAccountsResponse = {
 status: number;
 message: string;
 data: {
  rows: number;
  accountList: PocketEligibleAccount[];
 };
};
