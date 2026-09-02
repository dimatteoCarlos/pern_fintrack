//src/pages/tracker/expense/Transfer.tsx
//zod validation and useFormManager were used.
// ============================
// 📦 IMPORT DEPENDENCIES
// ============================
// ⚛️ React Hooks
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosRequestConfig } from 'axios';
import { useLocation } from 'react-router-dom';

// 🪝 Custom Hooks y utils
import { useFetch } from '../../../hooks/useFetch.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';

// form input validation manager
import useFormManager from '../../../hooks/useFormManager.ts';

// Zustand store
import useBalanceStore from '../../../stores/useBalanceStore.ts';
import { useBudgetStatusStore } from '../../../stores/useBudgetStatusStore.ts';
import { notifyTransactionRecorded } from '../../../stores/transactionEvents.ts';
//---------------------------
// 🌐Endpoints and constants
import {
  url_get_accounts_by_type,
  url_movement_transaction_record,
  url_get_total_account_balance_by_type,
} from '../../../../urlConfig.ts';

import {
  DEFAULT_CURRENCY,
  ACCOUNT_OPTIONS_DEFAULT,
  PAGE_LOC_NUM,
} from '../../../helpers/constants.ts';

//📝 Data Type Configuration Import
import type {
  DropdownOptionType,
  CurrencyType,
  MovementInputDataType,
  TransferAccountType,
  VariantType,
} from '../../../types/types.ts';

import type {
  AccountByTypeResponseType,
  AccountListType,
  MovementTransactionResponseType,
  BalanceBankRespType,
} from '../../../types/responseApiTypes.ts';

// 🧮 Presentation helpers
import { currencyFormat } from '../../../helpers/functions.ts';
import { isUnbudgeted } from '../../../helpers/budgetStatus.ts';

//-------------------------------------
// 🛡️ Zod - Schema and data type validation
import { transferSchema } from '../../../validations/zod_schemas/trackerMovementSchema.ts';
import { MovementValidatedDataType } from '../../../validations/types.ts';

// 🎨 UI Components
import TopCard from '../components/TopCard.tsx';
import CardSeparator from '../components/CardSeparator.tsx';
import { useTransactionDate } from '../../../hooks/useTransactionDate.ts';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import RadioInput from '../../../general_components/radioInput/RadioInput.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import { fetchNewBalance } from '../../../../auth/auth_utils/fetchNewTotalBalance.ts';
//-------------------------------
// 📝data type configuration
export type ShowValidationType = {
  amount: boolean;
  origin: boolean;
  currency: boolean;
  destination: boolean;
  note: boolean;
  originAccountType: boolean;
  destinationAccountType: boolean;
  // originAccountId?: boolean;
  // destinationAccountId?: boolean;
};

type RadioOptionType<T extends string> = { value: T; label: string };

//=================================
// ⚙️ Initial Configuration and default values
//================================
const defaultCurrency = DEFAULT_CURRENCY;

const initialMovementData: MovementInputDataType = {
  amount: '',
  origin: '',
  destination: '',

  originAccountId: undefined,
  destinationAccountId: undefined,

  note: '',
  currency: defaultCurrency,

  originAccountType: 'bank',
  destinationAccountType: 'investment',
};
const VARIANT_DEFAULT: VariantType = 'tracker';

//--RadioOption selection for account types
const inputRadioOptionsAccountTopCard: RadioOptionType<TransferAccountType>[] =
  [
    { value: 'bank', label: 'Bank' },
    { value: 'investment', label: 'Invest' },
    { value: 'category_budget', label: 'Rev.Expense' },
  ];

const inputRadioOptionsAccountBottomCard: RadioOptionType<TransferAccountType>[] =
  [
    { value: 'bank', label: 'Bank' },
    { value: 'investment', label: 'Invest' },
    { value: 'income_source', label: 'Rev. Income' },
  ];
