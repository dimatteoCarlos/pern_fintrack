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

 //Pocket impact block (InitialConfirmationDeleteAccountUI)
 pocketImpactTitle: string;
 pocketImpactTotalLabel: string;
 pocketImpactNote: string;
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
 tableOfRelatedAccountsDetails: string;
 backButtonText: string;
 backWithoutClosingLabel: string;
 interactionsColumn: string;
 netMovedColumn: string;
 lastInteractionColumn: string;
 totalNetAdjustment: string; 
 unattributedAmount: string;
 unattributedNote: string;

 //movement types for the interactions cell of ImpactReportUI
 //
 //PREFIXED, AND NOT BY TASTE. 'investment' is both an account type and a
 //movement type, and this dictionary is one flat record: a single shared entry
 //would make renaming the account-type label silently rename the movement one.
 //The key is derived from the catalog name by movementLabelKey in
 //ImpactReportUI.tsx, which is why the hyphens are underscores here.
 movement_expense:string;
 movement_income:string;
 movement_investment:string;
 movement_debt:string;
 movement_pocket:string;
 movement_transfer:string;
 movement_receive:string;
 movement_account_opening:string;
 movement_pnl:string;
 movement_account_closure:string;
 movement_balance_reversal:string;

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

// 🎯 OTHER DELETION METHODS SECTION (AccountDeletionPage) - SOFT and HARD,
// alongside the RTA flow above (ACCOUNT_DELETION_METHODS.md §6)
 otherMethodsSectionTitle: string;
 otherMethodsSectionDescription: string;

 // The same screen when CLOSE is the only method it offers
 // (deletionMethodPolicy.ts). Separate keys rather than edits to the four
 // above, so turning the flag off restores the wording with it.
 closeOnlyPageTitle: string;
 closeOnlyDetailsTitle: string;
 closeOnlyBlockedNotice: string;
 closeNetWorthSectionLabel: string;
 closeNetWorthBeforeLabel: string;
 closeNetWorthAfterLabel: string;
 closeNetWorthUnchangedNote: string;
 relatedAccountsSummary: string;
 relatedAccountsNote: string;
 relatedAccountsHeading: string;
 relatedAccountsTitle: string;
 relatedAccountsLede: string;
 relatedAccountsLedeAdjustment: string;
 relatedAccountsNoneTitle: string;
 relatedAccountsNoneMessage: string;
 closeAccountBudgetWarning: string;
 closeOnlySectionTitle: string;
 closeOnlySectionDescription: string;
 closeAccountAction: string;

// SoftDeactivateAccountUI
 softDeactivateTriggerButton: string;
 softDeactivateTitle: string;
 softDeactivateDescription: string;
 softDeactivateConfirmButton: string;
 softDeactivateSuccessMessage: string;

// CloseAccountUI
 closeAccountTriggerButton: string;
 closeAccountTitle: string;
 closeAccountDescription: string;
 closeAccountConfirmButton: string;
 closeAccountSuccessMessage: string;
 closeAccountBalanceLabel: string;
 closeAccountBlockedByBalance: string;
 closeAccountReverseTriggerButton: string;
 closeAccountReverseTitle: string;
 closeAccountReverseDescription: string;
 closeAccountReverseConfirmButton: string;
 closeAccountReversalNotice: string;
 closeReversalBoundaryStatement: string;
 closeAccountPreviewError: string;
 closeAccountReasonLabel: string;
 closeAccountReasonPlaceholder: string;
 closeAccountReasonHint: string;

// HardDeleteConfirmationUI
 hardDeleteTriggerButton: string;
 hardDeleteTitle: string;
 hardDeleteDescription: string;
 hardDeleteWarning: string;
 hardDeleteConfirmButton: string;
 hardDeleteSuccessMessage: string;

 }

//Default Language
export const defaultLanguage:LanguageKeyType='en';

//Function to Get texts according to Lang / Función para obtener textos según idioma
// The values a sentence needs at render time, keyed by the name written inside
// the braces of the entry. Numbers are accepted so a caller does not have to
// stringify an amount before passing it.
export type TranslationValuesType = Record<string, string | number>;

// Matches a placeholder written as {name}. Word characters only, so a brace in
// ordinary copy is not treated as the start of one.
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

