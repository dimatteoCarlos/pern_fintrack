// backend/src/utils/fintrackUtils/transactionManagement/activityFilters.js

// Moved out of overview_services/db/overviewPageRepository.js so a module
// outside overview_services (the export report) can read the same predicate
// the Overview activity list and teaser already agree on, without importing
// overview_services to get it.

// What counts as a movement in this section, written once.
//
// The teaser the page carries and the paged endpoint answer the same question
// over the same rows; they differ in their bounds and in how much they return.
// A predicate written twice would be two definitions of a movement for one
// section, and the two would be free to drift.
//
// $1 is the owner. No other placeholder appears here on purpose: the statements
// that embed this number their own parameters differently, and a filter
// carrying one of them could only be pasted into the statement it was written
// for.
export const ACTIVITY_FILTER = `
  -- The owner and the type are read off account_registry, which holds every
  -- account open or closed. CLOSE deletes the user_accounts row, so reading
  -- ua.user_id and the type joined through ua dropped every movement of a closed
  -- account from the list (both came back NULL), while the domain totals kept it.
  WHERE ar.user_id = $1
    -- IS DISTINCT FROM and not <>: the registry's type is ON DELETE SET NULL, and
    -- a NULL type is not a boundary account.
    AND COALESCE(ua.account_type_id, ar.account_type_id) IS DISTINCT FROM (
      SELECT account_type_id FROM account_types WHERE account_type_name = 'boundary'
    )`;

// The reader's own two narrowings, written once for the page and for the count
// that has to answer over the same set. They are NOT part of ACTIVITY_FILTER:
// that one says what counts as a movement in this section and the teaser shares
// it, and a teaser that narrowed itself by a search nobody typed would answer a
// different question from the one it is asked.
//
// Both are optional and a null one drops out of the statement rather than
// widening to a wildcard the client could send.
//
// $5 is the term and $6 the movement type, and they are numbered BEFORE the page
// bounds rather than appended after them. PostgreSQL refuses a bind list longer
// than the highest placeholder a statement names, so a search parameter sitting
// at $7 could not be reached by the count statement at all - the count binds
// neither LIMIT nor OFFSET.
export const ACTIVITY_READER_FILTER = `
    -- strpos over lower() and not ILIKE. With ILIKE the term's own % and _ are
    -- wildcards, so a reader looking for "50%" would match every row in the
    -- account, and an owner searching "credit_card" would match "credit-card"
    -- too. Neither is a search; both are the pattern language leaking into the
    -- text box.
    --
    -- The column is the WHOLE description and not the note the row displays.
    -- That is a superset on purpose: the half this does not show on screen is
    -- the sentence the server narrates ("Transaction: ... from X to Y"), which
    -- is exactly where an owner looks for a counterparty they cannot remember
    -- typing. extractNoteFromDescription splits the two for display and this
    -- searches both.
    AND (
      $5::text IS NULL
      OR strpos(lower(tr.description), lower($5::text)) > 0
      OR strpos(lower(COALESCE(ua.account_name, ar.account_name, '')), lower($5::text)) > 0
    )
    -- By NAME and not by id. The id is what the statements of this module select
    -- on; the name is what a client can send without holding the catalog in its
    -- head, and the schema has already refused anything outside it.
    AND ($6::text IS NULL OR mt.movement_type_name = $6::text)`;

// Newest first, and the id breaks the tie. Two movements can carry the same
// actual date, and a page boundary falling between them would show one row
// twice and skip another without the second key.
export const ACTIVITY_ORDER = `
  ORDER BY tr.transaction_actual_date DESC, tr.transaction_id DESC`;
