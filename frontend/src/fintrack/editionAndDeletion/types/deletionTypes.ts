//frontend/src/editionAndDeletion/types/deletionTypes.ts
//ImpactReportRow, RTAExecutionPayload, DeletionSuccessData

import { FetchResponseType as UseFetchResponseType } from '../../hooks/useFetch';
import { FetchResponseType as UseFetchLoadResponseType } from '../../hooks/useFetchLoad';

// ------------------------
//  API STRUCTURES DATA
// ------------------------
//RTA FINANCIAL IMPACT REPORT - REPRESENT ROWS OF REPORT TABLE

//from accountDeleteController.js
/**
const impactReport: {
 affectedAccountId: any;
 affectedAccountName: any;
 affectedAccountCurrentBalance: number;
 affectedAccountNetAdjustmentAmount: number;
 affectedAccountCurrencyId: any;
 affectedAccountCurrencyCode: any;
}[]
 */

export type ImpactReportRowType = {
  affectedAccountId: number;
  affectedAccountName: string;
  affectedAccountType: string;
  affectedAccountCurrentBalance: number;
  affectedAccountNetAdjustmentAmount: number;
  affectedAccountCurrencyId: number; //not necessary
  affectedAccountCurrencyCode: string;
};

// ONE ROW OF THE CLOSE SCREEN'S RELATED-ACCOUNTS PANEL, which is not a
// narrower ImpactReportRowType above. That row carries a projection - what
// annulling this account would leave on the counterparty - and CLOSE settles
// nothing, so every one of those figures is zero. This row carries facts that
// hold whichever method runs: an account this one has operated with, how many
// movements they share, and the date of the most recent one.
//
// Balance is absent deliberately, on the owner's decision of 2026-09-08: the
// current balance of an account this one once transacted with has no causal
// link to the close, and showing it beside one implies there is.
export type RelatedAccountRowType = {
  accountId: number;
  accountName: string;
  accountTypeName: string;
  interactionCount: number;
  // TIMESTAMPTZ folded by MAX() on the server, so it reaches here as an ISO
  // instant and is formatted in the reader's own zone, not in UTC. The UTC
  // calendar day and the owner's disagree for any movement recorded late in
  // the evening, which is when a lot of them are.
  lastInteractionDate: string;
};

// Pockets that lose backing if this account is deleted (getPocketAllocationImpact,
// POCKET_MODULE_SPEC.md §11.1 Q8b) - preview only, shown before confirmation.
export type PocketImpactRowType = {
  pocketId: number;
  pocketName: string;
  amountAllocated: number;
  currencyCode: string;
};

//PAYLOD SENT TO BACKEND FOR DELETE ACCOUNT EXECUTION
//Define the format  of the request(req.body) expected by executeAccountDeletion controller

export type RTAExecutionPayloadType = {
  deletionType: 'RTA' | 'HARD' | 'SOFT';
  targetAccountName: string;
};

/** Structure of a successful response when obtaining the impact report (GET). */
//get the data structure from getAnnulmentImpactReport (accountAnnulmentService) processed by generateImpactReport in key report from data.
// export type RTAImpactReportDataType ={
//  targetAccountName:string;
//  targetAccountId: number;
//  impactReport: ImpactReportRowType[];
//  deletionType: 'RTA';
// }

/** Structure of a successful response when executing the account deletion*/
//success answer of deleteAccountService
/*
/RTA_SUCCESS_RESPONSE - Respuesta exitosa estandarizada
return {
  status: messages.rtaSuccess.status,
  message: messages.rtaSuccess.messagefn(targetAccountName, targetAccountId, impactReport.length),
  data: {
   deletedAccountId: targetAccountId,
    action: rtaResult.actionType,
    accountsCorrected: rtaResult.adjustedAccounts,
    deletionType: DELETION_TYPE_RTA,
    finalSlackBalance: rtaResult.finalSlackBalance,
    timestamp: new Date().toISOString() 
  }
};
*/

export type DeletionSuccessDataType = {
  deletedAccountId: number;
  action: string;
  accountsCorrected: number;
  deletionType: string;
  finalSlackBalance: number;
  timestamp: string;
  message: string;
};
// ---------------------------------
// 2. 🔌 API RESPONSE REPORT CONTAINER TYPE
// ---------------------------------
/** * Type reflecting the standard API wrapper response for the RTA Impact Report (GET).
 * It represents the full JSON object returned by the server.
 */
export type ReportResponseType = {
  status: number;
  message: string;
  data: {
    impactReport: ImpactReportRowType[];
    // Folded by the server, never in the browser. The component summed the
    // rows itself until the payload carried this, and its sum was short by
    // unattributedAmount below - the one figure no row holds.
    totalNetAdjustmentAmount: number;
    pocketImpact: PocketImpactRowType[];
    // The close screen's panel. Same population as impactReport - both are
    // built from the same CTE on the server - asked a different question.
    relatedAccounts: RelatedAccountRowType[];
    // Activity of the account being deleted that no live account can be
    // credited with, because an earlier deletion already reversed it. Shown
    // beside the total, never added to it: the annulment does not act on it.
    unattributedAmount: number;
    unattributedTransactionCount: number;
    targetAccountId: number | string; // ID of the account being deleted
    affectedAccountsCount: number;
  };
};
// -----------------------------------
//2. FETCH AND AUTH HOOKS TYPES
// -----------------------------------
/** Type for the automatic fetch hook (GET), expecting the full API container. */
export type ReportFetchHookType = UseFetchResponseType<ReportResponseType>;

