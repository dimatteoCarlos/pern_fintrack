// frontend/src/fintrack/editionAndDeletion/types/closedAccountsTypes.ts

// THE CLOSED-ACCOUNT LIST IS NOT AN ACCOUNT LIST, and every nullable field
// below says why. These rows come from `account_registry`, not from
// `user_accounts`: the close operation deletes the account row, so what is left
// is a record of something that happened, whose catalog references are allowed
// to have gone stale. A row for an account erased before the registry existed
// carries a name of null and nothing else, which is the oldest half of the
// history and the half an inner join would have thrown away.

// One closure, as the registry stamped it.
export type ClosedAccountRowType = {
  accountId: number;
  // Null on a row for an account erased before the registry existed. Render it
  // as an explicit "not recorded", never as an empty cell.
  accountName: string | null;
  // Null when the type catalog row it referenced was removed: the stamp is
  // ON DELETE SET NULL.
  accountTypeName: string | null;
  currencyCode: string | null;
  // TEXT, not a number, for the same reason every amount in this module is:
  // nothing rounds it in transit.
  accountStartingAmount: string | null;
  accountStartDate: string | null;
  accountCreatedAt: string | null;
  // category_budget only. Neither part may be recovered by splitting
  // accountName: migration 013 trimmed the name and the subcategory in two
  // separate statements, so an account exists whose name and whose parts
  // disagree.
  categoryName: string | null;
  subcategory: string | null;
  categoryNatureTypeName: string | null;
  // Never null on a row this endpoint returns: the query filters on
  // `closed_at IS NOT NULL`, which is what makes a registry row a CLOSURE
  // rather than an open account's record.
  closedAt: string;
  // Never null either, and the database is what guarantees it: migration 035's
  // chk_close_reason_accompanies_closure refuses a closure stamp with no reason
  // and refuses one made only of whitespace.
  closeReason: string;
};

// The sort keys the endpoint accepts. Written out rather than inferred so the
// dropdown and the server's whitelist cannot drift: a key absent from the
// server's map is silently replaced by its default, which reads on screen as a
// sort control that does nothing.
export const CLOSED_ACCOUNT_SORT_KEYS = [
  'closed_at',
  'account_name',
  'account_type_name',
  'account_created_at',
] as const;

export type ClosedAccountSortKeyType =
  (typeof CLOSED_ACCOUNT_SORT_KEYS)[number];

export type ClosedAccountOrderType = 'asc' | 'desc';

// What the owner has chosen in the toolbar, in one object. Held together rather
// than as four independent states because every one of them resets the page to
// 1, and four setters that each have to remember that is four places to forget.
export type ClosedAccountQueryType = {
  search: string;
  type: string;
  sort: ClosedAccountSortKeyType;
  order: ClosedAccountOrderType;
  page: number;
  limit: number;
};

// One page, plus the figures a pager needs. The server echoes back the search,
// type, sort and order it actually applied, which is not always what was asked:
// an unparseable page or an unknown sort key falls back rather than raising, so
// a stray value in a shared link shows the first page instead of an error.
export type ClosedAccountsDataType = {
  rows: number;
  total: number;
  page: number;
  limit: number;
  pageCount: number;
  sort: string;
  order: string;
  search: string;
  type: string;
  accountList: ClosedAccountRowType[];
};

export type ClosedAccountsResponseType = {
  status: number;
  message: string;
  data: ClosedAccountsDataType;
};
