// frontend/src/fintrack/helpers/transactionPresentation.ts
//
// What a transaction means from the perspective of the account being viewed,
// resolved from (movement_type, account_type, direction) rather than from the
// raw transaction_type string a component used to print as-is. The sign of
// the amount is correct today; only the label and colour built on top of it
// were wrong for a debtor account and duplicated for a category_budget one.
// See plan-docs/on-hold/PLAN_UX_SCREENS/TRANSACTION_ROW_PRESENTATION.md §9 for
// the frozen matrix and the code evidence behind every row below.

export type AccountType =
 | 'bank'
 | 'cash'
 | 'investment'
 | 'debtor'
 | 'pocket_saving'
 | 'category_budget'
 | 'income_source'
 | 'boundary';

export type MovementType =
 | 'expense'
 | 'income'
 | 'investment'
 | 'debt'
 | 'pocket'
 | 'transfer'
 | 'receive'
 | 'account-opening'
 | 'pnl'
 | 'account-closure'
 | 'balance-reversal';

export type Direction = 'in' | 'out';

export type BadgeColor = 'positive' | 'negative' | 'attention' | 'neutral';

export type TransactionPresentation = {
 badgeLabel: string;
 badgeColor: BadgeColor;
 displaySign: '+' | '-';
};

// Which way a movement moved the account. Coerced rather than type-tested: an
// amount can reach here as text, the way every DECIMAL column node-postgres
// serves does. A zero amount has no third state in the frozen matrix below
// and reads as 'in' by convention - the one caller that needs a visible zero
// state (AccountTransactionsList's colour) guards it before ever calling this.
export const resolveDirection = (amount: number | string): Direction => {
 const value = typeof amount === 'string' ? Number(amount) : amount;
 return Number.isFinite(value) && value < 0 ? 'out' : 'in';
};

type LegacyInput = {
 // Nested rather than a sibling of movementType/accountType: this is the
 // dependency of one branch below (the deferred one), not a fourth semantic
 // dimension. Reading it inside a frozen-matrix branch is the signal that
 // combination should be promoted into the matrix instead.
 transactionTypeName: string | null | undefined;
};

type ResolveTransactionPresentationInput = {
 movementType: string | null | undefined;
 accountType: string | null | undefined;
 amount: number | string;
 legacy: LegacyInput;
};

// Known catalog values with no frozen copy yet - reproduces exactly what
// every consumer already showed before this resolver existed: the raw
// transaction_type_name, coloured by the sign of the amount.
//
//  - pocket_saving: a subsystem of its own (pocketController.js), no
//    movement_type/transaction_type reference at all.
//  - income_source: the source leg of an income movement; no replacement copy
//    decided (plan §9, "diferido, sin copy congelado").
//  - boundary: the pnl compensation account; pnl already read the amount's
//    sign for its colour before this resolver existed, so legacy IS correct
//    here, not a placeholder for later.
const DEFERRED_ACCOUNT_TYPES: ReadonlySet<string> = new Set([
 'pocket_saving',
 'income_source',
 'boundary',
]);

// Known catalog values the frozen matrix does not model, verified against the
// code that would have to produce them:
//  - account-opening: every account's first transaction (getTransactionsForAccountById.js:239
//    comment) - reaches every one of the three migrated components, so it
//    cannot throw. The catalog's own transaction_type_name is not an entry or
//    an exit, and neither component before this resolver treated it as one.
//  - account-closure: recordClosureSettlement.js has had no caller since the
//    owner ruled CLOSE moves no money (2026-09-08); the type stays seeded for
//    a database with old rows.
//  - balance-reversal: live - deleteAccountService.js:1069 calls
//    recordBalanceReversal for RTA. Not in the frozen matrix because its
//    presentation is a decision for the deletion work, not this one; legacy
//    keeps its current, unbroken rendering until that decision is made.
//  - receive, investment (as a movement, not an account type): seeded and
//    unused (032_add_account_closure_movement_type.sql:15) - kept here rather
//    than thrown so re-enabling one degrades instead of crashing the modal.
const DEFERRED_MOVEMENT_TYPES: ReadonlySet<string> = new Set([
 'account-opening',
 'account-closure',
 'balance-reversal',
 'receive',
 'investment',
 'pnl',
]);

