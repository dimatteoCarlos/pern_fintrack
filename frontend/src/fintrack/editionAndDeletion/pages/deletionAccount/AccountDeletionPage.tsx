//frontend/src/editionAndDeletio/pages/deletionAccount/AccountDeletionPage.tsx
import './accountDeletionPage.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  defaultLanguage,
  isLanguageTypeValid,
  LanguageKeyType,
  languages,
} from '../../utils/languages.ts';
import { ModalStatusType } from '../../types/deletionTypes.ts';
import { AccountListType } from '../../../types/responseApiTypes.ts';

import { useLanguageTranslation } from '../../hooks/useLangTranslation.ts';
import { useRTAImpactAndDeletion } from '../../hooks/useRTAImpactAndDeletion.ts';
import { useCloseAccount } from '../../hooks/useCloseAccount.ts';

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
import { SoftDeactivateAccountUI } from './UIComponents/softDeletionUI/SoftDeactivateAccountUI.tsx';
import { HardDeleteConfirmationUI } from './UIComponents/hardDeletionUI/HardDeleteConfirmationUI.tsx';
import { CloseAccountUI } from './UIComponents/closeAccountUI/CloseAccountUI.tsx';
import { CLOSE_IS_THE_ONLY_METHOD } from '../../config/deletionMethodPolicy.ts';
// Where a reader with no navigation state belongs. Named once so the guard
// below and the back navigation cannot disagree about it.
const ACCOUNTING_DASHBOARD_ROUTE = '/fintrack/tracker/accounting';

type AccountDeletionViewPropType = {
  accountData: AccountListType;
  previousRoute: string;
};

