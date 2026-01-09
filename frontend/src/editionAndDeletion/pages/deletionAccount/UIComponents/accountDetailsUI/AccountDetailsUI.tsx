// frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/accountDetailsUI/AccountDetailsUI.tsx

import { CurrencyType } from "../../../../../types/types";
import { DictionaryDataType } from "../../../../utils/languages";
import './accountDetailsUI.css'

// ===============================
// 🎯 ACCOUNT DETAILS PROPS TYPE
// ===============================
type AccountDetailsUIPropsType = {
accountId:string | number;
accountName:string;
accountType:string;
accountBalance:number;
accountCurrency:CurrencyType;
t:(keyText:keyof DictionaryDataType)=>string
showStatusIndicator?: boolean;
}
// ==================================
// 🎯 ACCOUNT DETAILS UI COMPONENT
// ==================================
export const AccountDetailsUI = (
{accountId,
accountName,
accountType,
accountBalance,
accountCurrency,
showStatusIndicator,
t
}:AccountDetailsUIPropsType) => {

return (
 <div className="account-details" role="region," aria-labelledby="account-details-title">

{/* Title */}
<h2 id="account-details-title" className="account-details-title">
{t('accountDetailsTitle')}
</h2>

{/* Account ID */}
<p className="account-detail">
 <strong>{t('accountIdLabel')}</strong>
 <span className="account-id" aria-label={`Account ID: accountId`}>{accountId}</span></p>

{/* Account Name */}
<p className="account-detail">
 <strong>{t('accountNameLabel')}
  </strong>
  <span className="account-name" aria-label={`Account Name: ${accountName}`}>
  {accountName}
  </span>
  </p>

{/* Account Type */}
<p className="account-detail">
 <strong aria-label={`Account Type: ${accountType}`}>
  {t('accountTypeLabel')}
  </strong>
  {t(`${accountType as keyof DictionaryDataType}`)}
 </p>
{/* Account Current Balance */}
<p className="account-detail">
 <strong aria-label={`Account Balance: ${accountBalance} ${accountCurrency}`}>
  {t('accountBalanceLabel')}
  </strong>
  {`${accountBalance.toFixed(2)} ${accountCurrency}`}
 </p>

{/* Action */}
<p className="account-detail"><strong>{t('actionLabel')}</strong>
<span className="account-action" aria-label={`Action: ${t('rtaDeletionAction')}`}>{t('rtaDeletionAction')}</span></p>

{/* Optional Status Indicator */}
{showStatusIndicator && (
 <div className="account-status" role="status" aria-live="polite">
   {t('pendingDeletionStatus')}
 </div>
  )}
</div> 
  )
}

export default AccountDetailsUI

