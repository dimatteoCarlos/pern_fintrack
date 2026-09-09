// src/fintrack_api/services/overview_services/services/overviewActivityService.js

// The Activity section behind GET /overview/activity.
//
// The one section of this module whose period the READER chooses. Every other
// figure is bound to the reference month the page is reporting; activity answers
// what do I want to read, which the reference month cannot express — a person
// studying last August still wants to know what happened yesterday.
//
// It computes nothing. There is no total, no count of a domain and no currency
// at the list level: a movement already carries its own (D7), and a sum over
// rows of six domains would be an addition of expenses to income.
//
// Why a service at all, over one repository call. The controller talks to
// services and never to repositories, so the day this section grows a rule —
// a cap on how far back the range may reach, a notice when it is truncated —
// there is a place for it that is not the handler.

import { getActivityPage } from '../db/overviewPageRepository.js';

export const overviewActivityService = {
 /**
  * Everything GET /overview/activity returns, for one range and one page.
  *
  * The range is echoed back rather than left for the client to remember. An
  * unbounded read is the default, so a response that named no range would leave
  * a client unable to tell an unbounded answer from the one it asked for.
  *
  * @param {object} pool - Database pool
  * @param {string} userId - UUID from the token, never from the client body
  * @param {object} request - { from, to, search, movementType, page, pageSize },
  *   already validated
  * @param {string} timeZone - IANA zone of the account owner
  * @returns {Promise<object>} the rows, the page and the range they came from
  */
 async getActivity(
  pool,
  userId,
  { from, to, search, movementType, page, pageSize },
  timeZone = 'UTC',
 ) {
  const { rows, totalRows } = await getActivityPage(
   pool,
   userId,
   {
    from: from ?? null,
    to: to ?? null,
    search: search ?? null,
    movementType: movementType ?? null,
   },
   timeZone,
   { page, pageSize },
  );

  return {
   transactions: {
    rows,
    page,
    pageSize,
    totalRows,
   },
   // null and not an omitted key: absent would read as a field this section
   // does not have, and this section does have a range — the reader simply did
   // not bound that end of it.
   range: {
    from: from ?? null,
    to: to ?? null,
   },
   // Echoed for the same reason the range is. A list of five rows out of two
   // thousand is not a short list, it is a filtered one, and a client that had
   // to remember what it asked for could not tell the reader which of the two
   // it is looking at — least of all after a reload that restored the query
   // from the address bar.
   filters: {
    search: search ?? null,
    movementType: movementType ?? null,
   },
  };
 },
};