//==============================
// ⚛️ MAIN COMPONENT: TRANSFER
//==============================
//--Transfer Tracker Movement between accounts--
//-- account types allowed: investment and bank accounts -----
// The one message this screen sends down the message channel that is not a
// confirmation. See the same constant in Expense.tsx for why it is compared
// exactly rather than inferred from the validation state.
const CORRECTION_PROMPT = 'Please correct the fields';

function Transfer(): JSX.Element {
  //rules: only investment and bank account types are used.
  //slack account is not used.
  // 🗺️ Router and User configuration
  const router = useLocation();
  const trackerState = router.pathname.split('/')[PAGE_LOC_NUM];
  const typeMovement = trackerState.toLowerCase();
  // console.info('tracker state', trackerState)
  //----------------------------
  // 🛡️ Authentication state or user id
  // const user = import.meta.env.VITE_USER_ID;
  //----------------------
  //---STATES-------------
  // 🔄 Local States
  // const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [isReset, setIsReset] = useState<boolean>(false);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null,
  );

  const [showMessage, setShowMessage] = useState(false);

  //--set states for reseting dropdown selection of accounts
  const [isResetOriginAccount, setIsResetOriginAccount] =
    useState<boolean>(true);

  const [isResetDestinationAccount, setIsResetDestinationAccount] =
    useState<boolean>(true);
  //-----------------------------------
  // 🌳 Global State (Zustand store) to update available balance
  const setAvailableBudget = useBalanceStore(
    (state) => state.setAvailableBudget,
  );
  // ---------
  // 📝 Hook `useFormManager`, initialization.
  // Centralize the logic of form handling and validation
  const {
    formData,
    showValidation,
    validationMessages,
    handlers: {
      createNumberHandler,
      createTextareaHandler,
      updateCurrency,
      handleApiError,
    },

    validateAll,
    resetForm,
    activateAllValidations,

    setters: { setValidationMessages, setFormData },
  } = useFormManager<MovementInputDataType, MovementValidatedDataType>(
    transferSchema,
    initialMovementData,
  );
  //---- Account Options ------
  // ================================
  // 📡 API DATA FETCHING (REACTIVO)
  // ================================
  // Prepare data and url for Fetching origin accounts
  const fetchOriginAccountUrl = `${url_get_accounts_by_type}?type=${formData.originAccountType}&reload=${reloadTrigger}`;

  //GET: AVAILABLE ACCOUNTS BY TYPE for Origin account
  const {
    apiData: originAccountsResponse,
    isLoading: isLoadingOriginAccounts,
    error: fetchedErrorOriginAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchOriginAccountUrl as string);

  // console.log({
  //   originAccountsResponse,
  //   isLoadingOriginAccounts,
  //   fetchedErrorOriginAccounts,
  // });

  //---------------------------------
  // 📡 This month's spend against this month's budget, joined into the list
  // above rather than replacing it. The account/type fetch is generic — its URL
  // is built from the origin type — and for a bank or an investment origin the
  // running balance it carries is the right figure. Only the Rev.Expense
  // origin, a category_budget account, reads the wrong window from it: there
  // account_balance is a lifetime accumulator, everything the category has
  // consumed since it opened.
  const isCategoryOrigin = formData.originAccountType === 'category_budget';

  // The month the figures report on. A constant while the tracker has no date
  // control; once the back-dating datepicker lands it becomes the month of the
  // date in the form, and only this line changes. Undefined travels as an
  // omitted month, which is what asks the server to resolve the current one on
  // the owner's calendar rather than on a browser clock.
  const budgetMonth: string | undefined = undefined;

  const budgetAccounts = useBudgetStatusStore((state) => state.accounts);
  const isLoadingBudgetStatus = useBudgetStatusStore(
    (state) => state.isLoading,
  );
  const fetchBudgetStatus = useBudgetStatusStore((state) => state.fetchStatus);

  // Only the category branch asks for anything: a bank or investment origin
  // needs no budget figure and must not pay for a request. reloadTrigger is a
  // dependency because a recorded movement invalidates the store's memo, and
  // this is what asks again for it.
  useEffect(() => {
    if (!isCategoryOrigin) return;

    void fetchBudgetStatus(budgetMonth);
  }, [isCategoryOrigin, fetchBudgetStatus, budgetMonth, reloadTrigger]);

  // Joined on account_id, the one key both payloads carry. A name is what the
  // dropdown submits, not what identifies a row.
  const budgetStatusByAccountId = useMemo(
    () => new Map(budgetAccounts.map((account) => [account.accountId, account])),
    [budgetAccounts],
  );

  // One implementation for both origin memos below. They carried the same
  // template twice, so a correction applied to one of them would have printed a
  // different figure depending only on whether a destination was already
  // chosen.
  const buildOriginLabel = useCallback(
    (acc: AccountListType): string => {
      if (!isCategoryOrigin) {
        return `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})`;
      }

      const status = budgetStatusByAccountId.get(acc.account_id);

      // The account's identity survives while its status is on the wire or
      // absent; its figures do not. Falling back to account_balance here would
      // serve the lifetime number under a label claiming the month — the exact
      // defect this removes. Nothing budgeted and nothing spent is no budget at
      // all, and the budget screens print nothing there either.
      if (
        !status ||
        isLoadingBudgetStatus ||
        !Number.isFinite(status.actualSpent) ||
        !Number.isFinite(status.budgetAmount) ||
        isUnbudgeted(status.budgetAmount, status.actualSpent)
      ) {
        return acc.account_name;
      }

      // The currency travels once: currencyFormat emits the symbol itself, so
      // the loose currency code the other branch prefixes would say it twice.
      const spent = currencyFormat(status.currency, status.actualSpent, 'en-US');
      const budget = currencyFormat(
        status.currency,
        status.budgetAmount,
        'en-US',
      );

      return `${acc.account_name} (${spent} / ${budget})`;
    },
    [isCategoryOrigin, budgetStatusByAccountId, isLoadingBudgetStatus],
  );
  //---------------------------------
  // The day this entry happened. Defaults to today, which is always inside the
  // window and always shows every account.
  const {
    transactionActualDate,
    isOpenOnChosenDay,
    dateProps: transactionDateProps,
  } = useTransactionDate();

  //--- DATA TRANSFORMATIONS
  // 🧠 Memoization: Account Options
  const optionsOriginAccounts = useMemo(() => {
    if (fetchedErrorOriginAccounts) {
      return ACCOUNT_OPTIONS_DEFAULT;
    }
    // An account that did not exist on the chosen day is not a disabled option,
    // it is not an option.
    const originAccountList = (
      originAccountsResponse?.data?.accountList ?? []
    ).filter((acc) => isOpenOnChosenDay(acc.account_start_date));

    return originAccountList.length
      ? originAccountList.map((acc) => ({
          value: acc.account_name,
          label: buildOriginLabel(acc),
          // account_id: acc.account_id,
        }))
      : ACCOUNT_OPTIONS_DEFAULT;
  }, [
    originAccountsResponse?.data.accountList,
    fetchedErrorOriginAccounts,
    buildOriginLabel,
    isOpenOnChosenDay,
  ]);
  //-------------------------------------
  //filtering origin account list
  const filteredOriginOptions = useMemo(() => {
    if (!formData.destinationAccountId) {
      return optionsOriginAccounts;
    }
    const originAccountList = (
      originAccountsResponse?.data?.accountList ?? []
    ).filter((acc) => isOpenOnChosenDay(acc.account_start_date));

    const filteredAccounts = originAccountList.length
      ? originAccountList.filter(
          (acc) => acc.account_id !== formData.destinationAccountId,
        )
      : originAccountList;

    //map to dropdown format without account_id
    return filteredAccounts.map((acc) => ({
      value: acc.account_name,
      label: buildOriginLabel(acc),
    }));
  }, [
    formData.destinationAccountId,
    originAccountsResponse?.data.accountList,
    optionsOriginAccounts,
    buildOriginLabel,
    isOpenOnChosenDay,
  ]);

  //----account options for dropdown of origin
  const originAccountOptionsToRender = {
    title: originAccountsResponse?.data?.accountList.length
      ? 'Select Account'
      : '',
    options: filteredOriginOptions,
    variant: VARIANT_DEFAULT as VariantType,
  };
  //-------------------------------------
  //DATA FETCHING
  // Prepare data and url for Fetching destination accounts
  //GET: AVAILABLE ACCOUNTS BY TYPE for Destination account
  const fetchDestinationAccountUrl = formData.destinationAccountType
    ? `${url_get_accounts_by_type}?type=${formData.destinationAccountType}&${reloadTrigger}`
    : undefined;
  // console.log(fetchOriginAccountUrl, fetchDestinationAccountUrl);

  const {
    apiData: destinationAccountsResponse,
    isLoading: isLoadingDestinationAccounts,
    error: fetchedErrorDestinationAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchDestinationAccountUrl as string);

  //Fetch of total balance (Zustand) reactive to trigger
  const balanceBankResponse = useFetch<BalanceBankRespType>(
    `${url_get_total_account_balance_by_type}/?type=bank&v=${reloadTrigger}`,
  );

  //Data Transformations
  //🧠 Memoization: Account Options
  // console.log('destinationAccountsResponse', {
  //   destinationAccountsResponse,
  //   isLoadingDestinationAccounts,
  //   fetchedErrorDestinationAccounts,
  // });

  const destinationAccountOptions = useMemo(
    () => ({
      title: destinationAccountsResponse?.data.accountList.length
        ? 'Select Account'
        : '',

      options:
        destinationAccountsResponse?.data?.accountList
          ?.filter(
            (dest) =>
              dest.account_id !== formData.originAccountId &&
              isOpenOnChosenDay(dest.account_start_date),
          )
          .map((acc) => ({
            value: acc.account_name,
            label: `${acc.account_name} (${acc.currency_code} ${acc.account_balance})`,
          })) || ACCOUNT_OPTIONS_DEFAULT,
      variant: VARIANT_DEFAULT,
    }),
    [destinationAccountsResponse, formData.originAccountId, isOpenOnChosenDay],
  );

  // A selection already made may stop qualifying when the date moves back. Both
  // legs are cleared together and both dropdowns reset with them: clearing one
  // while the other keeps its displayed label would leave the form showing a
  // value its state no longer holds.
  useEffect(() => {
    const originStillOffered =
      !formData.origin ||
      filteredOriginOptions.some((option) => option.value === formData.origin);

    const destinationStillOffered =
      !formData.destination ||
      destinationAccountOptions.options.some(
        (option) => option.value === formData.destination,
      );

    if (originStillOffered && destinationStillOffered) return;

    setFormData((prev) => ({
      ...prev,
      origin: '',
      originAccountId: undefined,
      destination: '',
      destinationAccountId: undefined,
    }));
    setIsReset(true);
  }, [
    filteredOriginOptions,
    destinationAccountOptions,
    formData.origin,
    formData.destination,
    setFormData,
  ]);

  //-------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  // 📡 Post Request logic
  type PayloadType = MovementValidatedDataType & {
    user?: string;
    type?: string;
    // The day the movement happened, as the calendar label the server validates.
    transactionActualDate: string;
  };
  //---
  //DATA POST FETCHING
  // const { data, isLoading, error:errorPost, requestFn } = useFetchLoad<
  const {
    isLoading,
    error: errorPost,
    requestFn,
    resetFn,
  } = useFetchLoad<MovementTransactionResponseType, PayloadType>({
    url: url_movement_transaction_record,
    method: 'POST',
  });

  const error =
    errorPost || fetchedErrorDestinationAccounts || fetchedErrorOriginAccounts;

  // =================================
  // ⏳ SIDE EFFECTS (SINCRONIZACIÓN)
  // =================================
  useEffect(() => {
    const total_balance = balanceBankResponse.apiData?.data?.total_balance;
    if (typeof total_balance === 'number') {
      setAvailableBudget(total_balance);
    }
  }, [balanceBankResponse.apiData, setAvailableBudget]);

  //==================================
  // ✍️ Event Handlers
  // =================================
  const handleAmountChange = createNumberHandler('amount');

  const handleCurrencyChange = useCallback(
    (newCurrency: CurrencyType) => {
      updateCurrency(newCurrency);
    },
    [updateCurrency],
  );
  //-------
  // const handleOriginChange = createDropdownHandler('origin');
  const handleOriginChange = useCallback(
    (selectedOption: DropdownOptionType | null) => {
      const accountName = selectedOption?.value || '';

      // Find data completed account for Origin
      const selectedAccount = originAccountsResponse?.data?.accountList?.find(
        (acc) => acc.account_name === accountName,
      );

      setFormData((prev) => ({
        ...prev,
        origin: accountName,
        originAccountId: selectedAccount?.account_id,
      }));

      //Validation and cleaning of validation messages
      if (accountName) {
        setValidationMessages((prev) => ({ ...prev, origin: '' }));
      }
    },
    [
      originAccountsResponse?.data?.accountList,
      setFormData,
      setValidationMessages,
    ],
  );

  //--------------------------------
  // const handleDestinationChange = createDropdownHandler('destination');
  const handleDestinationChange = useCallback(
    (selectedOption: DropdownOptionType | null) => {
      const accountName = selectedOption?.value || '';
      const selectedAccount =
        destinationAccountsResponse?.data.accountList.find(
          (acc) => acc.account_name === accountName,
        );
      setFormData((prev) => ({
        ...prev,
        destination: accountName, //selectedAccount.account_name
        destinationAccountId: selectedAccount?.account_id,
      }));
      if (accountName) {
        setValidationMessages((prev) => ({ ...prev, destination: '' }));
      }
    },
    [
      destinationAccountsResponse?.data?.accountList,
      setFormData,
      setValidationMessages,
    ],
  );

  //-------------------------------
  const handleNoteChange = createTextareaHandler('note');
  //---
  //Radio Input Handlers
  const handleOriginAccountTypeChange = useCallback(
    (newType: string) => {
      setFormData((prev) => ({
        ...prev,
        originAccountType: newType as Exclude<
          TransferAccountType,
          'income_source'
        >,
        origin: '', // Reset origin when type changes
        originAccountId: undefined, // Reset ID
      }));
      //----
      // Reset validation
      setValidationMessages((prev) => ({ ...prev, origin: '' }));
      // force reset of dropdown
      setIsResetOriginAccount(false); // first deactivate
      setTimeout(() => setIsResetOriginAccount(true), 10); //Then activate for following render
    },
    [setFormData, setValidationMessages],
  );

  //---
  const handleDestinationAccountTypeChange = useCallback(
    (newType: string) => {
      setFormData((prev) => ({
        ...prev,
        destinationAccountType: newType as Exclude<
          TransferAccountType,
          'category_budget'
        >,
        destination: '', // Reset destination when type changes
        destinationAccountId: undefined, //Reset account ID
      }));

      //Reset Validation
      setValidationMessages((prev) => ({ ...prev, destination: '' }));
      //force reset of dropdown
      setIsResetDestinationAccount(false); //first deactivate
      setTimeout(() => setIsResetDestinationAccount(true), 10); //Then activate for following rendering
    },
    [setFormData, setValidationMessages],
  );

  //-------------------------------------
  //--Handler submit form
  // One path, two entries: the + button's click, and Enter in any field, which
  // reaches this through the form's onSubmit. preventDefault below serves both,
  // and it is why clicking + does not also fire the submit.
  async function onSaveHandler(
    e: React.MouseEvent<HTMLButtonElement> | React.FormEvent<HTMLFormElement>,
  ) {
    // console.log('On Save Handler');
    e.preventDefault();
    if (resetFn) resetFn();
    setShowMessage(true);
    setMessageToUser('Processing transaction...');
    //--data validation messages --
    activateAllValidations();
    
    const { fieldErrors, dataValidated } = validateAll();
    
    //-----DEBUG
    console.log('🔍 [DEBUG] formData.currency:', formData.currency);
    console.log('🔍 [DEBUG] formData.amount:', formData.amount);
    console.log('🔍 [DEBUG] fieldErrors completo:', fieldErrors);
    console.log('🔍 [DEBUG] fieldErrors keys length:', Object.keys(fieldErrors).length);
    console.log('🔍 [DEBUG] fieldErrors stringified:', JSON.stringify(fieldErrors));
        
    //----------

    if (formData.origin === formData.destination) {
      fieldErrors.destination = 'Origin and destination must be different';
    }

    if (Object.keys(fieldErrors).length > 0) {
    //DEBUG
    console.log('🔍 [DEBUG] Entrando al if de fieldErrors');
    
      setValidationMessages(fieldErrors);
      setMessageToUser(CORRECTION_PROMPT);
      setTimeout(() => {
        setShowMessage(false);
        setMessageToUser(null);
      }, 4000);
      return;
    }
    //---------------------------------------
    //POST ENDPOINT FOR MOVEMENT TRANSACTION
    //update balance account of bank account and category budget account in: user_accounts table.

    //record both transaction descriptions: transfer and receive transactions with the correspondent account info.

    //endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=expense
    //user id is sent via req.body
    try {
      if (!dataValidated) {
        throw new Error('Validation failed. Please check your inputs.');
      }
      const payload: PayloadType = {
        ...dataValidated,
        type: typeMovement,
        transactionActualDate,
      };

      // const payload: PayloadType = {
      // amount: Number(formData.amount),
      // origin: formData.origin,
      // destination: formData.destination,
      // note: formData.note,
      // currency: formData.currency,
      // originAccountType: formData.originAccountType,
      // destinationAccountType: formData.destinationAccountType,
      // type: typeMovement,
      //   };
      //  console.log('compare', dataValidated, payload)
      const finalUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;
      const response = await requestFn(payload, {
        url: finalUrl,
      } as AxiosRequestConfig);

      if (response?.error) {
        throw new Error(
          response?.error ||
            error ||
            'An unexpected error occurred during submission.',
        );
      }

      // Caches holding transaction-derived data are now stale. Issues no request.
      notifyTransactionRecorded();

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        // console.log('Data from record transaction request:', response);
      }
      // -------------------------------------
      // ✅ Update total balance after success
      // -------------------------------------
      //1. Get the immediate new balance
      const newTotalBalance = await fetchNewBalance();
      //2. Update global state of Zustand store
      if (typeof newTotalBalance === 'number') {
        setAvailableBudget(newTotalBalance);
        // 🔥 Éxito: Llamada segura dentro del handler
      }

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        // console.log('Data from record transaction request:',  response.data);
      }
      //-----------------------------
      setMessageToUser('Transaction recorded successfully!');
      setShowMessage(true);
      //-------------------------------
      //reset the state and the selected options on select component
      resetForm(); //from useFormManager
      setReloadTrigger((prev) => prev + 1);
      setIsReset(true);
      setTimeout(() => {
        setMessageToUser(null);
        setShowMessage(false);
        setIsReset(false);
      }, 4000);

      if (resetFn) resetFn();

      // setMessageToUser('Transfer completed successfully!');
      // setCurrency(DEFAULT_CURRENCY);
    } catch (error) {
      console.error('Submission error:', error);
      const errorMessage = handleApiError(error);
      setMessageToUser(errorMessage);
      setTimeout(() => {
        setMessageToUser(null);
        setShowMessage(false);
      }, 5000);
    }
  }
  //--------------------------------
  // ⏳--- Side Effects--/--Efectos secundarios
  //--------------------------------
  useEffect(() => {
    if (isReset) {
      const timer = setTimeout(() => {
        setIsReset(false);
        setIsResetOriginAccount(false);
        setIsResetDestinationAccount(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isReset]);
  //------------------------------
  // 📄 Rendering UI Components
  //------------------------------
  //-------Top Card elements------
  const topCardElements = {
    titles: { title1: 'amount', title2: 'origin', label2: 'From: ' }, //title1 and title2, deben coincidir con el key de validation messages / these titles must match to validation messages keys
    value: formData.amount,
    selectOptions: originAccountOptionsToRender,
  };

  // console.log('validation messages', validationMessages, data);
  //-----------------------------------
  return (
    <>
      <form
        autoComplete={'off'}
        className='transfer'
        style={{ color: 'inherit' }}
        onSubmit={onSaveHandler}
      >
        {/* start of TOP CARD */}
        <TopCard
          topCardElements={topCardElements}
          validationMessages={validationMessages}
          setValidationMessages={setValidationMessages}
          updateTrackerData={handleAmountChange}
          trackerName={trackerState}
          currency={formData.currency}
          updateCurrency={handleCurrencyChange}
          setSelectState={setFormData}
          isReset={isReset}
          setIsReset={setIsReset}
          //specific reset for dropdown
          isResetDropdown={isResetOriginAccount}
          setIsResetDropdown={setIsResetOriginAccount}
          customSelectHandler={handleOriginChange}
          radioInputProps={{
            radioOptionSelected:
              formData.originAccountType ??
              initialMovementData.originAccountType!,
            inputRadioOptions: inputRadioOptionsAccountTopCard,
            setRadioOptionSelected: handleOriginAccountTypeChange,
            title: '',
            disabled:
              isLoading ||
              isLoadingOriginAccounts ||
              isLoadingDestinationAccounts,
            accountTypeSelectionMode: 'inputChipMode',
            labelId: 'origin',
          }}
          transactionDateProps={transactionDateProps}
        />
        {/* end of TOP CARD */}

        <CardSeparator />

        {/*start of BOTTOM CARD */}
        <div className='state__card--bottom'>
          <div className='account card--title card--title--top'>
            <span className='account-label'>To:</span>
            {/* <div className="radio-input-container"> */}
            {/* <div className="radio-input__options"> */}
            <RadioInput
              radioOptionSelected={
                formData.destinationAccountType ??
                initialMovementData.destinationAccountType!
              }
              inputRadioOptions={inputRadioOptionsAccountBottomCard}
              setRadioOptionSelected={handleDestinationAccountTypeChange}
              title={''}
              labelId='destination'
              disabled={
                isLoading ||
                isLoadingOriginAccounts ||
                isLoadingDestinationAccounts
              }
              accountTypeSelectionMode='inputChipMode'
            />
            {/* </div>  */}
            {/* </div> */}
          </div>

          <div className='validation__errMsg'>
            {validationMessages['destination']}
          </div>
          {/* "To", the word above it, and not the placeholder: the placeholder
              reads "Select Account" on BOTH of this screen's dropdowns, so it
              cannot tell the origin from the destination — and it goes empty
              while the account list is still on the wire, which would leave the
              control with no name at all. */}
          <DropDownSelection
            dropDownOptions={destinationAccountOptions}
            updateOptionHandler={handleDestinationChange}
            ariaLabel='To'
            isReset={isReset}
            setIsReset={setIsReset}
            setIsResetDropdown={setIsResetDestinationAccount}
            isResetDropdown={isResetDestinationAccount}
          />

          <CardNoteSave
            title={'note'}
            validationMessages={validationMessages}
            dataHandler={handleNoteChange}
            inputNote={formData.note}
            onSaveHandler={onSaveHandler}
            isDisabled={
              isLoading ||
              isLoadingOriginAccounts ||
              isLoadingDestinationAccounts
            }
            showError={showValidation.note}
          />
          {/* end of BOTTOM CARD */}
        </div>
      </form>

      {showMessage && messageToUser && (
        <div className='fade-message'>
          <MessageToUser
            isLoading={false}
            error={error}
            messageToUser={messageToUser}
            variant='tracker'
            tone={
              messageToUser === CORRECTION_PROMPT ? 'correction' : 'confirmation'
            }
          />
        </div>
      )}
    </>
  );
}
export default Transfer;
