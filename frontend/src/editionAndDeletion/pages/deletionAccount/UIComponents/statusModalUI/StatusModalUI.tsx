//frontend/src/editionAndDeletion\pages/deletionAccount/UIComponents/statusModalUI/StatusModalUI.tsx
import { useCallback, useEffect, useState } from "react";
import { ModalStatusType } from "../../../../types/deletionTypes";
import { DictionaryDataType } from "../../../../utils/languages";

import './StatusModalUI.css';

// ==========================
// 🎯 STATUS MODAL UI PROPS TYPE
// ==========================
type StatusModalUIPropType={
 modalStatus:ModalStatusType;
 message:string;
 autoCloseDelay?:number;
 showCountdown?:boolean;
 onClose:()=>void;
 onConfirm?:()=>void;
 t:(keyText : keyof DictionaryDataType)=>string;
}

// ============================
// 🎯 STATUS MODAL UI COMPONENT
// ============================
export const StatusModalUI = (
 {
  modalStatus,
  message,
  autoCloseDelay=4000,
  onClose,
  onConfirm,
  showCountdown=false,
  t,
}:StatusModalUIPropType) => {
// 🎯 STATE
//Countdown timer for auto-close
const [timeLeft, setTimeLeft] = useState<number>(Math.floor(autoCloseDelay/1000))

// 🎯 EFFECT:
//Auto-close timer for success/error states
useEffect(() => {
 if(modalStatus!=='success' && modalStatus!=='error'){
  return
 }
 const timerId = setInterval(()=>{
  setTimeLeft((prev)=>{
   if(prev<=1){
    clearInterval(timerId);
    onClose();
    return 0;
   }
    return prev -1
   })
  },1000)

// 🎯 CLEANUP: Clear interval on unmount or status change
  return () => {
   clearInterval(timerId);
  }
}, [modalStatus, onClose])
// ============================
// 🎯 HANDLERS
// ============================
// Manual close button
const handleManualClose = useCallback(
 ()=>{ onClose();},[onClose]
)
//Confirm button for idle state
const handleConfirm = useCallback(()=>{
 if(onConfirm){
  onConfirm();
 }
}, [onConfirm]
);

// ============================
// 🎯 RENDER FUNCTIONS PER STATE
// ============================
//Determine container class based on modal status
 const containerClass = `status-modal-container ${modalStatus}`;

 //Determine title text based on modal status
const getTitleText =()=>{
 switch (modalStatus){
  case 'idle': return t('idleStatusConfirmationTitle') || 'Confirmation' ;
  case 'executing': return t('processing') || 'Processing' ;
  case 'success': return t('successTitle') || 'Success' ;
  case 'error': return t('errorTitle') || 'Error';
  default:return '';
  }
 };

//Different Content to render based on modal status state
//Success or Error modal status common render content
const renderStatusSuccessOrErrorContent =(statusType:ModalStatusType)=>{
 return(
  <>
   <h3 id="status-modal-title" className="status-modal-title">
    {getTitleText()}
   </h3>
   <p id="status-modal-message" className="status-modal-message">
    {message}
   </p>
   {showCountdown && (
    <div className="auto-close-countdown">
     <p className="countdown-text">
      {t('autoCloseIn') || 'Close in'}
      <span className="countdown-number">
       {timeLeft}s
      </span>
     </p>
    </div>
   )}
   <button className={`status-modal-button close-button ${statusType}`}
    onClick={handleManualClose} aria-label={t('closeButton')}
    >
    {t('closeButton')} {showCountdown && `(${timeLeft}s)`}
   </button>
  </>
 )
}
//Choose content to render by status modal
const renderContent = ()=>{
 switch (modalStatus){
  case 'idle':
   return (
    <>
     <h3 id="status-modal-title" className="status-modal-title">
      {getTitleText()}
     </h3>
     <p id="status-modal-message" className="status-modal-message">
      {message}
     </p>

     <div className="status-modal-actions">
      <button className="status-modal-button cancel-button"
       onClick={handleManualClose} aria-label={t('cancel')}>
        {t('cancel')}
      </button>

      <button className="status-modal-button confirm-button"
      onClick={handleConfirm}
      aria-label={t('proceedToDeletionButton')}
      >
       {t('proceedToDeletionButton')}
      </button>
     </div>
    </>
   );//end of idle case

   case 'executing':
    return(
     <>
      <h3 id="status-modal-title" className="status-modal-title">
      {getTitleText()}
      </h3>
     <div className="loading-spinner"
      aria-hidden='true'
     ></div>

      <p id="status-modal-message" className="status-modal-message">{message}</p>
     </>
    );

    case 'success':
     case 'error':
     return (
      renderStatusSuccessOrErrorContent(modalStatus)
     );//end of success case

     default:
      return null;
 }
}

// ============================
// 🎯 MAIN RENDER
// ============================
 return (
<div
 className={containerClass}      role="alertdialog" 
 aria-modal='true'
 aria-labelledby="status-modal-title" aria-describedby="status-modal-message">
  {renderContent()}
</div>

  )
}

export default StatusModalUI