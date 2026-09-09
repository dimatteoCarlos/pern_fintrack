// backend/src/utils/fintrackUtils/accountDeletionUtils/annulmentRowIdentity.js
//
// WHAT IDENTIFIES AN ANNULMENT ROW AFTER THE ACCOUNT IS GONE. The RTA
// annulment writes its pair into transactions and the account it was written
// for is deleted in the same operation, so nothing structural survives to say
// what those rows are. This prefix, written into transactions.description, is
// what identifies them, and it is read far outside this module.
//
// IT LIVES HERE RATHER THAN IN THE WRITER because a value that read paths
// depend on should not be reachable only through the module that produces it.
// Three read-only repositories were importing recordAnnulmentTransaction.js -
// a writer, with a currency-catalog dependency inside it - to obtain a string.
//
// A TEXT PREFIX IS NOT A COLUMN, and this is the reason the balance reversal
// did not get one. transactions.description is ordinary text with no
// constraint on it, so this identity holds only while nothing rewrites the
// column; reversal_of_account_id, added by migration 037, is a key the
// database itself enforces. Nothing new should be identified this way.
//
// FIVE predicates read it, and they do not all point the same way (counted
// 2026-09-07 after pern-fintrack-cf found the earlier comment had drifted). Two
// exclusions in overviewTransactionRepository.js, one in
// overviewMonthlyRepository.js, and in overviewInvestmentRepository.js a PAIR
// that splits on this string: realised profit excludes the prefixed rows and
// the closure adjustment includes them. The earlier wording said four and
// described them all as NOT LIKE, which hid the positive one - the filter most
// likely to be missed, since it is the only one that would start summing
// nothing rather than summing too much.
//
// The count is the fragile part of this comment, not the list: a filter added
// in the overview module lands in a file this module does not own and nothing
// here fails.
export const RTA_ANNULMENT_TARGET_PREFIX = 'RTA Annulment Target(';
