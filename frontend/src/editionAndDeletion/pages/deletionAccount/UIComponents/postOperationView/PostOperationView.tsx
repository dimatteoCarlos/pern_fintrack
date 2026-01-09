//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/postOperationView/PostOperationView.tsx

import './PostOperationView.css';
import { DictionaryDataType } from '../../../../utils/languages';
import { DeletionSuccessDataType, ImpactReportRowType } from '../../../../types/deletionTypes';
import { CurrencyType } from '../../../../../types/types';

// ==========================
// 🎯 POST OPERATION VIEW PROPS TYPE
// ==========================
export type PostOperationViewPropType = {
  t: (keyText: keyof DictionaryDataType) => string;
  result: 'success' | 'error';
  data: DeletionSuccessDataType | string; // Success data or error message
  originalAccount: {
    targetAccountId: string | number;
    targetAccountName: string;
    targetAccountType: string;
    targetAccountBalance:number;
    targetAccountCurrency:CurrencyType;
  };
  affectedAccounts?: ImpactReportRowType[]; 
  onBackToActions: () => void;
};

// ====================================
// 🎯 POST OPERATION VIEW COMPONENT
// ====================================
export const PostOperationView = ({
  t,
  result,
  data,
  originalAccount,
  affectedAccounts = [],
  onBackToActions
}:PostOperationViewPropType) => {
  const isSuccess = result === 'success';
  const successData = isSuccess ? data as DeletionSuccessDataType : null;
  const errorMessage = !isSuccess ? data as string : '';
  
  // 🎯 SUCCESS VIEW
  if (isSuccess && successData) {
    return (
     <div className="post-operation-view success-view">
    {/* 🎯 SUCCESS HEADER */}
      <div className="post-operation-header success">
        <div className="status-icon">✅</div>
        <h2 className="post-operation-title">
          {t('postOperationSuccessTitle')}
        </h2>
        <p className="post-operation-subtitle">
          {t('postOperationSuccessSubtitle').replace('{targetAccountName}', originalAccount.targetAccountName)}
        </p>
       </div>
        
    {/* 🎯 OPERATION DETAILS */}
    <div className="operation-details">
     <div className="detail-row">
       <span className="detail-label">{t('operationIdLabel')}:</span>
       <span className="detail-value">{successData.deletedAccountId || 'N/A'}</span>
     </div>
          <div className="detail-row">
            <span className="detail-label">{t('deletedAccountLabel')}:</span>
            <span className="detail-value">
              {originalAccount.targetAccountName} (ID: {originalAccount.targetAccountId})
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('operationTimeLabel')}:</span>
            <span className="detail-value">{new Date().toLocaleString()}</span>
          </div>
        </div>
        
        {/* 🎯 RESULTS SUMMARY (Only if we have affected accounts) */}
        {affectedAccounts.length > 0 && (
          <div className="results-summary">
            <h3 className="results-title">{t('adjustmentResultsTitle')}</h3>
            <div className="summary-stats">
              <div className="stat-item">
                <span className="stat-label">{t('affectedAccountsCount')}:</span>
                <span className="stat-value">{affectedAccounts.length}</span>
              </div>
            </div>
            
            <div className="results-note">
              {t('resultsTableNote')}
            </div>
          </div>
        )}
        
        {/* 🎯 SUCCESS MESSAGE */}
        <div className="success-message-container">
          <p className="success-message">
            {successData.message || t('defaultSuccessMessage')}
          </p>
        </div>
        
        {/* 🎯 SINGLE ACTION BUTTON */}
        <div className="post-operation-actions">
          <button
            onClick={onBackToActions}
            className="back-to-actions-button"
            aria-label={t('backToActionsButton')}
          >
            {t('backToActionsButton')}
          </button>
        </div>
      </div>
    );
  }
  
  // 🎯 ERROR VIEW
  return (
    <div className="post-operation-view error-view">
      {/* 🎯 ERROR HEADER */}
      <div className="post-operation-header error">
        <div className="status-icon">❌</div>
        <h2 className="post-operation-title">
          {t('postOperationErrorTitle')}
        </h2>
        <p className="post-operation-subtitle">
          {t('postOperationErrorSubtitle').replace('{targetAccountName}', originalAccount.targetAccountName)}
        </p>
      </div>
      
      {/* 🎯 ERROR DETAILS */}
      <div className="error-details">
        <div className="error-message-container">
          <p className="error-message-text">{errorMessage}</p>
        </div>
        
        <div className="error-instructions">
          <h4 className="instructions-title">{t('nextStepsTitle')}</h4>
          <ul className="instructions-list">
            <li>{t('contactAdminInstruction')}</li>
            <li>{t('provideErrorIdInstruction')}</li>
            <li>{t('tryAgainLaterInstruction')}</li>
          </ul>
        </div>
        
        <div className="error-metadata">
          <div className="metadata-row">
            <span className="metadata-label">{t('accountLabel')}:</span>
            <span className="metadata-value">
              {originalAccount.targetAccountName} (ID: {originalAccount.targetAccountId})
            </span>
            <span>
             {(originalAccount.targetAccountBalance).toFixed(2)} {originalAccount.targetAccountCurrency}
            </span>
          </div>
          <div className="metadata-row">
            <span className="metadata-label">{t('errorTimeLabel')}:</span>
            <span className="metadata-value">{new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>
      
      {/* 🎯 SINGLE ACTION BUTTON */}
      <div className="post-operation-actions">
        <button
          onClick={onBackToActions}
          className="back-to-actions-button"
          aria-label={t('backToActionsButton')}
        >
          {t('backToActionsButton')}
        </button>
      </div>
    </div>
  );
};

export default PostOperationView;