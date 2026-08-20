// frontend/src/edition/pages/forms/editAccount/EditAccount.tsx

// 🎯 IMPORTS - REACT, ROUTING, EXTERNAL DEPENDENCIES AND TYPES
import { ZodType } from 'zod';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';

// 📚 HOOKS AND STORES - CUSTOM REACT HOOKS AND STATE MANAGEMENT
import { useAccountStore } from '../../../stores/useAccountStore.ts';
import { useBudgetStatusStore } from '../../../stores/useBudgetStatusStore.ts';
import { notifyAccountChanged } from '../../../stores/transactionEvents.ts';
import { useFetch } from '../../../hooks/useFetch.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';
import {
  GenericEditFormData,
  useEditAccountForm,
} from '../../hooks/useEditAccountForm.ts';

// 📦 TYPES AND LOGIC- TYPE SAFETY DEFINITIONS
import {
  AccountByTypeResponseType,
  AccountListType,
} from '../../../types/responseApiTypes.ts';
import {
  BudgetAccountStatus,
  BudgetErrorResponse,
  BudgetWriteRequest,
} from '../../../types/budgetTypes.ts';
import { ValidationMessagesType } from '../../../validations/types.ts';
import { DropdownOptionType } from '../../../types/types.ts';

// ⚙️ VALIDATION CONFIG - FORM SCHEMAS AND FIELD DEFINITIONS
import {
  ACCOUNT_EDIT_SCHEMA_CONFIG,
  FieldConfigType,
} from '../../validations_zod/accountEditSchema.ts';
import { accountTypeEditSchemas } from '../../validations_zod/editSchemas.ts';
import { validateForm } from '../../../validations/utils/zod_validation.ts';

// 🌐 API ENDPOINTS - BACKEND URL CONFIGURATION
import {
  url_get_account_details_by_id_for_edition,
  url_patch_account_edit,
} from '../../../../urlConfig.ts';
// Sits outside pages/: the account editor and the budget page are in
// different trees (budgetApi.ts's own header).
import { getBudgetAccountsStatus, setCurrentBudget } from '../../../api/budgetApi.ts';

// 🧱 UI COMPONENTS - REUSABLE PRESENTATION COMPONENTS
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import UniversalDynamicInput from './UniversalDynamicInput.tsx';
import SummaryDetailBox from '../../../pages/forms/accountDetailSharedComponents/summaryDetailBox/SummaryDetailBox.tsx';
import BudgetEditModal from '../../../pages/budget/components/budgetEditModal/BudgetEditModal.tsx';

// 🎨 ASSETS AND STYLES - VISUAL RESOURCES AND CSS
import LeftArrowSvg from '../../../../assets/LeftArrowSvg.svg';
// '?react' and not a bare import: a bare .svg is typed `string` and cannot
// take a className (R34).
import EditSvg from '../../../../assets/pencil02Svg.svg?react';

import '../../../pages/forms/styles/forms-styles.css';
import './styles/editAccount-styles.css';

// 🔧 UTILITIES - DATE PARSING AND DATA TRANSFORMATION

import { parsePostgresDate } from '../../utils/dateUtils.ts';
import { normalizeBudgetError } from '../../../helpers/normalizeBudgetError.ts';
import { formatBudgetMonthLabel } from '../../../helpers/functions.ts';
// import { debounce } from '../../utils/debounce.ts';
//----------------------------
// 🛠️ INTERNAL UTILITY - VALUE COMPARISON (KISS)
const areValuesEqual = (a: unknown, b: unknown): boolean => {
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  return a === b;
};

// 📋 Local State generic type data of edition Form /Tipo de datos genérico para el formulario de edición (para estados locales)
// type GenericEditFormData = {
//  [key: string]: string | number | boolean | Date | null | undefined;
// };

