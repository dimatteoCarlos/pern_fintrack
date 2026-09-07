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
