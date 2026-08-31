//src/pages/tracker/expense/Expense.tsx
// ⚛️ REACT HOOKS AND react router dom
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosRequestConfig } from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

// 🔑 AUTHENTICATION HOOK
import useAuth from '../../../../auth/hooks/useAuth.ts';

// 🪝 CUSTOM HOOKS Y UTILS
import { useFetch } from '../../../hooks/useFetch.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';
import { useDebouncedCallback } from '../../../hooks/useDebouncedCallback.ts';

// ZUSTAND STORES
import { useBalanceStore } from '../../../stores/useBalanceStore.ts';
import { useBudgetStatusStore } from '../../../stores/useBudgetStatusStore.ts';
import { useTransactionDate } from '../../../hooks/useTransactionDate.ts';
import { notifyTransactionRecorded } from '../../../stores/transactionEvents.ts';
//---
// 🎨 UI COMPONENTS
import TopCard from '../components/TopCard.tsx';
import CardSeparator from '../components/CardSeparator.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import CoinSpinner from '../../../loader/coin/CoinSpinner.tsx';
//---
// 🌐ENDPOINTS AND CONSTANTS
import {
  url_get_accounts_by_type,
  url_get_total_account_balance_by_type,
  url_movement_transaction_record,
} from '../../../../urlConfig.ts';
import {
  ACCOUNT_OPTIONS_DEFAULT,
  CATEGORY_OPTIONS_DEFAULT,
  DEFAULT_CURRENCY,
  PAGE_LOC_NUM,
} from '../../../helpers/constants.ts';
//---
// 📝 DATA TYPE IMPORTS
import {
  AccountByTypeResponseType,
  BalanceBankRespType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';

import {
  CurrencyType,
  DropdownOptionType,
  ExpenseInputDataType,
  VariantType,
  MovementTransactionType,
  TopCardElementsType,
} from '../../../types/types.ts';
//----------------------------
// 🛡️ ZOD - SCHEMA AND DATA TYPE VALIDATIONS
import { validateForm } from '../../../validations/utils/zod_validation.ts';
import { expenseSchema } from '../../../validations/zod_schemas/trackerMovementSchema.ts';
import {
  ExpenseValidatedDataType,
  ValidationMessagesType,
} from '../../../validations/types.ts';
import { handleError } from '../../../helpers/handleError.ts';
import { currencyFormat } from '../../../helpers/functions.ts';
import { isUnbudgeted } from '../../../helpers/budgetStatus.ts';
import { AUTH_ROUTE } from '../../../../auth/auth_constants/constants.ts';
//-----------------------------
// 📝DATA TYPE DEFINITIONS
export type ShowValidationType = {
  amount: boolean;
  account: boolean;
  category: boolean;
  note: boolean;
};
//=============================
// ⚙️ INITIAL CONFIGURATION AND DEFAULT VALUES
//=============================
const defaultCurrency = DEFAULT_CURRENCY;

const initialExpenseData: ExpenseInputDataType = {
  amount: '', //string for input
  account: '',
  category: '',
  note: '',
  currency: DEFAULT_CURRENCY,
};
const VARIANT_DEFAULT: VariantType = 'tracker';
// ===============================
// ⚛️MAIN COMPONENT: EXPENSE
// ===============================
//----Expense Tracker Movement -----
function Expense(): JSX.Element {
  //rules: only bank accounts type are used to do operations.(eg. expenses)
  //select option accounts renders are all existing bank accounts, except, the slack account which is not shown.
  //---
  // 🗺️ ROUTER AND NAVIGATION CONFIGURATION
  const router = useLocation();
  const trackerState = router.pathname.split('/')[PAGE_LOC_NUM];
  const typeMovement: MovementTransactionType = trackerState.toLowerCase();
  const navigateTo = useNavigate();
  // console.info('tracker state', trackerState)
  //---
  // 🛡️ AUTHENTICATION STATE
  const { isAuthenticated, isCheckingAuth } = useAuth();

  // 🔄 LOCAL STATES
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);

  const [isReset, setIsReset] = useState<boolean>(false);
  const [isResetDropdown, setIsResetDropdown] = useState<boolean>(false);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [expenseData, setExpenseData] =
    useState<ExpenseInputDataType>(initialExpenseData);

  // The day this entry happened. Defaults to today, which is always inside the
  // window and always shows every account, so an ordinary entry never touches it.
  const {
    transactionActualDate,
    isOpenOnChosenDay,
    dateProps: transactionDateProps,
  } = useTransactionDate();
  // const [localError, setLocalError] = useState<string | null>(null);

  // Message States
  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null,
  );

  const [validationMessages, setValidationMessages] = useState<
    ValidationMessagesType<typeof initialExpenseData>
  >({});

  const [showValidation, setShowValidation] = useState<ShowValidationType>({
    amount: false,
    account: false,
    category: false,
    note: false,
  });
  //----------
  // 🌳 GLOBAL STATE (Zustand)
  const setAvailableBudget = useBalanceStore(
    (state) => state.setAvailableBudget,
  );

  //--- 📡 DATA FETCHING--------------
  //---GET: TOTAL BALANCE OF ACCOUNTS OF TYPE BANK
  const balanceBankResponse = useFetch<BalanceBankRespType>(
    `${url_get_total_account_balance_by_type}/?type=bank&reload=${reloadTrigger}`,
  );
  // console.log("🚀 ~ Expense ~ balanceBankResponse:", balanceBankResponse)

  //----
  // 📡 Data Fetching: Bank Accounts
  //Endpoints: url_get_accounts_by_type, url_get_total_account_balance_by_type

  //GET: AVAILABLE ACCOUNTS OF TYPE BANK
  const fetchUrl = `${url_get_accounts_by_type}/?type=bank&reload=${reloadTrigger}`;
  //console.log('🚀 ~ Expense ~ fetchUrl:', fetchUrl);

  const {
    apiData: BankAccountsResponse,
    isLoading: isLoadingBankAccounts,
    error: fetchedErrorBankAccounts,
    // ...rest
  } = useFetch<AccountByTypeResponseType>(fetchUrl as string);
  //----------------------------
  //console.log('',{
  //   BankAccountsResponse,
  //   isLoadingBankAccounts,
  //   fetchedErrorBankAccounts,
  //   rest
  // });
  //-- -data transformation -----
  // 🧠 Memoization: Account Options
  const optionsExpenseAccounts = useMemo(() => {
    if (fetchedErrorBankAccounts) {
      return ACCOUNT_OPTIONS_DEFAULT;
    }
    // Filtered by the chosen day before it is mapped: an account that did not
    // exist yet is not a disabled option, it is not an option. The server
    // refuses it independently; this is what keeps the owner from meeting that
    // refusal through a control the form offered them.
    const accountList = (BankAccountsResponse?.data?.accountList ?? []).filter(
      (acc) => isOpenOnChosenDay(acc.account_start_date),
    );

    return accountList.length
      ? accountList.map((acc) => ({
          value: acc.account_name,
          label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})`,
        }))
      : ACCOUNT_OPTIONS_DEFAULT;
  }, [
    BankAccountsResponse?.data.accountList,
    fetchedErrorBankAccounts,
    isOpenOnChosenDay,
  ]);

  // An account already chosen may stop qualifying when the date moves back.
  // Clearing it is not a courtesy: the form would otherwise post a name the list
  // no longer offers, and take a 422 for a choice the owner can no longer see.
  useEffect(() => {
    if (!expenseData.account) return;

    const stillOffered = optionsExpenseAccounts.some(
      (option) => option.value === expenseData.account,
    );

    if (stillOffered) return;

    setExpenseData((prev) => ({ ...prev, account: '' }));
    setIsResetDropdown(true);
  }, [optionsExpenseAccounts, expenseData.account]);

  const accountOptions = {
    title: 'Select Account',
    options: optionsExpenseAccounts,
    variant: VARIANT_DEFAULT,
  };
  //--------
  //CATEGORY OPTIONS
  // 📡 Data: this month's spend against this month's budget, per category
  // account. The status payload carries accountName and currency as well as the
  // two figures, so it REPLACES the account/type fetch instead of joining it —
  // the screen still issues one request for its category list.
  //
  // The figure it retires was ua.account_balance, a lifetime accumulator: what
  // the category has consumed since it opened, printed beside a budget that only
  // ever meant this month.
  //
  // The month the label reports on. A constant while the tracker has no date
  // control; once the back-dating datepicker lands it becomes the month of the
  // date in the form, and only this line changes. Undefined travels as an
  // omitted month, which is what asks the server to resolve the current one on
  // the owner's calendar — a browser clock lands on the wrong month for part of
  // every day.
  const budgetMonth: string | undefined = undefined;

  const budgetAccounts = useBudgetStatusStore((state) => state.accounts);
  const isLoadingCategoryBudgetAccounts = useBudgetStatusStore(
    (state) => state.isLoading,
  );
  const fetchedErrorCategoryBudgetAccounts = useBudgetStatusStore(
    (state) => state.error,
  );
  // Nothing has been answered yet, which is not the same as an empty answer.
  // Without it the first frame — before the effect below runs — reads as a user
  // with no budget categories at all.
  const isBudgetStatusLoaded = useBudgetStatusStore(
    (state) => state.loadedMonth !== null,
  );
  const fetchBudgetStatus = useBudgetStatusStore((state) => state.fetchStatus);
  const refreshBudgetStatus = useBudgetStatusStore(
    (state) => state.refreshStatus,
  );

  // The store's own guard makes this free when budget or the transfer screen has
  // already asked for the same month. reloadTrigger is a dependency because a
  // recorded movement invalidates the memo, and this is what asks again for it.
  useEffect(() => {
    void fetchBudgetStatus(budgetMonth);
  }, [fetchBudgetStatus, budgetMonth, reloadTrigger]);

  //Category Data Transformation -
  // 🧠 Memoización: category dropdown options
  //
  // Option identity is not option status. A name carried over while another
  // month is on the wire is still the same account; its figures are not, and
  // showing them under a different month is the very defect this replaces.
  const optionsExpenseCategories = useMemo(() => {
    if (fetchedErrorCategoryBudgetAccounts) {
      return CATEGORY_OPTIONS_DEFAULT;
    }

    // Filtered by the chosen day before it is mapped, the same rule the bank
    // list above already applies: a category that did not exist yet is not a
    // disabled option, it is not an option. Until the status payload carried an
    // opening date this list could not be filtered at all, so moving the date
    // back left categories on screen that the server would refuse.
    return budgetAccounts
      .filter((account) => isOpenOnChosenDay(account.accountStartDate))
      .map((account) => {
      const hasFigures =
        !isLoadingCategoryBudgetAccounts &&
        Number.isFinite(account.actualSpent) &&
        Number.isFinite(account.budgetAmount) &&
        // Nothing budgeted and nothing spent is no budget at all, not a budget
        // met. The four budget screens print nothing there and this must not
        // contradict them about the same account on the same day.
        !isUnbudgeted(account.budgetAmount, account.actualSpent);

      if (!hasFigures) {
        return { value: account.accountName, label: account.accountName };
      }

      // The currency travels once: currencyFormat emits the symbol itself, so
      // the loose currency code the old label prefixed said it twice.
      const spent = currencyFormat(
        account.currency,
        account.actualSpent,
        'en-US',
      );
      const budget = currencyFormat(
        account.currency,
        account.budgetAmount,
        'en-US',
      );

      return {
        value: account.accountName,
        label: `${account.accountName} (${spent} / ${budget})`,
      };
    });
  }, [
    budgetAccounts,
    fetchedErrorCategoryBudgetAccounts,
    isLoadingCategoryBudgetAccounts,
    isOpenOnChosenDay,
  ]);
  // Same reason as the account effect above: a category already chosen may stop
  // qualifying when the date moves back, and a form that keeps it posts a name
  // the list no longer offers.
  useEffect(() => {
    if (!expenseData.category) return;

    const stillOffered = optionsExpenseCategories.some(
      (option) => option.value === expenseData.category,
    );

    if (stillOffered) return;

    setExpenseData((prev) => ({ ...prev, category: '' }));
    setIsResetDropdown(true);
  }, [optionsExpenseCategories, expenseData.category]);

  //--------------------------
  const categoryOptions = {
    title: optionsExpenseCategories ? 'Category / Subcategory' : '',
    options: optionsExpenseCategories ?? CATEGORY_OPTIONS_DEFAULT,
    variant: VARIANT_DEFAULT as VariantType,
  };
  //-----------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  // 📡 Post Request logic
  type PayloadType = ExpenseValidatedDataType & {
    type?: string;
    // The day the movement happened, as the calendar label the server validates.
    transactionActualDate: string;
  };
  //----
  //DATA POST FETCHING
  const {
    data,
    isLoading,
    error: postError,
    requestFn,
  } = useFetchLoad<MovementTransactionResponseType, PayloadType>({
    url: url_movement_transaction_record,
    method: 'POST',
  });
  //---- FUNCTIONS --------
  // ======================
  // ✍️ Event Handlers
  // ======================
  function updateDataCurrency(currency: CurrencyType) {
    setCurrency(currency);
    setExpenseData((prev) => ({ ...prev, currency: currency }));
  }
  //--custom field handler for category
  function categorySelectHandler(selectedOption: DropdownOptionType | null) {
    setExpenseData((prev) => ({
      ...prev,
      ['category']: selectedOption?.value || '', //update field
    }));

    // Only validate if showing validation for category
    if (showValidation.category) {
      setValidationMessages((prev) => ({
        ...prev,
        category: selectedOption?.value ? '' : '* Please select a category',
      }));
    }
    // console.log(
    //   'desde categorySelectHandler:',
    //   selectedOption,
    //   selectedOption?.value
    // );
  }
  //---
  //custom field handler for account
  function accountSelectHandler(selectedOption: DropdownOptionType | null) {
    setExpenseData((prev) => ({
      ...prev,
      ['account']: selectedOption?.value || '',
    }));

    // Only validates if showing validation msg for account
    if (showValidation.account) {
      setValidationMessages((prev) => ({
        ...prev,
        account: selectedOption?.value ? '' : '* Please select an account',
      }));
    }
  }
  //==============================
  //-- VALIDATION FUNCTIONS AND LOGIC ---
  //Extract function for validation and update logic, which will be debounced.
  // Real Time Validation.
  // useCallback to make the function stable if its dependencies don't change.
  //-----------------------------
  // ✍️ EVENT HANDLERS
  const processValidationAndUpdateFn = useCallback(
    (name: string, value: string) => {
      // Data object for Zod. Zod waits an object with all input data fields to validate them
      // Always validate if showValidation is true for this field
      if (showValidation[name as keyof ShowValidationType]) {
        const currentDataForValidation = {
          ...expenseData,
          [name]: value, // Value input is taken to validate it
        };
        const { errors: fieldErrors } = validateForm(
          expenseSchema,
          currentDataForValidation,
        );

        //const { data:dataValidated} = validateForm(expenseSchema, currentDataForValidation);
        //console.log('fieldErrors', fieldErrors, dataValidated);

        //update just the message of the current field (name) and if it should show
        if (fieldErrors[name as keyof ExpenseInputDataType]) {
          setValidationMessages((prev) => ({
            ...prev,
            [name]: fieldErrors[name as keyof ExpenseInputDataType],
          }));
        } else {
          setValidationMessages((prev) => {
            const newMessages = { ...prev };
            delete newMessages[name as keyof ExpenseInputDataType];
            return newMessages;
          });
        }
      }
    },
    [expenseData, showValidation],
  );
  //---
  // Apply the debounce to the `processValidationAndUpdate` function
  const debouncedProcessValidationAndUpdateFn = useDebouncedCallback(
    processValidationAndUpdateFn,
    500,
  );
  //---
  // updateTrackerData_Zod: It only updates the immediate state and calls the debounced function.
  function updateTrackerData_Zod(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    e.preventDefault();
    const { name, value } = e.target;

    //validate in real time field
    setExpenseData((prev) => ({ ...prev, [name]: value }));

    // immediate validation for amount
    if (name === 'amount') {
      setShowValidation((prev) => ({ ...prev, amount: true }));
      debouncedProcessValidationAndUpdateFn(name, value);

      // show validation message for other fields when amount value is entered.
      if (value && !showValidation.account) {
        setShowValidation((prev) => ({
          ...prev,
          account: true,
          category: true,
          note: true,
        }));
      }
    } else {
      debouncedProcessValidationAndUpdateFn(name, value);
    }
  }
  //---
  function showMessage(message: string, duration = 4000) {
    setMessageToUser(message);
    setTimeout(() => setMessageToUser(null), duration);
  }
  //------------------------
  //Handler for form submit
  // One path, two entries: the + button's click, and Enter in any field, which
  // reaches this through the form's onSubmit. preventDefault below serves both,
  // and it is why clicking + does not also fire the submit.
  async function onSaveHandler(
    e: React.MouseEvent<HTMLButtonElement> | React.FormEvent<HTMLFormElement>,
  ) {
    // console.log('On Save Handler');
    e.preventDefault();
    // Show all validation messages when submitting
    setShowValidation({
      amount: true,
      account: true,
      category: true,
      note: true,
    });
    //validate the whole input form data
    const { errors: fullFormErrors, data: dataValidated } = validateForm(
      expenseSchema,
      expenseData,
    );
    // console.log("🚀 ~ onSaveHandler ~ fullFormErrors:", fullFormErrors,)
    if (fullFormErrors && Object.keys(fullFormErrors).length > 0) {
      setValidationMessages(fullFormErrors);
      setMessageToUser('Please correct the highlighted errors.');
      setTimeout(() => setMessageToUser(null), 4000);
      return; //abort
    }
    //check if validated data exists
    if (!dataValidated) {
      showMessage('Validation failed. Please check your inputs.');
      return;
    }
    showMessage('Processing transaction...', 2000);
    //-------------------------
    //POST ENDPOINT FOR MOVEMENT TRANSACTION
    //--sending data to server ------
    //update balance account of bank account and category budget account in: user_accounts table.

    //record both transaction descriptions: transfer and receive transactions with the correspondent account info.

    //endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=expense

    try {
      //create a payload with validated data
      const payload: PayloadType = {
        ...(dataValidated as ExpenseValidatedDataType & { type?: string }),
        type: typeMovement,
        transactionActualDate,
      };

      //send the request
      const finalUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;

      const response = await requestFn(payload, {
        url: finalUrl,
      } as AxiosRequestConfig);

      if (response.error) {
        const errorMsg = response.error;
        // console.log('response.error', errorMsg)
        throw new Error(errorMsg);
      }

      // Caches holding transaction-derived data are now stale. Issues no request.
      notifyTransactionRecorded();

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        // console.log('Data from record transaction request:', response);
      }
      //------------------------
      showMessage('Transaction recorded successfully!', 3000);
    } catch (error) {
      const { message, status, isAuthError } = handleError(error);

      if (isAuthError) {
        return;
      }

      showMessage(`Error (${status}): ${message}`);

      console.error(`Error (${status}): ${message}`);
    }
  }
  //-------------------------------
  // ⏳--- SIDE EFFECTS
  //-------------------------------
  // UPDATE GLOBAL BALANCE AFTER useFetch
  useEffect(() => {
    const total_balance = balanceBankResponse.apiData?.data?.total_balance;

    // Solo actualiza si los datos han llegado y son un número
    if (typeof total_balance === 'number') {
    // Llama a la función de la store fuera de la fase de renderizado
      setAvailableBudget(total_balance);
    }
    // Dependencia: Solo re-ejecuta cuando la respuesta del fetch de balance cambia
  }, [balanceBankResponse.apiData, setAvailableBudget]);

  //----------------
  // AUTHENTICATION AND REDIRECTION EFFECT
  //Message to user and action, when auth is checking or not authenticated
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isCheckingAuth) {
      setMessageToUser('Verifying session status. Please wait...');
    } else if (!isAuthenticated) {
     // Use existing messageToUser state for feedback before redirecting
      setMessageToUser(
       'Session not active or expired. Redirecting to the sign-in page in 3 seconds...',
      );

      timer = setTimeout(() => {
        navigateTo(AUTH_ROUTE, { replace: true });
      }, 3000);
    } else {
      // If authenticated, clear the message (only if it was set by the auth check)
      if (
        messageToUser?.includes('Verifying') ||
        messageToUser?.includes('Session not active')
      ) {
        setMessageToUser(null);
      }
    }

    return () => {
      if (timer) clearTimeout(timer); // Cleanup timer
    };
  }, [isAuthenticated, isCheckingAuth, navigateTo, messageToUser]);
  //-----------------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (data && !isLoading) {
      const success = data;
      setMessageToUser('Movement successfully completed!');
      //reset only in case of success
      if (success) {
        setCurrency(DEFAULT_CURRENCY);
        setExpenseData(initialExpenseData);
        setReloadTrigger((prev) => prev + 1);
        setIsReset(true);
        setIsResetDropdown(true);
        setValidationMessages({});
      }
      setShowValidation({
        amount: false,
        account: false,
        category: false,
        note: false,
      });

      timer = setTimeout(() => {
        setMessageToUser(null);
        setIsReset(false);
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [data, isLoading]);
  //---
  // Data Fetching Effect to control when useFetch re-execute
  useEffect(() => {
    if (!isAuthenticated || isCheckingAuth) return;
  }, [isAuthenticated, isCheckingAuth, reloadTrigger]);
  //--------------------------------------
  //SHOW VALIDATION MSG SIDE EFFECTS
  // Effect to handle note validation when amount is entered
  useEffect(() => {
    if (expenseData.amount !== '' && !showValidation.note) {
      setShowValidation((prev) => ({
        ...prev,
        note: true,
      }));
      // Validate note field immediately when activated
      if (expenseData.note === '') {
        setValidationMessages((prev) => ({
          ...prev,
          note: '* Please write the note',
        }));
      } else {
        setValidationMessages((prev) => {
          const newMessages = { ...prev };
          delete newMessages.note;
          return newMessages;
        });
      }
    }
  }, [expenseData.amount, expenseData.note, showValidation.note]);

  // Effect to handle account validation when amount is entered
  useEffect(() => {
    // Activate validation only if amount is entered /Activar validación solo si hay amount y no está ya activa
    if (expenseData.amount !== '' && !showValidation.account) {
      setShowValidation((prev) => ({ ...prev, account: true }));

      // Initial validation with Zod
      const { errors } = validateForm(expenseSchema, {
        ...expenseData,
        account: expenseData.account,
      });

      if (errors.account) {
        setValidationMessages((prev) => ({ ...prev, account: errors.account }));
      }
    }
  }, [expenseData, showValidation.account]);
  // ==============================
  // Specific effect for amount
  // ==============================
  useEffect(() => {
    if (expenseData.amount !== '' && !showValidation.amount) {
      setShowValidation((prev) => ({ ...prev, amount: true }));
      // La validación real se hará en processValidationAndUpdateFn
    }
  }, [expenseData.amount, showValidation.amount]);
  //-------------------------------
  // Effect to handle category validation when amount is entered
  useEffect(() => {
    if (expenseData.amount !== '' && !showValidation.category) {
      setShowValidation((prev) => ({
        ...prev,
        category: true,
      }));

      // Validate category field immediately when activated
      if (expenseData.category === '') {
        setValidationMessages((prev) => ({
          ...prev,
          category: '* Please select a category',
        }));
      } else {
        setValidationMessages((prev) => {
          const newMessages = { ...prev };
          delete newMessages.category;
          return newMessages;
        });
      }
    }
  }, [expenseData.amount, expenseData.category, showValidation.category]);

  //------------------------------------
  //RENDERING COMPONENTS
  //-------Top Card elements ----------
  const topCardElements: TopCardElementsType = {
    titles: { title1: 'amount', title2: 'account' },
    value: expenseData.amount as string,
    selectOptions: accountOptions,
  };
  // ------------------------------------
  // The category list's three fetch states, and only its states. The option
  // label is a string and can carry neither a skeleton nor a button, so they
  // need a surface of their own — one that never repeats a figure the label
  // already shows.
  //
  // They degrade the one control that failed. The whole form used to go with it:
  // the category error was wired into the screen-level MessageToUser blocks, so
  // a budget-service outage took expense entry down with it.
  function renderCategoryStatus(): JSX.Element | null {
   if (fetchedErrorCategoryBudgetAccounts) {
    return (
     <div className='categoryStatus categoryStatus--error' role='alert'>
      <span className='categoryStatus__text'>
       Budget status could not be loaded.
      </span>

      <button
       type='button'
       className='categoryStatus__retry'
       onClick={() => {
        void refreshBudgetStatus();
       }}
      >
       Retry
      </button>
     </div>
    );
   }

   if (isLoadingCategoryBudgetAccounts || !isBudgetStatusLoaded) {
    return (
     <div className='categoryStatus' aria-hidden='true'>
      <span className='categoryStatus__skeleton'></span>
     </div>
    );
   }

   if (optionsExpenseCategories.length === 0) {
    return (
     <div className='categoryStatus'>
      <span className='categoryStatus__text'>
       No budget categories yet. Create one to record an expense.
      </span>
     </div>
    );
   }

   return null;
  }
  // ------------------------------------
  // 🧱 RENDER LOGIC
  // ------------------------------------
  // Separate UI of "checking" and "not authenticated"
  if (isCheckingAuth) {
    return (
      <div className='expense loading-screen' style={{ color: 'inherit' }}>
        <MessageToUser
          isLoading={true}
          messageToUser={messageToUser}
          variant='tracker'
          error={postError || fetchedErrorBankAccounts}
        />
        <CoinSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className='expense loading-screen' style={{ color: 'inherit' }}>
        <MessageToUser
          isLoading={false} // MODIFICACIÓN: no estamos "checking", estamos en estado no-auth
          messageToUser={
            messageToUser ??
            'Session not active or expired. Redirecting to sign-in...'
          } // MODIFICACIÓN: fallback mensaje
          variant='tracker'
          error={postError || fetchedErrorBankAccounts}
        />
      </div>
    );
  }
  // ----------------------------------
  // If authenticated and not checking, render the form:
  return (
    <>
      {/*  {!isLoadingBankAccounts && !isLoadingCategoryBudgetAccounts  &&!isLoading && */}
      <form
        className='expense'
        style={{ color: 'inherit' }}
        onSubmit={onSaveHandler}
      >
        {/* TOP CARD */}
        <TopCard<typeof initialExpenseData>
          topCardElements={topCardElements}
          validationMessages={validationMessages}
          setValidationMessages={setValidationMessages}
          updateTrackerData={updateTrackerData_Zod}
          trackerName={trackerState}

          currency={currency}
          updateCurrency={updateDataCurrency}

          setSelectState={
            setExpenseData as React.Dispatch<
              React.SetStateAction<typeof initialExpenseData>
            >
          }

          isReset={isReset}
          isResetDropdown={isResetDropdown}
          setIsReset={setIsReset}
          setIsResetDropdown={setIsResetDropdown}

          customSelectHandler={accountSelectHandler}
          transactionDateProps={transactionDateProps}
        />
        {/* end of TOP CARD */}

        <CardSeparator />

        {/*start of BOTTOM CARD */}
        <div className='state__card--bottom'>
          <div className='card--title card--title--top'>
            Category{' '}
            <span className='validation__errMsg'>
              {validationMessages['category']}
            </span>
          </div>

          <DropDownSelection
            dropDownOptions={categoryOptions}
            updateOptionHandler={categorySelectHandler}
            isReset={isReset}
            setIsReset={setIsReset}
          />

          {renderCategoryStatus()}

          <CardNoteSave
            title={'note'}
            validationMessages={validationMessages}
            dataHandler={updateTrackerData_Zod}
            inputNote={expenseData.note}
            onSaveHandler={onSaveHandler}
            isDisabled={
              isLoading ||
              isLoadingBankAccounts ||
              isLoadingCategoryBudgetAccounts
            }
            showError={showValidation.note}
          />

          {/* end of BOTTOM CARD */}
        </div>
      </form>

      {messageToUser && (
        <div className='fade-message'>
          <MessageToUser
            isLoading={
             isLoading ||
             isLoadingBankAccounts ||
             isLoadingCategoryBudgetAccounts
            }
            error={postError || fetchedErrorBankAccounts}
            messageToUser={messageToUser}
            variant='tracker'
          />
        </div>
      )}
    </>
  );
}

export default Expense;
