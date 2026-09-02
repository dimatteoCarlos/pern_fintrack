//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/confirmationModalUI/RTAConfirmationModal.ts/
import { ModalStatusType } from "../../../../types/deletionTypes.ts";
import { DictionaryDataType } from "../../../../utils/languages.ts";

import StatusModalUI from "../statusModalUI/StatusModalUI.tsx";
import InitialConfirmationDeleteAccountUI from "./InitialConfirmationDeleteAccountUI.tsx"
import { useModalDialog } from "../../../../../../hooks/useModalDialog.ts";

import './RTAConfirmationModal.css';

// ==========================
// 🎯 MODAL PROPS TYPE
// ==========================
export type RTAConfirmationModalPropsType={
 t:(keyText:keyof DictionaryDataType)=>string;
 isOpen:boolean;
 onClose:()=>void;
 onConfirm:()=>void;
 mainStatusFromParent:ModalStatusType;
 message:string;
 affectedAccountsReportCount:number;
}
// ====================================
// 🎯 RTA CONFIRMATION MODAL COMPONENT
// ====================================
// The guard, and nothing else: a hook cannot be called after the early return
// below, and the caret only returns to whatever opened this because the dialog
// UNMOUNTS on close.
export const RTAConfirmationModal = (props:RTAConfirmationModalPropsType) => {
 if(!props.isOpen) return null;

 return <RTAConfirmationDialog {...props} />;
};

const RTAConfirmationDialog = ({
 t, affectedAccountsReportCount, onClose, onConfirm, message, mainStatusFromParent
}:RTAConfirmationModalPropsType) => {
const buttonDisabled = mainStatusFromParent === 'executing';

// This element is the dialog and the two screens below are its CONTENT, which
// is why they stop declaring roles of their own: a dialog inside a dialog is
// not a structure a screen reader can report.
//
// Not portalled, so the page behind is not made inert; aria-modal hides it from
// a screen reader and the hook's Tab cycle keeps the caret inside. No initial
// focus is named on purpose -- the hook then holds the caret on the panel, and
// the destructive answer is not the thing already focused when the dialog opens.
const { titleId, dialogProps } = useModalDialog({
 onClose,
 lockPageBehind: false,
 // The account is being deleted; the request must not be abandoned halfway by
 // an Escape. Same condition the buttons disable on.
 canClose: mainStatusFromParent !== 'executing',
});

// ===================================
// 🎯 MODAL CONTENT RENDERER
// ===================================
//ContentRendererFn: encapsules the conditional rendering logic, per status
const getModalContent = ()=>{
//Shows Success or Error Modal UI(Post-Confirmation) 
switch (mainStatusFromParent){
 case 'idle':
//InitialConfirmationDeleteAccountUI:Initial confirmation screen with detailed info, data and buttons
 return(
  <InitialConfirmationDeleteAccountUI
   t={t} affectedAccountsReportCount={affectedAccountsReportCount}
   buttonDisabled={buttonDisabled}

   onClose={onClose}
   onConfirm={onConfirm}
   mainStatusFromParent={mainStatusFromParent}
   message={message}
   titleId={titleId}

   isOpen
  />
  );

  case 'executing':
  case 'success':
  case 'error':
  return(
   <StatusModalUI
    modalStatus={mainStatusFromParent}
    message={message}
    onClose={onClose}
    autoCloseDelay={4000}
    showCountdown={true}
    t={t}
    titleId={titleId}
   />
  );

  default: return null;
 }
};

// =====================
// 🎯 MAIN RENDER
// =====================
return (
 <div
   className="rta-confirmation-modal-overlay open"
   {...dialogProps}
   /* alertdialog once the deletion is running or has answered: that content
      demands a response and interrupts. The idle screen is an ordinary
      confirmation. The role is stated after the spread so it wins over the
      hook's default. */
   role={mainStatusFromParent === 'idle' ? 'dialog' : 'alertdialog'}
   /* The paragraph only exists on the status screens. It named the inner
      element while the dialog role sat on this one, so nothing described the
      dialog. */
   aria-describedby={
    mainStatusFromParent === 'idle' ? undefined : 'status-modal-message'
   }>
  <div className="rta-confirmation-modal-container ">
   {getModalContent()}
  </div>
 </div>
)
 }