/**
 * Reads one entry and substitutes its placeholders.
 *
 * The third argument is optional and the two-argument call is unchanged, which
 * is what lets the existing entries and their call sites stay as they are.
 *
 * Substitution rather than splitting the sentence around a rendered element:
 * the word order differs between the two languages, so a sentence assembled
 * from fragments is grammatical in one of them and wrong in the other. The
 * entry holds the whole sentence in each language and the values arrive into
 * it, so the order belongs to the entry.
 *
 * A placeholder with no matching value is left on screen as written. An empty
 * string would produce a sentence that reads correctly and says the wrong
 * thing; a visible {name} is a defect the first reader catches. Same reasoning
 * as the design system's rule that a missing figure renders as a dash and
 * never as 0.
 */
export const getLangText = (lang:LanguageKeyType, key:keyof DictionaryDataType, values?:TranslationValuesType):string => {
 const entry = languages[lang]?.[key] || languages[defaultLanguage][key] || key;

 if (!values) return entry;

 return entry.replace(PLACEHOLDER_PATTERN, (placeholder, name:string) =>
  Object.prototype.hasOwnProperty.call(values, name)
   ? String(values[name])
   : placeholder,
 );
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
 proceedToDeletionButton: "Delete with adjustment",
 finalSuccessTitle: "Success!",

//Titles and headers
title:'Confirm Account Deletion',
description:'You are about to initiate the Retrospective Total Annulment (RTA) deletion method for this account. ', 
affectedAccounts:'account(s) will be adjusted.',
willBeAdjusted:'will be adjusted.',

//Pocket impact block
pocketImpactTitle:'This account currently supports:',
pocketImpactTotalLabel:'Total allocated:',
pocketImpactNote:'Deleting this account removes these allocations from the affected pockets. The money itself is not deleted; only the pocket assignments are removed.',

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
 tableOfRelatedAccountsDetails: 'Accounts this one has operated with',
 backButtonText: 'Back',
 backWithoutClosingLabel: 'Back, without closing this account',
 interactionsColumn: 'Interactions',
 netMovedColumn: 'Net Moved',
 lastInteractionColumn: 'Last Interaction',
 totalNetAdjustment: 'Total Net Adjustment:',
 unattributedAmount: 'Not attributable to any account:',
 unattributedNote:
  '{count} transactions an earlier deletion already reversed. Shown beside the total, not added to it.',

 //account type in ImpactReportUI
 // What a shared movement was, for the interactions cell. The catalog names
 // are lowercase identifiers ('account-opening'); these are what the owner
 // reads.
 movement_expense: "Expense",
 movement_income: "Income",
 movement_investment: "Investment",
 movement_debt: "Debt",
 movement_pocket: "Pocket",
 movement_transfer: "Transfer sent",
 movement_receive: "Transfer received",
 movement_account_opening: "Account opening",
 movement_pnl: "Profit and loss",
 movement_account_closure: "Account closure",
 movement_balance_reversal: "Balance reversal",

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

// 🎯 OTHER DELETION METHODS - ENGLISH
  otherMethodsSectionTitle: "Other deletion methods",
  otherMethodsSectionDescription: "Prefer not to run the annulment above? Deactivate the account instead, or erase it permanently without reversing its impact on other accounts.",

  closeOnlyPageTitle: "Delete Account",
  closeOnlyDetailsTitle: "Account to Delete",
  closeOnlyBlockedNotice: "This account cannot be closed because it still has a balance. You can manually transfer the funds to another account first, or use the button below to close it instantly—but note that this button option will remove the balance from your Net Worth.",
  relatedAccountsSummary: "Related accounts",
  relatedAccountsNote: "New balance and net adjustment show what deleting this account with adjustment would do to each of these accounts. The close changes none of these figures.",
  relatedAccountsHeading: "Accounts this one has moved money with",
  relatedAccountsTitle: "This account has moved money with {count} accounts",
  relatedAccountsLede: "How many movements this account shares with each of them, and when the last one was. Closing changes none of these accounts: the movements they share with it keep its name, because the closed account is recorded before its row is removed.",
  relatedAccountsLedeAdjustment: "Two of the columns belong to the other route on this screen, not to closing. New balance and net adjustment are what deleting this account WITH ADJUSTMENT would leave on each of these accounts. Closing changes none of them.",
  relatedAccountsNoneTitle: "No shared movements",
  relatedAccountsNoneMessage: "This account has not moved money with any other account.",
  closeAccountBudgetWarning: "This account carries a budget. The budget is deleted with the account, and the close cannot be undone.",
  closeOnlySectionTitle: "Delete this account",
  closeOnlySectionDescription: "The account is removed and cannot be reopened. Its history is kept: every movement that names it stays readable, under the same name it had. The balance must be zero first.",
  closeAccountAction: "Delete (the account goes, its history stays)",

  softDeactivateTriggerButton: "Deactivate Account",
  softDeactivateTitle: "Deactivate this account?",
  softDeactivateDescription: "This deactivates the account instead of erasing it. Its balance, transactions and history stay exactly as they are, and it can be reactivated later. No financial impact report is needed for this action.",
  softDeactivateConfirmButton: "Deactivate Account",
  softDeactivateSuccessMessage: "{targetAccountName} has been deactivated.",

// CloseAccountUI
  closeAccountTriggerButton: "Delete Account",
  closeAccountTitle: "Delete this account?",
  closeAccountDescription: "Closing removes the account and keeps its history. Its transactions, pocket allocations and budget months stay readable under the same account, and any pockets this account was backing get their commitment back. The account name becomes available again. This cannot be undone: the account is not deactivated, it is removed, and there is no way to reopen it.",
  closeAccountConfirmButton: "Delete Account",
  closeAccountSuccessMessage: "{targetAccountName} has been deleted. Its history stays in the registry under the same name.",
  closeAccountBalanceLabel: "Balance to close with:",
  closeAccountBlockedByBalance: "This account still holds {residual}. Closing does not move money: it only runs on an account at zero. Move the balance out with a transfer first and then close it, or use the button that reverses the balance and closes in one step.",
  closeAccountReverseTriggerButton: "Reverse the Balance and Close",
  closeAccountReverseTitle: "Reverse the Balance and Close",
  closeAccountReverseDescription: "This account holds a balance, so it cannot be closed as it is. FinTrack will move that balance out and close the account, both in one operation - if either part fails, neither happens. You choose nothing else: the amount is exactly what the account holds, and the destination is the compensation account the system keeps for this.",
  closeAccountReverseConfirmButton: "Reverse and Close",
  closeNetWorthSectionLabel: "What this does to your net worth",
  closeNetWorthBeforeLabel: "Net worth now",
  closeNetWorthAfterLabel: "After closing this account",
  closeNetWorthUnchangedNote: "This account is not one of the holdings net worth adds up, so closing it leaves that figure exactly where it is.",
  closeAccountReversalNotice: "{residual} will be moved out of this account, bringing it to zero, and then the account will be closed. Whatever this balance was counting towards stops counting it: the compensation account that receives it sits outside every balance the app adds up, so a balance that was part of your net worth leaves it. Nothing is destroyed - the movement is recorded and the history stays readable.",
  closeReversalBoundaryStatement: "The balance is reversed against the compensation account the system keeps for this. It is not one of your accounts: it sits outside your net worth and outside every aggregate balance, so moving a balance into it takes that balance out of your figures without destroying the record that it existed. It appears in the list below only if this account has already moved money with it before today, and that row is history like every other one there - it is not the reversal about to be made.",
  closeAccountPreviewError: "The balance could not be read, so the close cannot be offered yet.",
  closeAccountReasonLabel: "Reason for closing",
  closeAccountReasonPlaceholder: "e.g. Bank account closed at the branch",
  closeAccountReasonHint: "Required. It is stored with the closure and is what a later reader sees instead of the account.",

  hardDeleteTriggerButton: "Erase Without Reversal",
  hardDeleteTitle: "Erase this account without reversing its impact?",
  hardDeleteDescription: "This permanently erases the account and its own transactions. It cannot be undone.",
  hardDeleteWarning: "Every counterparty's historical balance from transacting with this account is left exactly as it is - nothing gets corrected. This is different from the Retrospective Total Annulment above, which reverses that impact first. Choose this only when you explicitly do not want that correction.",
  hardDeleteConfirmButton: "Erase Without Reversal",
  hardDeleteSuccessMessage: "{targetAccountName} has been permanently erased.",

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
 proceedToDeletionButton: "Eliminar con ajuste",
 finalSuccessTitle: "¡Éxito!",

//InitialConfirmationDeleteAccountUI
// Títulos y encabezados
title: "Confirmar Eliminación de Cuenta",
description: "Está a punto de iniciar el proceso de Anulación Retrospectiva Total (ART) para esta cuenta.",
affectedAccounts: "cuenta(s) impactada(s) será(n) ajustada(s).",
willBeAdjusted: "serán ajustadas.",

//Pocket impact block
pocketImpactTitle: "Esta cuenta actualmente respalda:",
pocketImpactTotalLabel: "Total asignado:",
pocketImpactNote: "Al eliminar esta cuenta se eliminan estas asignaciones de los pockets afectados. El dinero no se elimina; solo se elimina la asignación al pocket.",

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
tableOfRelatedAccountsDetails: 'Cuentas con las que esta ha operado',
backButtonText: 'Volver',
backWithoutClosingLabel: 'Volver sin cerrar esta cuenta',
interactionsColumn: 'Movimientos',
netMovedColumn: 'Monto Neto Movido',
lastInteractionColumn: 'Último Movimiento',
totalNetAdjustment: 'Ajuste Neto Total:',
 unattributedAmount: 'No atribuible a ninguna cuenta:',
 unattributedNote:
  '{count} transacciones que una eliminación anterior ya revirtió. Se muestra junto al total, no se suma.',

 //account type in ImpactReportUI
 // Lo que fue un movimiento compartido, para la celda de interacciones.
 movement_expense: "Gasto",
 movement_income: "Ingreso",
 movement_investment: "Inversión",
 movement_debt: "Deuda",
 movement_pocket: "Bolsillo",
 movement_transfer: "Transferencia enviada",
 movement_receive: "Transferencia recibida",
 movement_account_opening: "Apertura de cuenta",
 movement_pnl: "Pérdidas y ganancias",
 movement_account_closure: "Cierre de cuenta",
 movement_balance_reversal: "Reversión de saldo",

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

// 🎯 OTHER DELETION METHODS - SPANISH
  otherMethodsSectionTitle: "Otros métodos de eliminación",
  otherMethodsSectionDescription: "¿Prefiere no ejecutar la anulación anterior? Desactive la cuenta en su lugar, o elimínela de forma permanente sin revertir su impacto en otras cuentas.",

  closeOnlyPageTitle: "Eliminar Cuenta",
  closeOnlyDetailsTitle: "Cuenta a Eliminar",
  closeOnlyBlockedNotice: "Esta cuenta no se puede cerrar porque todavía tiene dinero. Puedes transferir el saldo a otra cuenta y luego cerrarla, o tocar el botón de abajo para vaciarla y cerrarla en un solo paso. (Ten en cuenta que si eliges cerrarla ahora, este dinero dejará de sumarse a tu patrimonio total en la app).",
  relatedAccountsSummary: "Cuentas relacionadas",
  relatedAccountsNote: "El saldo nuevo y el ajuste neto muestran lo que le haría a cada una de estas cuentas eliminar esta con ajuste. El cierre no cambia ninguna de esas cifras.",
  relatedAccountsHeading: "Cuentas con las que esta ha movido dinero",
  relatedAccountsTitle: "Esta cuenta ha movido dinero con {count} cuentas",
  relatedAccountsLede: "Cuántos movimientos comparte esta cuenta con cada una de ellas, y cuándo fue el último. Cerrar no cambia ninguna de estas cuentas: los movimientos que comparten con ella conservan su nombre, porque la cuenta cerrada queda registrada antes de que se elimine su fila.",
  relatedAccountsLedeAdjustment: "Dos de las columnas son de la otra vía de esta pantalla, no del cierre. El saldo nuevo y el ajuste neto son lo que dejaría en cada una de estas cuentas eliminar esta CON AJUSTE. El cierre no cambia ninguna de las dos.",
  relatedAccountsNoneTitle: "Sin movimientos compartidos",
  relatedAccountsNoneMessage: "Esta cuenta no ha movido dinero con ninguna otra cuenta.",
  closeAccountBudgetWarning: "Esta cuenta tiene un presupuesto asociado. El presupuesto se elimina junto con la cuenta, y el cierre no se puede deshacer.",
  closeOnlySectionTitle: "Eliminar esta cuenta",
  closeOnlySectionDescription: "La cuenta se elimina y no se puede reabrir. Su historia se conserva: todo movimiento que la nombra sigue siendo legible, con el nombre que tenía. El saldo debe estar en cero primero.",
  closeAccountAction: "Eliminación (la cuenta se va, su historia queda)",

  softDeactivateTriggerButton: "Desactivar Cuenta",
  softDeactivateTitle: "¿Desactivar esta cuenta?",
  softDeactivateDescription: "Esto desactiva la cuenta en lugar de eliminarla. Su saldo, transacciones e historial permanecen exactamente iguales, y puede reactivarse más adelante. Esta acción no requiere un reporte de impacto financiero.",
  softDeactivateConfirmButton: "Desactivar Cuenta",
  softDeactivateSuccessMessage: "{targetAccountName} ha sido desactivada.",

// CloseAccountUI
  closeAccountTriggerButton: "Eliminar Cuenta",
  closeAccountTitle: "\u00bfEliminar esta cuenta?",
  closeAccountDescription: "Cerrar elimina la cuenta y conserva su historial. Sus transacciones, asignaciones de bolsillos y meses de presupuesto siguen siendo legibles bajo la misma cuenta, y los bolsillos que esta cuenta respaldaba recuperan su compromiso. El nombre de la cuenta vuelve a quedar disponible.",
  closeAccountConfirmButton: "Eliminar Cuenta",
  closeAccountSuccessMessage: "{targetAccountName} ha sido eliminada. Su historial permanece en el registro bajo el mismo nombre.",
  closeAccountBalanceLabel: "Saldo con el que cerrar\u00eda:",
  closeAccountBlockedByBalance: "Esta cuenta todavía tiene {residual}. Cerrar no mueve dinero: solo se ejecuta sobre una cuenta en cero. Saque el saldo con una transferencia primero y después ciérrela, o use el botón que revierte el saldo y cierra en un solo paso.",
  closeAccountReverseTriggerButton: "Revertir Saldo y Cerrar",
  closeAccountReverseTitle: "Revertir el Saldo y Cerrar",
  closeAccountReverseDescription: "Esta cuenta tiene saldo, así que no puede cerrarse tal como está. FinTrack sacará ese saldo y cerrará la cuenta, ambas cosas en una sola operación: si una parte falla, no ocurre ninguna. Usted no elige nada más, el monto es exactamente lo que la cuenta tiene y el destino es la cuenta de compensación que el sistema mantiene para esto.",
  closeAccountReverseConfirmButton: "Revertir y Cerrar",
  closeNetWorthSectionLabel: "Lo que esto le hace a tu patrimonio",
  closeNetWorthBeforeLabel: "Patrimonio ahora",
  closeNetWorthAfterLabel: "Después de cerrar esta cuenta",
  closeNetWorthUnchangedNote: "Esta cuenta no es una de las tenencias que el patrimonio suma, así que cerrarla deja esa cifra exactamente donde está.",
  closeAccountReversalNotice: "Se sacarán {residual} de esta cuenta, dejándola en cero, y después se cerrará. Lo que ese saldo estuviera sumando deja de sumarlo: la cuenta de compensación que lo recibe queda fuera de todos los saldos que la aplicación suma, así que un saldo que formaba parte de su patrimonio sale de él. No se destruye nada: el movimiento queda registrado y la historia sigue siendo legible.",
  closeReversalBoundaryStatement: "El saldo se revierte contra la cuenta de compensación que el sistema mantiene para esto. No es una de sus cuentas: queda fuera de su patrimonio y fuera de todo saldo agregado, así que mover un saldo hacia ella lo retira de sus cifras sin destruir el registro de que existió. Aparece en la lista de abajo solo si esta cuenta ya movió dinero con ella antes de hoy, y esa fila es historia como todas las demás: no es la reversión que está por hacerse.",
  closeAccountPreviewError: "No se pudo leer el saldo, as\u00ed que el cierre a\u00fan no puede ofrecerse.",
  closeAccountReasonLabel: "Motivo del cierre",
  closeAccountReasonPlaceholder: "p. ej. Cuenta bancaria cerrada en la sucursal",
  closeAccountReasonHint: "Obligatorio. Se guarda junto al cierre y es lo que ver\u00e1 despu\u00e9s quien consulte, en lugar de la cuenta.",

  hardDeleteTriggerButton: "Eliminar Sin Reversión",
  hardDeleteTitle: "¿Eliminar esta cuenta sin revertir su impacto?",
  hardDeleteDescription: "Esto elimina permanentemente la cuenta y sus propias transacciones. No se puede deshacer.",
  hardDeleteWarning: "El saldo histórico de cada contraparte que transaccionó con esta cuenta queda exactamente igual: no se corrige nada. Esto es distinto de la Anulación Retrospectiva Total de arriba, que revierte ese impacto antes de eliminar. Elija esta opción solo cuando explícitamente no quiera esa corrección.",
  hardDeleteConfirmButton: "Eliminar Sin Reversión",
  hardDeleteSuccessMessage: "{targetAccountName} ha sido eliminada permanentemente.",

 }
};






