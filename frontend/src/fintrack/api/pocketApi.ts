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
import { PocketBoardResponse } from '../types/pocketTypes.ts';

// No arguments, and that is the contract: the board is every pocket the caller
// owns. There is nothing for a screen to name and therefore nothing it can name
// wrongly.
export const getPocketBoard = async (): Promise<PocketBoardResponse> => {
 const { data } = await authFetch<PocketBoardResponse>(url_pocket_board, {
  method: 'GET',
 });

 return data;
};
