// frontend/src/fintrack/api/pocketApi.ts
// The only way into /pocket from the frontend. The URL and the response type
// are stated once instead of once per component.
//
// It sits outside pages/ for the same reason budgetApi.ts does: the board, the
// row and the detail are in different trees, and a client living inside any one
// of them would make the others import from a page that is not their own.
//
// Errors are propagated untouched. Flattening them to a string is the right
// call at the point of display, not here.

import { authFetch } from '../../auth/auth_utils/authFetch.ts';
import {
 url_get_accounts_by_type,
 url_pocket_allocations,
 url_pocket_board,
 url_pocket_create,
 url_pocket_detail,
 url_pocket_releases,
} from '../../urlConfig.ts';
import {
 CreatePocketBody,
 DeletePocketResponse,
 DeletePocketResult,
 EditPocketBody,
 PocketAllocationBody,
 PocketEligibleAccount,
 PocketEligibleAccountsResponse,
 PocketBoardPayload,
 PocketBoardResponse,
 PocketDetailPayload,
 PocketDetailResponse,
} from '../types/pocketTypes.ts';

// No arguments, and that is the contract: the board is every pocket the caller
// owns. There is nothing for a screen to name and therefore nothing it can name
// wrongly.
//
// It returns the payload, not the envelope. The status and message of
// { status, message, data } are transport, and handing them to a store would
// make every consumer reach through a wrapper that says nothing about pockets.
// The double destructure is the two layers: axios wraps the HTTP body, and the
// API wraps its payload.
export const getPocketBoard = async (): Promise<PocketBoardPayload> => {
 const { data: body } = await authFetch<PocketBoardResponse>(url_pocket_board, {
  method: 'GET',
 });

 return body.data;
};

// One pocket and everything its screen shows.
//
// The parameter is named pocketId and typed, because the screen this feeds
// used to rename the route parameter to accountId and spend it against the
// account endpoints — which answered with another record entirely. Pocket ids
// and account ids are separate sequences that both start at 1, so the mistake
// had no symptom to catch it.
//
// A pocket that is not the caller's and a pocket id that does not exist both
// answer 403. The two are not told apart on purpose: separating them would let
// a caller walk the id space and learn which pockets belong to other users.
export const getPocketDetail = async (
 pocketId: number,
): Promise<PocketDetailPayload> => {
 const { data: body } = await authFetch<PocketDetailResponse>(
  url_pocket_detail(pocketId),
  { method: 'GET' },
 );

 return body.data;
};

// Creates a pocket and returns the screen that follows it.
//
// The response is the detail payload, not an id: the handler builds it because
// it has just written the row, so the caller can hand it to the detail store
// and navigate without a second request for something the server already said.
export const createPocket = async (
 body: CreatePocketBody,
): Promise<PocketDetailPayload> => {
 const { data: responseBody } = await authFetch<PocketDetailResponse>(
  url_pocket_create,
  { method: 'POST', data: body },
 );

 return responseBody.data;
};

// Changes a pocket and returns the whole screen it changed.
//
// It addresses the same URL the detail read does, and that is the point rather
// than an oversight: one pocket is one resource, and only the method differs.
// A second declaration for the same path would be two names that have to be
// kept equal by hand.
//
// The answer carries the recomputed figures, not the row written. A new target
// moves the gap and the monthly pace it implies, and that pace is the figure
// the owner is actually choosing — so the caller hands this straight to the
// detail store and the screen repaints with no second request.
export const editPocket = async (
 pocketId: number,
 body: EditPocketBody,
): Promise<PocketDetailPayload> => {
 const { data: responseBody } = await authFetch<PocketDetailResponse>(
  url_pocket_detail(pocketId),
  { method: 'PATCH', data: body },
 );

 return responseBody.data;
};

// Deletes a pocket and reports what it released.
//
// The one write here that does not answer with the detail payload, because the
// screen that payload describes has just stopped existing. It answers with the
// freed cash per account instead, which is the same promise the confirmation
// made — kept in the server's own figures rather than recomputed by a screen
// that would then be deriving the answer it was given.
//
// No money moves. The cash was only ever committed to a goal, so it simply
// stops being committed and returns to the account's unassigned cash.
export const deletePocket = async (
 pocketId: number,
): Promise<DeletePocketResult> => {
 const { data: responseBody } = await authFetch<DeletePocketResponse>(
  url_pocket_detail(pocketId),
  { method: 'DELETE' },
 );

 return responseBody.data;
};

// Commits cash from one account to one goal, and answers with the whole screen
// it changed.
//
// One decision moves the headline, the source breakdown and the history at
// once, so the response is the detail payload rather than the row written — a
// client handed the row would be deriving the other two from it, which is how a
// screen comes to disagree with itself.
//
// The amount goes out positive. The sign belongs to the endpoint, never to the
// payload.
export const allocateToPocket = async (
 pocketId: number,
 body: PocketAllocationBody,
): Promise<PocketDetailPayload> => {
 const { data: responseBody } = await authFetch<PocketDetailResponse>(
  url_pocket_allocations(pocketId),
  { method: 'POST', data: body },
 );

 return responseBody.data;
};

// Releases cash back to the account's unassigned cash. Same body, same positive
// amount, same answer; only the ceiling differs, and it is the server that
// applies it.
export const releaseFromPocket = async (
 pocketId: number,
 body: PocketAllocationBody,
): Promise<PocketDetailPayload> => {
 const { data: responseBody } = await authFetch<PocketDetailResponse>(
  url_pocket_releases(pocketId),
  { method: 'POST', data: body },
 );

 return responseBody.data;
};

// The accounts a commitment may draw on: banks, with what each has committed
// and what it has left uncommitted attached by the read itself.
//
// Only banks. No route creates a cash account, and the figure means nothing on
// an investment balance that is a market valuation nor on a debtor — so a wider
// request would return rows the picker would have to filter out again, and rows
// whose two pocket figures the server deliberately withholds.
export const getPocketSourceAccounts = async (): Promise<
 PocketEligibleAccount[]
> => {
 const { data: responseBody } =
  await authFetch<PocketEligibleAccountsResponse>(
   `${url_get_accounts_by_type}/?type=bank`,
   { method: 'GET' },
  );

 return responseBody.data.accountList;
};
