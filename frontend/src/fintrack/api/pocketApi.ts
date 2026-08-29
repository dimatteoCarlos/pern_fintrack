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
import { url_pocket_board } from '../../urlConfig.ts';
import { PocketBoardPayload, PocketBoardResponse } from '../types/pocketTypes.ts';

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
