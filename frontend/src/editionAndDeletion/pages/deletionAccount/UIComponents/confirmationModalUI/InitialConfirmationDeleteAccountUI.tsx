//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/onfirmationModalUI/InitialConfirmationDeleteAcountUI.tsx

import CircleLoader from "../../../../../loader/circleLoader/CircleLoader";

import { RTAConfirmationModalPropsType } from "./RTAConfirmationModal";

import './InitialConfirmationDeleteAccountUI.css'

//TYPE DEFINITIONS
type InitialConfirmationDeleteAccountUIPropsType=RTAConfirmationModalPropsType & {
 buttonDisabled:boolean,
}
//===================================
//UI COMPONENT
//InitialConfirmationDeleteAccountUI
//===================================
export const InitialConfirmationDeleteAccountUI = ({
 t, affectedAccountsReportCount=0, buttonDisabled=false,mainStatusFromParent='idle',onClose,onConfirm,message='',

}:InitialConfirmationDeleteAccountUIPropsType) => {
//RENDERING INITIAL CONFIRMATION SCREEN
//Determine if showing error message
  const showErrorMessage = mainStatusFromParent === 'idle' 
  && message && message !==t('clickToConfirm')
 
 //Determine button confirmation text
 const getConfirmationButtonText = ()=>{
  return affectedAccountsReportCount===0
  ?t('confirmHardDelete')
  :t('confirmDeletion')
   }

// RENDERING INITIAL CONFIRMATION SCREEN
 return (
  <div className="confirm-delete-container fade-in " role="dialog" aria-labelledby='confirm-delete-title'>

   {/* Title */}
   <h3 id="confirm-delete-title" className="confirm-delete-title">{t('title')}</h3>

   {/* Description */}
   <p className="confirm-delete-description ">
    {t('description')}
   </p>

   {/* Counter */}
   <p className="confirm-delete-count ">
    <span className="count-number">{affectedAccountsReportCount}
    </span>
    <span className="affected-account">{t('affectedAccounts')}</span>
    </p>

   {/* Processing Indicator */}
    {buttonDisabled && (
     <div className="processing-indicator" role="status" aria-live='polite'>
      <CircleLoader/>
     <p>{message || t('processing')}</p>
     </div>
    )
     }

   {/* Error Message */}
   {showErrorMessage && (
     <div className="error-message" role="alert">
      <strong>{t('apiError')}</strong>
      <span>{'message'} apiError</span>
     </div>
    )
   }

   {/* Action Buttons */}
   <div className={`action-buttons ${buttonDisabled? 'disabled':''}` } >
    <button className='cancel-button' type="button" aria-label={t('cancel')} disabled={buttonDisabled}
    onClick={onClose}
    >
    {t('cancel')}
    </button> 

    <button className="confirm-button" type="button" disabled={buttonDisabled} aria-label={getConfirmationButtonText()}
    onClick={onConfirm}
    >
     {getConfirmationButtonText()}
    </button>
   </div>
  </div>

  )
}

export default InitialConfirmationDeleteAccountUI