/** Type of hook for execution of deletion*/
export type DeletionLoadHookType = UseFetchLoadResponseType<
  DeletionSuccessDataType,
  RTAExecutionPayloadType
>;

// TYPES OF ACCOUNT DELETION METHODS SENT TO BACKEND
export const DELETION_TYPE_RTA = 'RTA';

// SOFT and HARD, alongside RTA above rather than replacing it
// (ACCOUNT_DELETION_METHODS.md §6). Both read their method from the DELETE
// request's query string (accountDeleteController.js#executeAccountDeletion
// L96: `req.query.type || req.body.deletionType`), never from an
// RTA-shaped impact report.
export const DELETION_TYPE_SOFT = 'SOFT';
export const DELETION_TYPE_HARD = 'HARD';

export type StandardDeletionMethodType =
  | typeof DELETION_TYPE_SOFT
  | typeof DELETION_TYPE_HARD;

// CLOSE, alongside the three above rather than replacing any of them
// (accountDeleteController.js:27 declares the same literal server-side).
//
// It is NOT a StandardDeletionMethodType and must not be added to that union:
// SOFT and HARD read their method from the query string and carry no required
// body, while CLOSE requires closeReason in the body. Widening the union would
// let useStandardAccountDeletion be instantiated with CLOSE and send a request
// the service refuses with 400.
export const DELETION_TYPE_CLOSE = 'CLOSE';

// What the DELETE body must carry for CLOSE. closeReason is mandatory, and the
// schema is what makes it so rather than the screen: migration 035's
// chk_close_reason_accompanies_closure refuses a closure stamp with no reason
// and refuses one made only of whitespace, so the service raises 400 before it
// takes its lock.
export type CloseExecutionPayloadType = {
  deletionType: typeof DELETION_TYPE_CLOSE;
  closeReason: string;
  // Whether to neutralise the balance against the compensation account before
  // the close, in the server's same transaction. Absent means no, and the
  // server compares against true rather than coercing, so an absent field and
  // an explicit false mean the same thing.
  reverseBalance?: boolean;
};

// The identity half of GET /account/delete/close_preview/:targetAccountId.
//
// residual is TEXT, not a number, and stays text through the whole screen: the
// server sends the balance as the driver handed it over so nothing rounds it
// in transit. Parse it only to compare against zero, never to render.
export type ClosePreviewAccountType = {
  accountId: number;
  accountName: string;
  accountTypeName: string;
  currencyCode: string;
  residual: string;
};

// The full preview response. destinations and destinationCount are still in
// the payload and always answer empty: they belonged to the TRANSFER
// settlement, retired 2026-09-08, and the keys were kept rather than removed
// so a screen deployed against the older backend reads an empty list instead
// of undefined. Nothing here should render them.
export type ClosePreviewResponseType = {
  status: number;
  message: string;
  data: {
    targetAccountId: number;
    targetAccount: ClosePreviewAccountType;
    destinations: never[];
    destinationCount: number;
  };
};

// What the close returns. Distinct from StandardDeletionSuccessDataType
// because the fields differ: a close reports what it gave back before the row
// went away, which SOFT and HARD have no equivalent of.
export type CloseSuccessDataType = {
  deletedAccountId: number | string;
  closeReason: string;
  closingBalance: string;
  registryClosedAt: string;
  releasedPockets: { pocketId: number | string; amount: number | string }[];
  budgetTerminatedAt: string | null;
  extensionRowsDeleted: number;
};

export type CloseDeletionResponseType = {
  status: number;
  message: string;
  data: CloseSuccessDataType;
};

// Payload for the SOFT/HARD execution call. The backend does not require a
// body for either (the method comes from the query string), but the
// discriminant is carried anyway so the request self-documents at the type
// level, the same way RTAExecutionPayloadType does above.
export type StandardExecutionPayloadType = {
  deletionType: StandardDeletionMethodType;
};

// What processStandardDelete actually returns (deleteAccountService.js
// L688-699) for SOFT/HARD - no impactReport, accountsCorrected or
// finalSlackBalance: those three exist only on the RTA branch, so this is a
// separate type rather than a reuse of DeletionSuccessDataType.
export type StandardDeletionSuccessDataType = {
  deletedAccountId: number | string;
  action: string; // 'USER_ACTION' | 'ADMIN_ACTION'
  deletionType: StandardDeletionMethodType;
  timestamp: string;
};

// The full response wrapper the controller actually sends
// (accountDeleteController.js L144: `res.status(...).json(serviceResult)`,
// serviceResult = { status, message, data }). Named separately from
// DeletionSuccessDataType above because that type reads the RTA payload's
// `data.*` fields as if they were top-level next to `message` - a pre-existing
// mismatch, out of scope here (see FOUND in the retrofit report).
export type StandardDeletionResponseType = {
  status: number;
  message: string;
  data: StandardDeletionSuccessDataType;
};

// -----------------------------------
//ACCOUNT DELETION PAGE
// -----------------------------------
//UI AccountDeletionPage: MODAL TYPES DEFINITION
//StatusTypes:Define all the possible states of the modal
export type ModalStatusType = 'idle' | 'executing' | 'success' | 'error';
