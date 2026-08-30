//frontend/src/editionAndDeletion/constants/languages.ts/
/*


*/

//Dictionary for account deletion Modal UI components

//type definition and constants
const languageOptions = ['en','es'] as const

// "indexed access types" de ts: extrae todos los tipos posibles que podrías obtener si accedieras a un índice numérico de ese array. Define la unión de todos los tipos literales posibles contenidos dentro del array; se define automáticamente como la unión literal 'en' | 'es'.
export type LanguageKeyType = typeof languageOptions[number] //indexed access type

//"type guard function": to verify if a string belongs to the defined types.
export function isLanguageTypeValid(lang:string):lang is LanguageKeyType {
 return languageOptions.includes(lang as LanguageKeyType)

 /*
// Datos externos, no confiables
if (isLanguageTypeValid(languageFromUrl)) {
  // ¡Aquí es seguro! TypeScript sabe que languageFromUrl es 'en' | 'es'
  setAppLanguage(languageFromUrl);
} else {
  // Aquí es solo un string genérico, manejamos el error o usamos un valor predeterminado
  setAppLanguage('en');
}
 */
}
//----
export type DictionaryDataType ={
 //AccountDeletionPage
 pageTitle: string;

 //AccountDetailsUI.tsx
 accountDetailsTitle: string;
 accountIdLabel: string;
 accountNameLabel: string;
 actionLabel: string;
 accountTypeLabel: string;
 accountBalanceLabel: string;
 rtaDeletionAction: string;
 
 pendingDeletionStatus:string;

 reportErrorTitle: string;
 reportErrorMessage: string;
 proceedToDeletionButton: string;
 finalSuccessTitle: string;

 title: string;
 description: string;
 affectedAccounts: string;
 willBeAdjusted: string;
 processing: string;
 apiError: string;
 clickToConfirm: string;
 cancel: string;
 confirmDeletion: string;
 confirmHardDelete: string;
 language: string;
 accountsImpacted: string;
 loading: string;

//StatusModalUI
 successTitle:string;
 errorTitle:string;
 closeButton:string;

//idle status confirmation title
 idleStatusConfirmationTitle:string;

//LoadingReportUI
 loadingReportText:string;
//impact report titles
reportTitleNoImpact:string;
reportTitleWithImpact:string;

//NoImpactReportUI
 noImpactTitle: string;
 noImpactMessage: string;
 
 //ImpactReportUI
 impactDetectedTitle: string;
 impactDetectedMessage: string;
 tableOfAffectedAccountsDetails:string;
 affectedAccountColumn: string;
 affectedAccountTypeColumn:string,
 currentBalanceColumn: string;
 netAdjustmentColumn: string;
 newBalanceColumn: string;
 totalNetAdjustment: string; 

 //account types for ImpactReportUI
 income_source:string;
 category_budget:string;
 debtor:string;
 investment:string;
 bank:string;

 //auto close in
 autoCloseIn:string;

// 🎯 POST OPERATION VIEW KEYS
 postOperationSuccessTitle: string;
 postOperationSuccessSubtitle: string;
 postOperationErrorTitle: string;
 postOperationErrorSubtitle: string;
 operationIdLabel: string;
 deletedAccountLabel: string;
 operationTimeLabel: string;
 adjustmentResultsTitle: string;
 affectedAccountsCount: string;
 resultsTableNote: string;
 defaultSuccessMessage: string;
 nextStepsTitle: string;
 contactAdminInstruction: string;
 provideErrorIdInstruction: string;
 tryAgainLaterInstruction: string;
 accountLabel: string;
 errorTimeLabel: string;
 backToActionsButton: string;
 
 } 

//Default Language
export const defaultLanguage:LanguageKeyType='en';

//Function to Get texts according to Lang / Función para obtener textos según idioma
export const getLangText = (lang:LanguageKeyType, key:keyof DictionaryDataType):string => {
 return languages[lang]?.[key] || languages[defaultLanguage][key] || key;
};

