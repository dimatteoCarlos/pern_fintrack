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
 affectedAccountName : string;
 affectedAccountType:string;
 affectedAccountCurrentBalance:number;
 affectedAccountNetAdjustmentAmount:number;
 affectedAccountCurrencyId:number;//not necessary
 affectedAccountCurrencyCode:string
}

//PAYLOD SENT TO BACKEND FOR DELETE ACCOUNT EXECUTION
//Define the format  of the request(req.body) expected by executeAccountDeletion controller

export type RTAExecutionPayloadType= {
  deletionType: 'RTA' | 'HARD' | 'SOFT';
  impactReport: ImpactReportRowType[];
  targetAccountName: string;
}

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

export type DeletionSuccessDataType= {
  deletedAccountId: number;
  action: string;
  accountsCorrected: number;
  deletionType: string;
  finalSlackBalance: number;
  timestamp: string;
  message:string;
}
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
 targetAccountId: number|string; // ID of the account being deleted
 affectedAccountsCount: number;
 };
};
// -----------------------------------
//2. FETCH AND AUTH HOOKS TYPES
// -----------------------------------
/** Type for the automatic fetch hook (GET), expecting the full API container. */
export type ReportFetchHookType = UseFetchResponseType<ReportResponseType>;

/** Type of hook for execution of deletion*/
export type DeletionLoadHookType = UseFetchLoadResponseType<DeletionSuccessDataType, RTAExecutionPayloadType>;

// TYPES OF ACCOUNT DELETION METHODS SENT TO BACKEND
export const DELETION_TYPE_RTA = 'RTA';

// -----------------------------------
//ACCOUNT DELETION PAGE
// -----------------------------------
//UI AccountDeletionPage: MODAL TYPES DEFINITION
//StatusTypes:Define all the possible states of the modal
export type ModalStatusType = 'idle'| 'executing' | 'success'|'error';


