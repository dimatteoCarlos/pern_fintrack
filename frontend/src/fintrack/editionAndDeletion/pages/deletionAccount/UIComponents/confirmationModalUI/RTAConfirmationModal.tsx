//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/confirmationModalUI/RTAConfirmationModal.ts/
import { ModalStatusType } from "../../../../types/deletionTypes.ts";
import { DictionaryDataType } from "../../../../utils/languages.ts";

import StatusModalUI from "../statusModalUI/StatusModalUI.tsx";
import InitialConfirmationDeleteAccountUI from "./InitialConfirmationDeleteAccountUI.tsx"

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
export const RTAConfirmationModal = ({
 t, isOpen, affectedAccountsReportCount, onClose, onConfirm, message, mainStatusFromParent
}:RTAConfirmationModalPropsType) => {
//Visibility logic: initial logic to render null if modal is closed
if(!isOpen) return null;
const buttonDisabled = mainStatusFromParent === 'executing';

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
   />
  );

  default: return null;
 }
};

// =====================
// 🎯 MAIN RENDER
// =====================
return (
 <div className=     {`rta-confirmation-modal-overlay
   ${isOpen ? 'open' : ''}`}
   role="dialog" aria-modal="true"  aria-hidden={!isOpen} aria-labelledby="modal-title">
  <div className="rta-confirmation-modal-container ">
   {getModalContent()}
  </div>
 </div>
)
 }
