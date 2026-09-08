// frontend/src/fintrack/editionAndDeletion/config/deletionMethodPolicy.ts
//
// Which deletion methods the account deletion screen offers.

// The owner's instruction of 2026-09-08: the screen offers one method, and the
// method is CLOSE. It had been offering four - the RTA annulment the page led
// with, plus deactivate, close and erase - which is what he was looking at
// when he said only CLOSE is contemplated.
//
// A flag rather than deleted markup, for two reasons. The RTA annulment, the
// reversible deactivation and the erasure are all reachable services with
// their own routes and their own request paths; only their entry point on this
// screen is withdrawn, and a flag says that while a deletion would claim the
// services went too. And turning it back on is one edit rather than a
// recovery from history.
//
// WHAT IT DOES NOT DO. It changes no service, no route and no request. The
// three withdrawn methods answer the same as they did to any other caller.
export const CLOSE_IS_THE_ONLY_METHOD = true;