const LIQUIDITY_ACCOUNT_TYPES: ReadonlySet<string> = new Set([
 'bank',
 'cash',
 'investment',
]);

export const resolveTransactionPresentation = ({
 movementType,
 accountType,
 amount,
 legacy,
}: ResolveTransactionPresentationInput): TransactionPresentation => {
 const direction = resolveDirection(amount);
 const displaySign: '+' | '-' = direction === 'out' ? '-' : '+';

 // Deliberately deferred: known, real catalog values with no frozen
 // presentation yet. Checked first because both sets can pair with any
 // movement/account type on their own side of a two-leg transaction.
 const legacyPresentation = (): TransactionPresentation => ({
  badgeLabel: legacy.transactionTypeName?.toUpperCase() ?? '—',
  badgeColor: direction === 'out' ? 'negative' : 'positive',
  displaySign,
 });

 if (
  (accountType && DEFERRED_ACCOUNT_TYPES.has(accountType)) ||
  (movementType && DEFERRED_MOVEMENT_TYPES.has(movementType))
 ) {
  return legacyPresentation();
 }

 // ---- Frozen matrix, movement_type x account_type x direction ----

 if (movementType === 'expense') {
  if (direction === 'out') {
   return { badgeLabel: 'WITHDRAW', badgeColor: 'negative', displaySign };
  }
  if (accountType === 'category_budget') {
   return { badgeLabel: 'SPENT', badgeColor: 'neutral', displaySign };
  }
 }

 // transfer and pocket share one presentation: a category_budget leg is
 // always the expense-reversal refund (transfer never legitimately withdraws
 // FROM a category any other way), and a liquidity leg is the ordinary,
 // frozen bank<->investment/cash movement - unchanged because no defect was
 // reported there.
 if (movementType === 'transfer' || movementType === 'pocket') {
  if (accountType === 'category_budget' && direction === 'out') {
   return { badgeLabel: 'REFUNDED', badgeColor: 'positive', displaySign };
  }
  if (accountType && LIQUIDITY_ACCOUNT_TYPES.has(accountType)) {
   return direction === 'in'
    ? { badgeLabel: 'DEPOSIT', badgeColor: 'positive', displaySign }
    : { badgeLabel: 'WITHDRAW', badgeColor: 'negative', displaySign };
  }
 }

 if (movementType === 'debt') {
  if (accountType === 'debtor') {
   return direction === 'in'
    ? { badgeLabel: 'LENT', badgeColor: 'neutral', displaySign }
    : { badgeLabel: 'DEBT REDUCED', badgeColor: 'positive', displaySign };
  }
  if (accountType && LIQUIDITY_ACCOUNT_TYPES.has(accountType)) {
   return direction === 'out'
    ? { badgeLabel: 'LEND', badgeColor: 'negative', displaySign }
    : { badgeLabel: 'BORROW', badgeColor: 'positive', displaySign };
  }
 }

 if (
  movementType === 'income' &&
  direction === 'in' &&
  (accountType === 'bank' || accountType === 'cash')
 ) {
  return { badgeLabel: 'DEPOSIT', badgeColor: 'positive', displaySign };
 }

 // A combination neither the frozen matrix nor the deferred list accounts
 // for - logged rather than thrown, so a catalog value nobody modeled yet
 // degrades to the legacy presentation instead of crashing the modal that
 // renders it. A silent default was the defect this resolver was written to
 // remove; a silent CRASH would be worse, not better.
 console.error(
  `resolveTransactionPresentation: unmapped combination movementType=${String(
   movementType,
  )}, accountType=${String(accountType)}, direction=${direction}`,
 );
 return legacyPresentation();
};
