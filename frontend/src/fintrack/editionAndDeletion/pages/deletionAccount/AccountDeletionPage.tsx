//frontend/src/editionAndDeletio/pages/deletionAccount/AccountDeletionPage.tsx
import './accountDeletionPage.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  defaultLanguage,
  isLanguageTypeValid,
  LanguageKeyType,
  languages,
} from '../../utils/languages.ts';
import { ModalStatusType } from '../../types/deletionTypes.ts';

import { useLanguageTranslation } from '../../hooks/useLangTranslation.ts';
import { useRTAImpactAndDeletion } from '../../hooks/useRTAImpactAndDeletion.ts';

//UI COMPONENTS
import LeftArrowDarkSvg from '../../../../assets/LeftArrowDarkSvg.svg';

import LoadingReportUI from './UIComponents/loadingReportUI/LoadingReportUI.tsx';
import ImpactReportUI from './UIComponents/impactReportUI/ImpactReportUI.tsx';
import { NoImpactReportUI } from './UIComponents/impactReportUI/NoImpactReportUI.tsx';
import AccountDetailsUI from './UIComponents/accountDetailsUI/AccountDetailsUI.tsx';
import { RTAConfirmationModal } from './UIComponents/confirmationModalUI/RTAConfirmationModal.tsx';
import ReportErrorUI from './UIComponents/reportErrorUI/ReportErrorUI.tsx';
import ProceedButtonUI from './UIComponents/proceedButtonUI/ProceedButtonUI.tsx';
import PostOperationView from './UIComponents/postOperationView/PostOperationView.tsx';
// =======================================
// 🖥️ MAIN COMPONENT: AccountDeletionPage
// =======================================
export const AccountDeletionPage = () => {
  const navigateTo = useNavigate();
  //GET ACCOUNT INFO: from params and location state
  const { accountId } = useParams();
  const {
    state: { accountData },
    state: { previousRoute },
  } = useLocation();

  // EXTRACT ACCOUNT INFORMATION
  const targetAccountType = accountData.account_type_name;
  const targetAccountName = accountData.account_name;
  const targetAccountId = Number(accountId) || Number(accountData.account_id);
  const targetAccountBalance = accountData.account_balance;
  const targetAccountCurrency = accountData.currency_code;
  //--------------------------------------
  //LANGUAGE MANAGEMENT
  //--------------------------------------
  //Language state
  const [language, setLanguage] = useState<LanguageKeyType>(defaultLanguage);

  //Effect to persit the language in localStorage "userLang"
  useEffect(() => {
    const savedLang = localStorage.getItem('userLang') as LanguageKeyType;

    if (isLanguageTypeValid(savedLang)) {
      setLanguage(savedLang);
    } else {
      console.log(`user saved language ${savedLang} is not valid`);
      setLanguage(defaultLanguage);
      localStorage.setItem('userLang', defaultLanguage);
    }
  }, [setLanguage]);
  //---
  //Function to change the language
  const changeLanguage = (lang: typeof language) => {
    if (languages[lang]) {
      setLanguage(lang);
      localStorage.setItem('userLang', lang);
    }
  };

  //Function to get the translated text according to selected language (lang)
  const { translateText } = useLanguageTranslation(language);

  //----------------------------------
  // UI LOCAL STATE
  //----------------------------------
  const [isModalOpen, setIsModalOpen] = useState(false);
  // const prevAccountIdRef = useRef(targetAccountId);
  //-------------------------------------------
  //-------------------------------
  // RTA ACCOUNT DELETION HOOK
  //-------------------------------
  /*
1. 📊 Get Impact report, from backend and deliver affected accounts and adjustments.
2. 💣 Execute RTA deletion account upon user confirmation and deliver operation results.
3. 🗑️ Global State Sync. Remove target account from global store and update the UI.
Flow: TargetAccountId → Get impact report → Show to user → User confirmation → Execute Deletion → Update State→ Show Result
*/
  const {
    //Data and status from the GET request
    affectedAccountReport,
    isLoadingReport,
    reportError,

    //DELETE execution function
    executeRTAAnnulment,

    // Write States (DELETE Execution)
    isExecutingDeletion,
    deletionResult,
    fetchLoadError,
    resetDeletionState, // ⬅️ Retorna la función de reset
    //Required parameters,
    // ...rest
  } = useRTAImpactAndDeletion(targetAccountId, targetAccountName);
  //----------------------------------
  // 🎯 DETERMINE PRE/POST OPERATION
  //----------------------------------
  const isPostOperation = deletionResult || fetchLoadError;
  // console.log("🚀 ~ AccountDeletionPage ~ isPostOperation:", isPostOperation)

  //---------------------------------------
  //-----
  // console.log('',
  //  {affectedAccountReport},
  //  {isLoadingReport},
  //   // reportError,
  //   // executeRTAAnnulment,
  //   // isExecutingDeletion,
  //   // deletionResult,
  //   // fetchLoadError,
  //   targetAccountId, targetAccountName,targetAccountType,
  //   targetAccountBalance,
  //   targetAccountCurrency,
  //   // resetDeletionState,
  //   {rest}
  // )
  // console.log(previousRoute, accountId, {accountData} );
  // ==================================
  // 🧠 CENTRAL STATE PROCESSING
  // Transforms raw hook states into UI states
  // ==================================
  const { mainStatusFromParent, modalMessage } = useMemo(() => {
    //INITIAL VALUES
    let modalStatus: ModalStatusType = 'idle';
    let message = translateText('clickToConfirm');
    let finalSuccess = '';

    //🎯 CRITICAL PRIORITY ORDER
    //1. EXECUTING has highest priority
    if (isExecutingDeletion) {
      modalStatus = 'executing';
      message = translateText('processing');
    }
    //2. ERROR if not executing
    else if (fetchLoadError) {
      modalStatus = 'error';
      message = fetchLoadError;
      console.log({ fetchLoadError });
    }
    //3. SUCCESS if no error and is not executing
    else if (deletionResult) {
      modalStatus = 'success';
      message = deletionResult.message;
      finalSuccess = deletionResult.message;
      // console.log({deletionResult})
    }

    // 🎯 SPECIAL CASE: Show previous error in idle state for retry
    // This allows users to see and retry failed operations
    if (
      isModalOpen &&
      !deletionResult &&
      fetchLoadError &&
      modalStatus === 'idle'
    ) {
      message = fetchLoadError;
      console.log('when this happens?');
    }

    return {
      mainStatusFromParent: modalStatus,
      modalMessage: message,
      finalSuccessMessage: finalSuccess,
    };
  }, [
    deletionResult,
    fetchLoadError,
    isExecutingDeletion,
    isModalOpen,
    translateText,
  ]);

  // ===================
  // 🎯 EVENT HANDLERS
  // ===================
  const handleModalConfirm = useCallback(() => {
    executeRTAAnnulment();
  }, [executeRTAAnnulment]);

  const handleModalClose = () => {
    setIsModalOpen(false);
  };
  const handleBackToAccountingDashboard = useCallback(() => {
    console.log('🔙 Navigating back to actions with reset');
    // 🎯 1. Reset hook states (DELETE execution states)
    if (resetDeletionState) {
      resetDeletionState();
    }

    // 🎯 2. Reset page UI states
    setIsModalOpen(false);

    // 🎯 3. Navigate back
    const targetRoute = previousRoute || '/fintrack/tracker/accounting';
    navigateTo(targetRoute);
  }, [resetDeletionState, previousRoute, navigateTo]);

  // =============================
  // 🎯 CONTENT RENDERING LOGIC
  // (Dynamic rendering)
  // =============================
  const renderReportContent = () => {
    //Loading state
    if (isLoadingReport) {
      return <LoadingReportUI language={language} />;
    }

    //Error state
    if (reportError) {
      // console.log({reportError})
      return <ReportErrorUI errorMessage={reportError} t={translateText} />;
    }

    //No impact REPORT
    if (affectedAccountReport.length === 0) {
      console.log('no report');
      return <NoImpactReportUI t={translateText} />;
    }

    //Impact REPORT exists
    return <ImpactReportUI report={affectedAccountReport} t={translateText} />;
  };

  //Get report title depending on report content
  const getReportTitle = () => {
    if (affectedAccountReport.length === 0) {
      return translateText('reportTitleNoImpact');
    }
    return translateText('reportTitleWithImpact');
  };

  // =====================
  // 🎯 MAIN RENDER
  // Structural rendering
  // =====================
  return (
    <div className='account-deletion-page'>
      {/* 🎯 PAGE HEADER */}
      <header className='page-header '>
        <Link
          to={previousRoute}
          className='header-back-button .iconArrowLeftDark'
          style={{ color: 'black' }}
        >
          <LeftArrowDarkSvg />
        </Link>

        <h1 className='page-title'>{translateText('pageTitle')}</h1>

        {/* <div className="header-placeholder" />  */}
        {/* 🎯 LANGUAGE SELECTOR */}
        <div className='language-selector'>
          <select
            className='language-dropdown'
            aria-label={language === 'es' ? 'Español' : 'English'}
            name='language'
            id='language'
            onChange={(e) => changeLanguage(e.target.value as LanguageKeyType)}
            value={language}
          >
            <option value='es'>Español</option>
            <option value='en'>English</option>
          </select>
        </div>
      </header>

      {/* 🎯 CONDITIONAL RENDERING - POST-OPERATION VIEW */}
      {isPostOperation ? (
        // 🎯 POST-OPERATION VIEW (Success or Error)
        <PostOperationView
          t={translateText}
          result={deletionResult ? 'success' : 'error'}
          data={deletionResult || fetchLoadError || ''}
          originalAccount={{
            targetAccountId,
            targetAccountName,
            targetAccountType,
            targetAccountBalance,
            targetAccountCurrency,
          }}
          affectedAccounts={affectedAccountReport}
          onBackToActions={handleBackToAccountingDashboard}
        />
      ) : (
        // 🎯 PRE-OPERATION VIEW (Existing content)
        <>
          {/* 🎯 ACCOUNT DETAILS SECTION */}
          <AccountDetailsUI
            accountId={targetAccountId}
            accountName={targetAccountName}
            accountType={targetAccountType}
            accountBalance={targetAccountBalance}
            accountCurrency={targetAccountCurrency}
            t={translateText}
            // showStatusIndicator
          />

          {/* 🎯 MAIN CONTENT AREA */}
          <main className='main-content '>
            <h2 className='content-title'>{getReportTitle()}</h2>

            {/* 🎯 DYNAMIC CONTENT */}
            {renderReportContent()}

            {/* 🎯 ACTION BUTTON (only if report is loaded successfully) */}
            {!isLoadingReport && !reportError && (
              <div className='action-section '>
                <ProceedButtonUI
                  onClick={() => setIsModalOpen(true)}
                  t={translateText}
                  disabled={isExecutingDeletion}
                />
              </div>
            )}
          </main>
        </>
      )}

      {/* 🎯 CONFIRMATION MODAL */}
      <RTAConfirmationModal
        t={translateText}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
        mainStatusFromParent={mainStatusFromParent}
        message={modalMessage}
        affectedAccountsReportCount={affectedAccountReport.length}
      />
    </div>
  );
};