//Data Language Dictionary
export const languages:Record<LanguageKeyType,DictionaryDataType> = {

 en:{
//AccountDeletionPage.tsx
pageTitle: "Deletion and Account Annulment",//(RTA)

//AccountDetailsUI.tsx
accountDetailsTitle: "Target Account Details (Deletion)",
 accountIdLabel: "ID:",
 accountNameLabel: "Name:",
 accountTypeLabel: "Type: ",
 accountBalanceLabel:'Balance: ',
 actionLabel:"Action: ",
 rtaDeletionAction: "RTA Deletion (Annulment with adjustment)",
 pendingDeletionStatus:"Pending deletion - Awaiting confirmation",

 // loadingReportText: "Loading RTA Impact Report...",
 reportErrorTitle: "Error Loading Report:",
 reportErrorMessage: "Cannot proceed with annulment.",// without knowing financial impact.",
 proceedToDeletionButton: "Proceed to Deletion",
 finalSuccessTitle: "Success!",

//Titles and headers
title:'Confirm Account Deletion',
description:'You are about to initiate the Retrospective Total Annulment (RTA) deletion method for this account. ', 
affectedAccounts:'account(s) will be adjusted.', 
willBeAdjusted:'will be adjusted.',

//States and messages
processing:'Processing annulment...',
apiError: "⚠️ **API Error:**",
clickToConfirm:'Click Confirm to continue the annulment.',

//Buttons 
cancel: 'Cancel',
//getConfirmButtonText 
confirmDeletion:'Confirm Deletion with financial adjustments (RTA)', 
confirmHardDelete:'Confirm Hard Deletion',

language:'Language',

//Additional texts
accountsImpacted:'accounts impacted.',
loading:'Loading...',

//StatusModalUI
successTitle:'Annulment Completed!',
errorTitle:'Deletion Error', 
closeButton:'Close', 

//idle status confirmation title
 idleStatusConfirmationTitle:'Need Your Confirmation',

//LoadingReportUI
loadingReportText:'Loading RTA Deletion Method Impact Report...',
//impact report titles
reportTitleNoImpact:"Impact Report: No Accounts Affected",
reportTitleWithImpact:"Impact on Affected Accounts",

//ImpactReportUI
 noImpactTitle: 'No Financial Impact!',
 noImpactMessage: 'No affected accounts found. Proceeding with **Hard Delete**.',
 impactDetectedTitle: '⚠️ Impact Detected: {count} Affected Accounts',
 impactDetectedMessage: 'The annulment will automatically adjust balances to maintain financial consistency.',
 tableOfAffectedAccountsDetails:'Financial impact details on related accounts',
 /* 
 Table showing financial impact analysis of affected accounts with current balances, required adjustments, and new estimated balances',
 */
 affectedAccountColumn: 'Account',//Affected Account
 affectedAccountTypeColumn:'Type',
 currentBalanceColumn: 'Current Balance',
 netAdjustmentColumn: 'Net Adjustment',
 newBalanceColumn: 'New Balance',
 totalNetAdjustment: 'Total Net Adjustment:',

 //account type in ImpactReportUI
 income_source:'Income',
 category_budget:"Expense",
 debtor:"Debtor/Lender",
 investment:"Investment",
 bank:"Bank",

 //auto close in
 autoCloseIn:'Auto Close in ',

// 🎯 POST OPERATION VIEW - ENGLISH
 postOperationSuccessTitle: "RTA Deletion Completed Successfully",
  postOperationSuccessSubtitle: "Account {targetAccountName} has been deleted",
  postOperationErrorTitle: "RTA Deletion Failed", 
  postOperationErrorSubtitle: "Could not delete account {targetAccountName}",
  operationIdLabel: "Operation ID",
  deletedAccountLabel: "Deleted Account",
  operationTimeLabel: "Operation Time",
  adjustmentResultsTitle: "Financial Adjustments Results",
  affectedAccountsCount: "Affected Accounts",
  resultsTableNote: "The affected accounts have been automatically adjusted to maintain financial consistency.",
  defaultSuccessMessage: "The RTA annulment has been completed successfully. All affected accounts have been adjusted.",
  nextStepsTitle: "Next Steps",
  contactAdminInstruction: "Contact the application administrator",
  provideErrorIdInstruction: "Provide the error details for investigation",
  tryAgainLaterInstruction: "Try again later or use a different method",
  accountLabel: "Account",
  errorTimeLabel: "Error Time",
  backToActionsButton: "Back to Accounting Dashboard",


 }
 , 

 es:{
//AccountDeletionPage
pageTitle: "Eliminación de Cuenta y Ajuste de Balances", //(ART)

//AccountDetailsUI.tsx
accountDetailsTitle: "Detalles de la Cuenta Objetivo (Borrar)",
 accountIdLabel: "ID: ",
 accountNameLabel: "Nombre: ",
 accountTypeLabel: "Tipo: ",
 accountBalanceLabel:'Balance: ',
 actionLabel: "Acción: ",
 rtaDeletionAction: "Eliminación de Cuenta y Ajuste de cuentas afectadas",
 pendingDeletionStatus: "Pendiente por eliminación de la cuenta - Esperando confirmación",

 // loadingReportText: "Cargando Reporte de Impacto RTA...",
 reportErrorTitle: "Error al Cargar el Reporte:",
 reportErrorMessage: "No se puede proceder con la anulación.",// sin conocer el impacto financiero.",
 proceedToDeletionButton: "Proceder a la Eliminación de la cuenta",
 finalSuccessTitle: "¡Éxito!",

//InitialConfirmationDeleteAccountUI
// Títulos y encabezados
title: "Confirmar Eliminación de Cuenta",
description: "Está a punto de iniciar el proceso de Anulación Retrospectiva Total (ART) para esta cuenta.",
affectedAccounts: "cuenta(s) impactada(s) será(n) ajustada(s).",
willBeAdjusted: "serán ajustadas.",

// Estados y mensajes
processing: "Procesando anulación...",
apiError: "⚠️ **Error de API:**",
clickToConfirm: "Haga clic en Confirmar para continuar la anulación.",

// Botones
cancel: "Cancelar",
confirmDeletion: "Confirmar Anulación RTA",
confirmHardDelete: "Confirmar Borrado Permanente",
language: "Idioma",

// Textos adicionales
accountsImpacted: "cuentas impactadas.",
loading: "Cargando...", 

//StatusModalUI
successTitle: '¡Anulación Completada!',
errorTitle: 'Error en la Eliminación',
closeButton: 'Cerrar',

//idle status confirmation title
 idleStatusConfirmationTitle:'Requiere Confirmación',

//LoadingReportUI
loadingReportText:"Cargando Reporte de Impacto de cuentas. Metodo ART de eliminacion de cuentas...",

//impact report titles
reportTitleNoImpact:"Reporte de Impacto: No hay cuentas Afectadas",
reportTitleWithImpact:"Reporte de Cuentas Afectadas",

//ImpactReportUI
noImpactTitle: '¡Sin Impacto Financiero!',
noImpactMessage: 'No se encontraron cuentas afectadas. Se procederá con la **Eliminación Permanente de la cuenta (Hard Delete)**.',

impactDetectedTitle: '⚠️ Impacto Detectado: {count} Cuentas Afectadas',
impactDetectedMessage: 'La anulación ajustará automáticamente los saldos para mantener la consistencia financiera.',
tableOfAffectedAccountsDetails:'Detalles del impacto financiero en cuentas relacionadas',
/*
'Tabla que muestra el análisis de impacto financiero de las cuentas afectadas con saldos actuales, ajustes requeridos y nuevos saldos estimados',
*/
//header table description
affectedAccountColumn: 'Cuenta',//Cuenta Afectada
affectedAccountTypeColumn:'Tipo',
currentBalanceColumn: 'Saldo Actual',
netAdjustmentColumn: 'Ajuste Neto',
newBalanceColumn: 'Nuevo Saldo',
totalNetAdjustment: 'Ajuste Neto Total:',

 //account type in ImpactReportUI
 income_source:'Ingreso',
 category_budget:"Gasto",
 debtor:"Préstamo",
 investment:"Inversión",
 bank:"Banco",

 //auto close in
 autoCloseIn:"Cierre automático en ",
 
 // 🎯 POST OPERATION VIEW - SPANISH
  postOperationSuccessTitle: "Eliminación RTA Completada Exitosamente",
  postOperationSuccessSubtitle: "La cuenta {targetAccountName} ha sido eliminada",
  postOperationErrorTitle: "Eliminación RTA Fallida",
  postOperationErrorSubtitle: "No se pudo eliminar la cuenta {targetAccountName}",
  operationIdLabel: "ID de Operación",
  deletedAccountLabel: "Cuenta Eliminada",
  operationTimeLabel: "Hora de Operación",
  adjustmentResultsTitle: "Resultados de Ajustes Financieros",
  affectedAccountsCount: "Cuentas Afectadas",
  resultsTableNote: "Las cuentas afectadas han sido ajustadas automáticamente para mantener la consistencia financiera.",
  defaultSuccessMessage: "La anulación RTA se ha completado exitosamente. Todas las cuentas afectadas han sido ajustadas.",
  nextStepsTitle: "Próximos Pasos",
  contactAdminInstruction: "Comuníquese con el administrador de la aplicación",
  provideErrorIdInstruction: "Proporcione los detalles del error para investigación",
  tryAgainLaterInstruction: "Intente nuevamente más tarde o use un método diferente",
  accountLabel: "Cuenta",
  errorTimeLabel: "Hora del Error",
  backToActionsButton: "Volver a Panel de Cuentas",

 }
};