// =======================================
// 🖥️ MAIN COMPONENT: AccountDeletionPage
// =======================================
const AccountDeletionView = ({
  accountData,
  previousRoute,
}: AccountDeletionViewPropType) => {
  const navigateTo = useNavigate();
  //GET ACCOUNT INFO: from params
  const { accountId } = useParams();

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
  // Independent of the RTA modal above: SOFT and HARD are two more triggers
  // this same page now offers (ACCOUNT_DELETION_METHODS.md §6), neither
  // reads the RTA impact report and neither shares its open/close state.
  const [isSoftModalOpen, setIsSoftModalOpen] = useState(false);
  const [isHardModalOpen, setIsHardModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  // Whether the account-relations section is expanded. It also decides whether
  // the report is fetched at all: the section is closed on arrival, so an
  // owner who never opens it never pays for the request.
  const [isRelationsOpen, setIsRelationsOpen] = useState(false);
  // const prevAccountIdRef = useRef(targetAccountId);
  //-------------------------------------------
  //----------------------------------
  // 🎯 WHETHER THE ANNULMENT IS STILL OFFERED
  //
  // The screen offers CLOSE alone, and CLOSE refuses an account that still
  // holds a balance - so on such an account its single button could only say
  // no, and the method that brings a balance to zero would be the one method
  // the screen does not show. The owner ruled on 2026-09-08 that the
  // annulment comes back for exactly that case.
  //
  // Read from the close preview and not from the account's stored balance:
  // the preview returns the figure the engine derives its own refusal from,
  // and the stored column is a different number.
  //
  // Both a loading preview and a failed one leave the annulment hidden. A
  // preview that has not answered is not evidence of a balance, and showing
  // the annulment on that guess would flash a whole section in and out of the
  // page while the request is in flight.
  //----------------------------------
  const close = useCloseAccount(targetAccountId);

  const isBalanceBlockingTheClose =
    !close.isLoadingPreview &&
    !close.previewError &&
    close.residual !== null &&
    !close.canClose;

  // THE REVERSAL ROUTE LEAVES THE SCREEN, 2026-09-08 (Carlos). CLOSE requires a
  // zero balance and settles nothing; a balance that blocks it is resolved
  // outside CLOSE, and the notice below is the official path. The route that
  // rewrote other accounts' history is not the answer to a non-zero balance.
  //
  // ONE SWITCH, NOT SIX EDITS. Everything the route put on screen already hung
  // off this flag - the projection columns, the section title, the note and the
  // button - so turning it off removes all of them together and turning it back
  // on restores them together. isBalanceBlockingTheClose stays live: the blocked
  // notice reads it directly and is what the owner keeps.
  //
  // WHAT REPLACES IT is not this route. The operation being designed is
  // "reverse the balance and close": FinTrack computes -currentBalance, the
  // owner chooses nothing, and it runs BEFORE close rather than instead of it.
  // When it exists it reuses these same components - ProceedButtonUI for its
  // button, ImpactReportUI for the related-accounts panel - which is why none
  // of them is deleted here.
  //
  // const isAnnulmentOffered =
  //   !CLOSE_IS_THE_ONLY_METHOD || isBalanceBlockingTheClose;
  const isAnnulmentOffered: boolean = false;

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
    totalNetAdjustmentAmount,
    unattributedAmount,
    unattributedTransactionCount,
    pocketImpact,
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
  } = useRTAImpactAndDeletion(
    targetAccountId,
    targetAccountName,
    isRelationsOpen,
  );

  //----------------------------------
  // 🎯 DETERMINE PRE/POST OPERATION
  //----------------------------------
  // Both come from the RTA annulment, and neither can come from the close,
  // which reports through its own hook and navigates away. Gated so a failed
  // impact request cannot replace the close screen with an error view for an
  // operation the owner never started.
  const isPostOperation = isAnnulmentOffered && (deletionResult || fetchLoadError);
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
    navigateTo(previousRoute);
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
   //---------------------------
   // console.log('report:', affectedAccountReport)
   //---------------------------
   //No impact REPORT
    if (affectedAccountReport.length === 0) {
     // console.log('no report');
      return (
        <NoImpactReportUI
          isProjectionShown={isAnnulmentOffered}
          t={translateText}
        />
      );
    }

    //Impact REPORT exists
    return (
      <ImpactReportUI
        report={affectedAccountReport}
        totalNetAdjustmentAmount={totalNetAdjustmentAmount}
        unattributedAmount={unattributedAmount}
        unattributedTransactionCount={unattributedTransactionCount}
        isProjectionShown={isAnnulmentOffered}
        t={translateText}
      />
    );
  };

  //Get report title depending on report content
  const getReportTitle = () => {
    // The annulment's two titles both announce an impact, which is the right
    // word only while the annulment is the operation on offer. Under CLOSE the
    // section is information about the account and says so.
    if (!isAnnulmentOffered) {
      return translateText('relatedAccountsHeading');
    }
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

        <h1 className='page-title'>
          {translateText(
            CLOSE_IS_THE_ONLY_METHOD ? 'closeOnlyPageTitle' : 'pageTitle',
          )}
        </h1>

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
            actionKey={
              CLOSE_IS_THE_ONLY_METHOD ? 'closeAccountAction' : 'rtaDeletionAction'
            }
            titleKey={
              CLOSE_IS_THE_ONLY_METHOD
                ? 'closeOnlyDetailsTitle'
                : 'accountDetailsTitle'
            }
            t={translateText}
            // showStatusIndicator
          />

          {/* WHICH ACCOUNTS THIS ONE IS ENTANGLED WITH, as information about
              the account rather than as a step in an operation. It sits under
              the account card for that reason, and above the method, because
              it is something to read before choosing.

              CLOSED ON ARRIVAL, AND THAT IS WHAT MAKES IT FREE. The report is
              a request, and gating the fetch on the section being open means
              an owner who does not ask for it never pays for it.

              THE COLUMNS BELONG TO THE ANNULMENT, NOT TO THE CLOSE. New
              balance and net adjustment are a projection of what annulling
              this account would do to each row; the close changes none of
              them. The note inside says so, because a table headed "new
              balance" on a close screen would otherwise read as the close's
              own consequence. */}
          <details
            className='account-relations'
            onToggle={(event) =>
              setIsRelationsOpen(event.currentTarget.open)
            }
          >
            <summary className='account-relations__summary'>
              {translateText('relatedAccountsSummary')}
            </summary>

            <div className='account-relations__body'>
              {isAnnulmentOffered && (
                <p className='account-relations__note'>
                  {translateText('relatedAccountsNote')}
                </p>
              )}

              <h3 className='content-title'>{getReportTitle()}</h3>

              {renderReportContent()}

            </div>
          </details>

          {/* 🎯 THE METHODS THIS SCREEN OFFERS. One of them today,
              CLOSE, by the owner's instruction of 2026-09-08
              (deletionMethodPolicy.ts); three of them when that flag is off,
              none described by the impact report below.

              ABOVE THE REPORT, NOT UNDER IT. The report is one method's
              consequences, not the page's subject, and its table is as long as
              the data - thirteen affected accounts push anything beneath it
              more than a screen down, which is where the owner could not find
              the close button on 2026-09-08. The choice of method precedes the
              report that describes one of them
              (ACCOUNT_DELETION_METHODS.md §6). */}
          <section className='deletion-methods-section'>
            <h2 className='deletion-methods-title'>
              {translateText(
                CLOSE_IS_THE_ONLY_METHOD
                  ? 'closeOnlySectionTitle'
                  : 'otherMethodsSectionTitle',
              )}
            </h2>
            <p className='deletion-methods-description'>
              {translateText(
                CLOSE_IS_THE_ONLY_METHOD
                  ? 'closeOnlySectionDescription'
                  : 'otherMethodsSectionDescription',
              )}
            </p>
            {/* Why the only button on this screen will refuse, said before it
                is pressed, and where the method that fixes it now is. */}
            {isBalanceBlockingTheClose && (
              <p className='deletion-methods-blocked' role='note'>
                {translateText('closeOnlyBlockedNotice')}
              </p>
            )}

            {/* THE OTHER ROUTE, directly under the notice that says why it is
                here. It used to sit inside the account-relations section,
                which the owner asked to be information about the account -
                and it sat above this notice, so the button arrived before its
                reason. Offered only while the balance refuses the close. */}
            {isAnnulmentOffered && !isLoadingReport && !reportError && (
              <div className='action-section'>
                <ProceedButtonUI
                  onClick={() => setIsModalOpen(true)}
                  t={translateText}
                  disabled={isExecutingDeletion}
                  variant='secondary'
                />
              </div>
            )}

            <div className='deletion-methods-actions'>
              {!CLOSE_IS_THE_ONLY_METHOD && (
                <button
                  type='button'
                  className='deletion-method-button deletion-method-button--soft'
                  onClick={() => setIsSoftModalOpen(true)}
                  aria-label={translateText('softDeactivateTriggerButton')}
                >
                  {translateText('softDeactivateTriggerButton')}
                </button>
              )}
              <button
                type='button'
                className={`deletion-method-button deletion-method-button--close${
                  CLOSE_IS_THE_ONLY_METHOD
                    ? ' deletion-method-button--only'
                    : ''
                }`}
                onClick={() => setIsCloseModalOpen(true)}
                aria-label={translateText('closeAccountTriggerButton')}
              >
                {translateText('closeAccountTriggerButton')}
              </button>
              {!CLOSE_IS_THE_ONLY_METHOD && (
                <button
                  type='button'
                  className='deletion-method-button deletion-method-button--hard'
                  onClick={() => setIsHardModalOpen(true)}
                  aria-label={translateText('hardDeleteTriggerButton')}
                >
                  {translateText('hardDeleteTriggerButton')}
                </button>
              )}
            </div>
          </section>

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
        pocketImpact={pocketImpact}
      />

      {/* 🎯 SOFT DEACTIVATION - reversible, no impact report */}
      <SoftDeactivateAccountUI
        t={translateText}
        isOpen={isSoftModalOpen}
        targetAccountId={targetAccountId}
        targetAccountName={targetAccountName}
        onClose={() => setIsSoftModalOpen(false)}
        onDeactivated={handleBackToAccountingDashboard}
      />

      {/* 🎯 CLOSE - the account row goes, its identity stays in the registry.
          Placed between SOFT and HARD because that is where it sits in cost:
          reversible deactivation, then closure that keeps the history, then
          erasure that keeps none of it. */}
      <CloseAccountUI
        t={translateText}
        isOpen={isCloseModalOpen}
        targetAccountId={targetAccountId}
        targetAccountName={targetAccountName}
        targetAccountType={targetAccountType}
        close={close}
        onClose={() => setIsCloseModalOpen(false)}
        onClosed={handleBackToAccountingDashboard}
      />

      {/* 🎯 HARD DELETE - permanent, no reversal of the impact on counterparties */}
      <HardDeleteConfirmationUI
        t={translateText}
        isOpen={isHardModalOpen}
        targetAccountId={targetAccountId}
        targetAccountName={targetAccountName}
        onClose={() => setIsHardModalOpen(false)}
        onErased={handleBackToAccountingDashboard}
      />
    </div>
  );
};

// The route is only ever entered from an account's actions menu, which carries
// the account in location.state. A reload carries none, so this sends the
// reader back to the dashboard instead of throwing on the destructure. It is a
// separate component and not an early return inside the view: the view's hooks
// must not be skipped on the pass that redirects.
export const AccountDeletionPage = () => {
  const location = useLocation();
  const state = location.state as Partial<AccountDeletionViewPropType> | null;

  if (!state?.accountData) {
    return <Navigate to={ACCOUNTING_DASHBOARD_ROUTE} replace />;
  }

  return (
    <AccountDeletionView
      accountData={state.accountData}
      previousRoute={state.previousRoute ?? ACCOUNTING_DASHBOARD_ROUTE}
    />
  );
};

export default AccountDeletionPage