// ===========================
// 🏦 MAIN COMPONENT
// 🏗️ ACCOUNT EDITING FORM PAGE
// ===========================
export function EditAccount(): JSX.Element {
  // 🧭 ROUTING AND NAVIGATION - URL PARAMETERS AND NAVIGATION
  const { accountId } = useParams<{ accountId: string }>();
  const navigateTo = useNavigate();
  const location = useLocation();
  const previousRoute =
    location.state?.previousRoute || '/fintrack/tracker/accounting'; // fallback

  // 🗄️ GLOBAL STATE - ACCOUNT STORE FOR DATA PERSISTENCE
  const { updateAccount } = useAccountStore();

  //2. 📥 DATA FETCHING OF ACCOUNT BY ACCOUNTID FROM API
  const fetchUrl = accountId
    ? `${url_get_account_details_by_id_for_edition}${accountId}`
    : null;

  const {
    apiData,
    isLoading: isFetching,
    error: fetchError,
    refetch: refetchAccount,
  } = useFetch<AccountByTypeResponseType>(fetchUrl);

  const accountData = apiData?.data?.accountList[0];

  //3.📤 API MUTATION - SAVE UPDATED ACCOUNT DATA
  const mutationUrl = accountId ? `${url_patch_account_edit}/${accountId}` : '';
  const {
    isLoading: isSaving,
    error: saveError,
    requestFn,
  } = useFetchLoad<AccountListType, GenericEditFormData>({
    url: mutationUrl,
    method: 'PATCH',
  });

  //4.⚙️ LOCAL STATES
  // 📢 USER FEEDBACK - SUCCESS/ERROR MESSAGES STATE
  const [userMessage, setUserMessage] = useState<
    { message: string; status: number } | undefined
  >(undefined);

  // 🔍 ACCOUNT TYPE IDENTIFICATION - DETERMINE FORM CONFIGURATION
  const accountType = accountData ? accountData.account_type_name : null;
  // console.log('apiData', {accountData})
  // console.log("🚀 ~ EditAccount ~ accountType:", accountType)
  // console.log("🚀 ~ EditAccount ~ requestFn data:", data)

  //5.⚙️ ZOD SCHEMA CONFIGURATION
  // ⚙️ DYNAMIC CONFIGURATION - FORM FIELDS BASED ON ACCOUNT TYPE
  const accountFields = useMemo(() => {
    if (!accountType) return []; //que pasa si esto occure?
    const fields =
      ACCOUNT_EDIT_SCHEMA_CONFIG[
        accountType as AccountListType['account_type_name']
      ] || [];
    // console.log("🚀 ~ EditAccount ~ fields:", fields)
    if (!fields) {
      console.error(
        `Error: Account type '${accountType}' not found in ACCOUNT_EDIT_SCHEMA_CONFIG.`,
      );
      return [];
    }
    return fields;
  }, [accountType]);

  // 📜 VALIDATION SCHEMA - ZOD SCHEMA FOR CURRENT ACCOUNT TYPE
  const schema: ZodType<GenericEditFormData> | null = useMemo(
    () =>
      accountType
        ? (accountTypeEditSchemas[
            accountType as AccountListType['account_type_name']
          ] as ZodType<GenericEditFormData>)
        : null,
    [accountType],
  );
  // console.log("🚀 ~ EditAccount ~ schema:", schema)

  // 🧠 FORM STATE MANAGEMENT - HOOK FOR FORM DATA AND VALIDATION
  const {
    formData,
    setFormData,
    validationMessages,
    setValidationMessages,
    runFieldValidation,
  } = useEditAccountForm(schema);

  // 🔄 SYNCHRONOUS UPDATE ENGINE - UNIFIED FIELD UPDATE WITH DERIVED CALCULATION
  const updateFormAndDerivatives = useCallback(
    (
      name: string,
      value: string | number | boolean | Date | null | undefined,
    ) => {
      // 1. INCREMENTAL UPDATE - APPLY USER CHANGE TO FORM DATA
      const newData = { ...formData, [name]: value };
      const derivedUpdates: Partial<GenericEditFormData> = {};

      // 2. DERIVED FIELD COMPUTATION - CALCULATE DERIVED VALUES
      accountFields.forEach((field) => {
        if (field.isDerived && typeof field.compute === 'function') {
          const calculatedValue = field.compute(
            newData as Record<string, unknown>,
          );
          if (!areValuesEqual(calculatedValue, formData[field.fieldName])) {
            derivedUpdates[field.fieldName] =
              calculatedValue as GenericEditFormData[keyof GenericEditFormData];
          }
        }
      });
      // });//updateFormAndDerivatives

      // 3. FINAL STATE MERGING - COMBINE USER AND DERIVED DATA
      const finalData = {
        ...newData,
        ...derivedUpdates,
      } as GenericEditFormData;
      setFormData(finalData);
      // console.log({finalData}, {name, value,})

      // 4. REAL-TIME VALIDATION - VALIDATE CHANGED AND DERIVED FIELDS
      runFieldValidation(name, value, finalData);

      Object.entries(derivedUpdates).forEach(([fName, fVal]) => {
        runFieldValidation(fName, fVal, finalData);
      });

      // 5. USER FEEDBACK RESET - CLEAR PREVIOUS MESSAGES ON INTERACTION
      setUserMessage(undefined);
    },
    [formData, accountFields, runFieldValidation, setFormData],
  );

  // 🚀 INITIAL DATA LOADING - SYNC API RESPONSE TO FORM STATE
  useEffect(() => {
    if (accountData && accountFields.length > 0) {
      const initialData: GenericEditFormData = {} as GenericEditFormData;
      accountFields.forEach((field: FieldConfigType) => {
        const key = field.fieldName as keyof typeof accountData;
        const val = accountData[key];

        if (val !== undefined) {
          // 🗓️ DATE FIELD HANDLING - SPECIAL PARSING FOR DATE FIELDS
          initialData[field.fieldName] =
            field.fieldName === 'desired_date' && typeof val === 'string'
              ? parsePostgresDate(val)
              : (val as GenericEditFormData[keyof GenericEditFormData]);
        }
      });
      setFormData(initialData);
    }
  }, [accountData, accountFields, setFormData]);

  // 🎮 INPUT HANDLER FACTORIES - HIGHER-ORDER FUNCTIONS FOR FIELD TYPES
  const handleTextChange = useCallback(
    (fieldName: string) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        updateFormAndDerivatives(fieldName, e.target.value);
      },
    [updateFormAndDerivatives],
  );

  const handleDropdownChange = useCallback(
    (fieldName: string) => (option: DropdownOptionType | null) => {
      updateFormAndDerivatives(fieldName, option ? option.value : '');
    },
    [updateFormAndDerivatives],
  );

  const handleDateChange = useCallback(
    (fieldName: string) => (date: Date) => {
      updateFormAndDerivatives(fieldName, date);
    },
    [updateFormAndDerivatives],
  );

  // 📤 FORM SUBMISSION HANDLER - VALIDATION AND API CALL
  const onSubmitForm = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!accountType) {
      console.error('Submission failed: account type is not defined.');
      return;
    } //deberia dar un mensaje
    // console.log('formData', formData)
    //handling null schema
    if (!schema) {
      console.error('Submission failed: Zod schema is not defined.');
      return; //que se debe hace?
    }

    // ✅ FINAL VALIDATION - COMPREHENSIVE FORM VALIDATION BEFORE SUBMIT
    const { errors, data: validatedData } = validateForm(schema, formData); //recordar que devuelve

    if (Object.keys(errors).length > 0) {
      // ❌ VALIDATION FAILURE - DISPLAY ERRORS AND BLOCK SUBMISSION
      setValidationMessages(
        errors as ValidationMessagesType<GenericEditFormData>,
      );
      console.log({ errors });

      setUserMessage({ message: 'Please fix validation errors', status: 400 });
      return; //deberia mostrar los mensajes de error al usuario
    }
    // console.log("🚀 ~ onSubmitForm ~ validatedData:", validatedData)

    if (!validatedData) return; //what message to show?.

    // 📦 PAYLOAD PREPARATION - ADD ACCOUNT TYPE FOR BACKEND PROCESSING

    const payloadToSend = {
      ...validatedData,
      type: accountType, //edtion controller need this
    };
    // console.log("🚀 ~ onSubmitForm ~ payloadToSend:", payloadToSend)

    const result = await requestFn(payloadToSend as GenericEditFormData, {});
    // console.log("🚀 ~ onSubmitForm ~ result after edition:", result)

    if (result.data) {
      // ✅ SUCCESS FLOW - UPDATE GLOBAL STATE AND NAVIGATE
      updateAccount(result.data); // update and syncronize with accounting dashboard
      // Announced, not invalidated directly: this screen has no business
      // knowing which caches hold an answer this write made stale. The budget
      // block does its own invalidate() for the amount; this covers a rename, a
      // category change or a nature change, which the amount path never sees.
      notifyAccountChanged();
      setUserMessage({ message: 'Account updated successfully!', status: 200 });
      setTimeout(() => {
        navigateTo(previousRoute); //should be previous route
      }, 500);
    }
  };
  //---------------------------------
  const isFormDisabled = isFetching || isSaving || !accountData || !schema;
  const finalError = fetchError || saveError;

  // 💵 BUDGET BLOCK - category_budget ACCOUNTS ONLY
  // Replaces the bare amount field the PATCH used to carry (unit U1). Writes
  // through PUT /budget/accounts/:accountId/current instead, which is the
  // only door that can state an FX origin and a range.
  const isCategoryBudget = accountType === 'category_budget';
  const numericAccountId = accountId ? Number(accountId) : null;

  const [budgetAccountStatus, setBudgetAccountStatus] =
    useState<BudgetAccountStatus | null>(null);
  // The month the status above is about, as the server resolved it — never
  // read from useBudgetStatusStore's referenceMonth, which answers for
  // whatever month the budget screens have on screen, not this one.
  const [budgetReferenceMonth, setBudgetReferenceMonth] = useState<
    string | null
  >(null);
  const [isBudgetLoading, setIsBudgetLoading] = useState(false);
  const [budgetFetchError, setBudgetFetchError] = useState<string | null>(
    null,
  );
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [budgetSaveError, setBudgetSaveError] =
    useState<BudgetErrorResponse | null>(null);

  // No month argument: the server resolves the current one from the owner's
  // timezone, the same month the write path writes. [accountIds] scopes the
  // request to this one account instead of every budget account the user owns.
  const fetchBudgetAccountStatus = useCallback(async () => {
    if (!isCategoryBudget || numericAccountId === null) return;

    setIsBudgetLoading(true);
    setBudgetFetchError(null);

    try {
      const response = await getBudgetAccountsStatus([numericAccountId]);
      setBudgetAccountStatus(response.accounts[0] ?? null);
      setBudgetReferenceMonth(response.referenceMonth);
    } catch (err: unknown) {
      setBudgetFetchError(
        err instanceof Error ? err.message : 'Failed to load the budget.',
      );
    } finally {
      setIsBudgetLoading(false);
    }
  }, [isCategoryBudget, numericAccountId]);

  useEffect(() => {
    fetchBudgetAccountStatus();
  }, [fetchBudgetAccountStatus]);

  const closeBudgetEditor = () => {
    setIsEditingBudget(false);
    setBudgetSaveError(null);
  };

  // Does NOT close the modal on success, matching CategoryDetail.tsx's
  // caller: the modal decides whether a confirmation renders, and closing
  // here makes that branch unreachable.
  const handleSaveBudget = async ({
    amount,
    currency,
    month,
    appliesUntil,
  }: BudgetWriteRequest) => {
    if (numericAccountId === null) return null;

    setIsSavingBudget(true);
    setBudgetSaveError(null);

    try {
      const response = await setCurrentBudget(numericAccountId, {
        amount,
        currency,
        month,
        appliesUntil,
      });

      // This block's own copy is stale the moment the write lands; the
      // shared store's memo is invalidated too, so a budget screen opened
      // afterwards does not read what this write just replaced.
      await fetchBudgetAccountStatus();
      useBudgetStatusStore.getState().invalidate();

      return response;
    } catch (err: unknown) {
      setBudgetSaveError(normalizeBudgetError(err));
      return null;
    } finally {
      setIsSavingBudget(false);
    }
  };

  //-------------------------------
  // 🎨 PAGE RENDERING - MAIN COMPONENT UI STRUCTURE
  return (
    <>
      <section className='page__container'>
        {/* 🔝 PAGE HEADER - NAVIGATION AND VISUAL SPACING */}
        <TopWhiteSpace variant={'dark'} />

        <div className='page__content'>
          {/* 🔙 NAVIGATION HEADER - BACK LINK WITH ICON AND TITLE */}
          <Link
            to={previousRoute}
            className='form__header main__title--container '
          >
            <div className='form__header--icon iconLeftArrow'>
              {<LeftArrowSvg />}
            </div>
            <div className='form__title'>{'Edit Account'}</div>
          </Link>

          {/* 📋 FORM CONTENT — loading, error and empty are three states, not
              two paragraphs. The colours used to be written inline, in yellow
              and red, which are not tokens and are not the app's palette.

              A skeleton and not a sentence: the form is a known shape, so the
              wait can state that shape instead of describing itself. */}
          {isFetching && (
            <div className='editAccount__formSkeleton' aria-hidden='true'>
              <span className='editAccount__skeletonField' />
              <span className='editAccount__skeletonField' />
              <span className='editAccount__skeletonField' />
              <span className='editAccount__skeletonField' />
            </div>
          )}

          {/* A message and a way out. Without the retry the screen was a dead
              end: the only recovery was a manual reload, which also loses the
              route the editor was opened from. */}
          {!isFetching && fetchError && (
            <div className='editAccount__fetchError' role='alert'>
              <p className='editAccount__fetchErrorText'>
                The account could not be loaded: {fetchError}
              </p>
              <button
                type='button'
                className='editAccount__retry'
                onClick={refetchAccount}
              >
                Retry
              </button>
            </div>
          )}

          {/* Answered, and there is nothing there. Distinct from the error
              above: the request succeeded, the id just names no account of
              this user. */}
          {!isFetching && !fetchError && !accountData && (
            <p className='editAccount__emptyState'>
              This account no longer exists, or it is not yours to edit.
            </p>
          )}

          {/* The account exists but the module has no field list for its type.
              A configuration gap, not a fetch state — it keeps its own line. */}
          {!isFetching && accountType && accountFields.length === 0 && (
            <p className='editAccount__emptyState'>
              This account type cannot be edited yet: {accountType}
            </p>
          )}

          {/* 💵 BUDGET BLOCK — above the form, not under it.
              Save Changes has to be the last thing on the page, because a
              submit button that leaves editable content below it reads as
              saving that content too — and this block is written by a
              different endpoint, on a different user action.

              It is also where the reader already knows to look for it:
              CategoryDetail puts the same SummaryDetailBox with the same
              pencil above its own fields.

              Three fetch states of its own: a skeleton while the status is on
              the wire, a message and a retry if it fails, the figures once it
              lands. */}
          {isCategoryBudget && (
            <div className='editAccount__budgetBlock'>
              {isBudgetLoading && !budgetAccountStatus && (
                <div
                  className='editAccount__budgetSkeleton'
                  aria-hidden='true'
                />
              )}

              {!isBudgetLoading && budgetFetchError && !budgetAccountStatus && (
                <div className='editAccount__budgetError'>
                  <p className='error-message'>
                    Could not load the budget: {budgetFetchError}
                  </p>
                  <button
                    type='button'
                    className='editAccount__budgetRetry'
                    onClick={fetchBudgetAccountStatus}
                  >
                    Retry
                  </button>
                </div>
              )}

              {budgetAccountStatus && (
                <>
                  {/* Which month these figures are about — and only that.
                      The account is named once on this screen, by the
                      subcategory field of the form below, which is also where
                      it is edited. A second copy up here would state the saved
                      name while the field states the one being typed: the same
                      fact twice, disagreeing, for as long as the edit lasts.

                      A label and NOT a picker. This screen writes the current
                      month and only the current one, so a control offering
                      another would let the reader pick a month the save cannot
                      land on: the server refuses a future one outright, and no
                      screen in the app offers writing a past one — level 2
                      disables its own pencil below the current month. Reaching
                      forward is expressed by the modal's appliesUntil, not by
                      moving this anchor.

                      Unlabelled it was worse than absent: a reader arriving
                      from May on the budget screen had nothing telling them
                      these are this month's figures. */}
                  <div className='editAccount__budgetCaption'>
                    <span className='editAccount__budgetMonth'>
                      {formatBudgetMonthLabel(budgetReferenceMonth)}
                    </span>
                  </div>

                  <SummaryDetailBox
                    bubleInfo={{
                      title: 'Budget',
                      amount: budgetAccountStatus.budgetAmount,
                      subtitle1: 'Spent',
                      amount1: budgetAccountStatus.actualSpent,
                      status: budgetAccountStatus.isOverBudget,
                      amount2: budgetAccountStatus.remainingBudget,
                      currency_code: budgetAccountStatus.currency,
                      executionPercentage:
                        budgetAccountStatus.executionPercentage,
                    }}
                    action={
                      <button
                        type='button'
                        className='editAccount__editBudgetBtn'
                        onClick={() => setIsEditingBudget(true)}
                        aria-label={`Edit budget for ${budgetAccountStatus.subcategory ?? budgetAccountStatus.accountName}`}
                        title='Edit budget'
                      >
                        <EditSvg />
                      </button>
                    }
                  />

                  {budgetAccountStatus.nextMonthBudget !==
                    budgetAccountStatus.budgetAmount && (
                    <div className='editAccount__budgetActions'>
                      <span
                        className='editAccount__budgetException'
                        title='This amount applies to this month only'
                      >
                        this month only
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* The account's own fields, and the button that writes them. Last on
              the page: what it submits ends here. */}
          {!isFetching && !!accountType && accountFields.length > 0 && (
            <form className='form__box'>
              <div className='form__input__group'>
                {/* 🎨 DYNAMIC RENDERING OF FORM */}
                <div className='form__container'>
                  {accountFields.map((fieldConfig) => (
                    <UniversalDynamicInput
                      key={fieldConfig.fieldName}
                      fieldConfig={fieldConfig as FieldConfigType}
                      formData={formData}
                      setFormData={setFormData}
                      validationMessages={validationMessages}
                      handleDropdownChange={handleDropdownChange}
                      handleDateChange={handleDateChange}
                      handleInputNumberChange={handleTextChange}
                      isReset={false}
                    />
                  ))}
                </div>
              </div>
              <div className='submit__btn__container'>
                <FormSubmitBtn
                  onClickHandler={onSubmitForm}
                  disabled={isFormDisabled || !accountId}
                >
                  Save Changes
                </FormSubmitBtn>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Mounted outside <section>: matches CategoryDetail's own panel, which
          is portalled and must not scroll with any frame under it. */}
      {isEditingBudget && budgetAccountStatus && (
        <BudgetEditModal
          accountName={
            budgetAccountStatus.subcategory ?? budgetAccountStatus.accountName
          }
          nature={budgetAccountStatus.nature}
          month={budgetReferenceMonth ?? ''}
          currency={budgetAccountStatus.currency}
          currentAmount={budgetAccountStatus.budgetAmount}
          nextMonthBudget={budgetAccountStatus.nextMonthBudget}
          actualSpent={budgetAccountStatus.actualSpent}
          remainingBudget={budgetAccountStatus.remainingBudget}
          executionPercentage={budgetAccountStatus.executionPercentage}
          isOverBudget={budgetAccountStatus.isOverBudget}
          isSaving={isSavingBudget}
          error={budgetSaveError}
          onClose={closeBudgetEditor}
          onSave={handleSaveBudget}
        />
      )}

      <section className='Toastify'>
        <MessageToUser
          isLoading={isSaving}
          error={finalError}
          messageToUser={userMessage}
          variant='form'
        />
      </section>
    </>
  );
}

export default EditAccount;
