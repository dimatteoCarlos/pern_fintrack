//pages/tracker/debts/debts.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import CardSeparator from '../components/CardSeparator.tsx';
import { validationData } from '../../../helpers/functions.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';
import {
  url_get_accounts_by_type,
  url_get_total_account_balance_by_type,
  url_movement_transaction_record,
} from '../../../endpoints.ts';
import { useLocation } from 'react-router-dom';
// import Datepicker from '../../../general_components/datepicker/Datepicker.tsx';
import {
  CurrencyType,
  DebtsTrackerInputDataType,
  DebtsTransactionType,
  DropdownOptionType,
  FormNumberInputType,
  VariantType,
  // DebtType,
  // TopCardSelectStateType,
  // TransactionType,
} from '../../../types/types.ts';
// import { numberFormat } from '../../../helpers/functions.ts';
import {
  // CURRENCY_OPTIONS,
  DEBTOR_OPTIONS_DEFAULT,
  DEFAULT_CURRENCY,
  PAGE_LOC_NUM,
} from '../../../helpers/constants.ts';
import TopCard from '../components/TopCard.tsx';
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import {
  AccountByTypeResponseType,
  AccountListType,
  BalanceBankRespType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.tsx';
import useBalanceStore from '../../../stores/useBalanceStore.ts';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import axios, { AxiosRequestConfig } from 'axios';
import RadioInput from '../../../general_components/radioInput/RadioInput.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
//----------------------------------------------------
const VARIANT_DEFAULT: VariantType = 'tracker';
//temporary values
const defaultCurrency: CurrencyType = DEFAULT_CURRENCY;
// const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
// console.log('🚀 ~ Debts ~ formatNumberCountry:', formatNumberCountry);

//constants
//input debts datatracked variables
const initialTrackerData: DebtsTrackerInputDataType = {
  amount: 0,
  debtor: '',
  currency: defaultCurrency,
  type: 'lend',
  date: new Date(),
  note: '',

  account: '',
  accountType: 'bank',
};

const initialFormData: FormNumberInputType = {
  amount: '',
};

//--RadioOption selection
// for account types
const inputRadioOptionsAccountType = [
  { value: 'bank', label: 'bank' },
  { value: 'investment', label: 'investment' },
  { value: 'pocket_saving', label: 'pocket' },
];

//for debt transaction type
const inputRadioOptionsDebtTransactionType = [
  { value: 'lend', label: 'lend' },
  { value: 'borrow', label: 'borrow' },
];

//----Debt Tracker Movement -------
function Debts(): JSX.Element {
  //rules:lend/borrow is equivalent to a deposit/withdraw in deptor account. User must enter the type and counter account selection.

  const trackerState = useLocation().pathname.split('/')[PAGE_LOC_NUM];

  const typeMovement = trackerState.toLowerCase();
  // console.log('movement:', typeMovement);

  //deal here with user id and authentication
  const user = import.meta.env.VITE_USER_ID;

  //-----------------------------------------------------

  //---states--------
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [type, setType] = useState<DebtsTransactionType>('lend');

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [isReset, setIsReset] = useState<boolean>(false);

  const [datatrack, setDataTrack] = useState<DebtsTrackerInputDataType>(
    // | TopCardSelectStateType
    initialTrackerData
  );

  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null
  );

  const [showMessage, setShowMessage] = useState(false);

  //--------------------------------------------
  const setAvailableBudget = useBalanceStore(
    (state) => state.setAvailableBudget
  );
  //--------------------------------------------------
  const [isResetAccount, setIsResetAccount] = useState<boolean>(true);

  //-----------------------------
  //----Debtors Options----------
  //debtors
  //DATA FETCHING
  const fetchDebtorUrl = user
    ? `${url_get_accounts_by_type}/?type=debtor&user=${user}`
    : //<Navigate to = '/auth'/>
      undefined; //this forces to user required error

  const {
    apiData: debtorsResponse,
    error: fetchedErrorDebtors,
    isLoading: isLoadingDebtors,
  } = useFetch<AccountByTypeResponseType>(fetchDebtorUrl as string);

  //apply debounce
  // console.log('debtors datatrack:', debtorsResponse);
  //define what to do when error
  const debtors = useMemo(
    () =>
      //  if (fetchedErrorDebtors) {
      //       return DEBTOR_OPTIONS_DEFAULT;
      //     }
      !fetchedErrorDebtors &&
      !isLoadingDebtors &&
      debtorsResponse?.data.accountList.length
        ? debtorsResponse.data.accountList.map((debtor) => ({
            value: `${debtor.account_name}`,
            label: debtor.account_name,
          }))
        : DEBTOR_OPTIONS_DEFAULT,
    [debtorsResponse?.data.accountList, fetchedErrorDebtors, isLoadingDebtors]
  );

  const debtorOptions = {
    title: debtorsResponse?.data.accountList.length ? 'Debtors' : '', //'No info. available',
    options: debtors,
    variant: VARIANT_DEFAULT as VariantType,
  };

  //---------------------------------------------
  // Fetch counter accounts
  //GET: ACCOUNTS OF TYPE DESTINATION AVAILABLE
  //DATA FETCHING

  const fetchAccountUrl = user
    ? `${url_get_accounts_by_type}/?type=${datatrack.accountType}&user=${user}`
    : // <Navigate to='/auth' />
      undefined;

  const {
    apiData: accountsResponse,
    isLoading: isLoadingAccounts,
    error: fetchedErrorAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchAccountUrl as string);

  // console.log('🚀 ~ Debts ~ accountsResponse:', accountsResponse);

  const optionsAccounts = useMemo(() => {
    if (fetchedErrorAccounts) {
      return [];
    }

    const optionsAccountList = accountsResponse?.data.accountList ?? [];

    return optionsAccountList.length
      ? optionsAccountList.map((acc: AccountListType) => ({
          value: acc.account_name,
          label: acc.account_name,
        }))
      : [];
  }, [accountsResponse?.data.accountList, fetchedErrorAccounts]);

  const accountOptionsToRender = {
    title: accountsResponse?.data.accountList.length ? 'Accounts' : '', //'No accounts available',}
    options: optionsAccounts,
    variant: VARIANT_DEFAULT as VariantType,
  };

  //---------------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  //extend the type of input data with user id
  type PayloadType = DebtsTrackerInputDataType & { user: string };

  //DATA POST FETCHING
  const { data, isLoading, error, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });

  //------------------------------------------------
  //---functions ------
  const updateDataCurrency = useCallback(
    (currency: CurrencyType) => {
      setCurrency(currency);
      setDataTrack((prev) => ({ ...prev, currency: currency }));
    },
    []
    // [currency]
  );

  const { inputNumberHandlerFn } = useInputNumberHandler(
    setFormData, //numeric state
    setValidationMessages,
    setDataTrack //setStateData
  );

  function updateTrackerData(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    e.preventDefault();
    const { name, value } = e.target;

    if (name === 'amount') {
      inputNumberHandlerFn(name, value);
    } else {
      setDataTrack((prev) => ({ ...prev, [name]: value }));
    }
  }

  //-----for old version toggle button
  // const toggleType = useCallback(
  //   (e: React.MouseEvent<HTMLButtonElement>) => {
  //     e.preventDefault();

  //     setType((prev: DebtsTransactionType) =>
  //       prev === 'lend' ? 'borrow' : 'lend'
  //     );
  //   },
  //   []
  //   // [type]
  // );
  //---change date in datepicker
  // function changeDateFn(selectedDate: Date): void {
  //   setDataTrack((prev) => ({ ...prev, date: selectedDate }));
  // }

  //---for new version with radio input transaction type selection
  //RadioInput for transaction type selection
  function handleTransactionTypeChange(newType: DebtsTransactionType) {
    setDataTrack((prev) => ({ ...prev, type: newType }));
  }

  //for DropdownSelection of counter balance account
  function accountSelectHandler(selectedOption: DropdownOptionType | null) {
    // const selectedAccount = accountsResponse?.data?.accountList.find(
    //   (acc) => acc.account_name === selectedOption?.value
    // );

    // console.log(
    //   '🚀 ~ accountSelectHandler ~ selectedAccount:',
    //   selectedAccount?.account_balance,
    // );

    setDataTrack((prev) => ({
      ...prev,
      ['account']: selectedOption?.value || '',
    }));

    setValidationMessages((prev) => ({ ...prev, account: '' }));
  }

  //--------
  //RadioInput for account type selection
  function handleAccountTypeChange(newAccountType: string) {
    //reset dropdown selected values
    setDataTrack((prev) => ({
      ...prev,
      account: '', //reset dropdown selected values
      accountType: newAccountType,
      // destination: '',
    }));

    //reset error messages
    setValidationMessages((prev) => ({
      ...prev,
      account: '',
      accountType: '',
    }));

    //force reset dropdown selected value for account in the DropdownSelect compoenent
    setIsResetAccount(false);
    setTimeout(() => setIsResetAccount(true), 100);
  }
  //-----------------------------------------------
  //--submit form
  async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('On Save Handler');
    e.preventDefault();

    //-------------------------
    // const formattedNumber = numberFormat(datatrack.amount || 0);
    // console.log(
    //   'formatted amount as a string:',
    //   { formattedNumber },
    //   typeof formattedNumber
    // );
    //----entered datatrack validation messages --------
    const newValidationMessages = validationData(datatrack);

    console.log('values', Object.values(newValidationMessages));

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }

    //----------------------------
    //ENDPOINT HERE FOR POSTING

    //update balance account of debtor account and counter part slack account in: user_accounts table.
    //record both transaction descriptions: transfer and receive transactions with the correspondent account info.
    // there should be also a debtor_accounts table, updated with specific debtor data
    //endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=debts
    //user id is sent via req.body btu can be sent via query param ttoo
    try {
      const payload = { ...datatrack, user } as PayloadType;

      const postUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;

      const data = await requestFn(payload, {
        url: postUrl,
      } as AxiosRequestConfig);

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from record transaction request:', data);
      }

      //reset the state and the selected options on select component
      setCurrency(defaultCurrency);
      setIsReset(true);
      setDataTrack({
        ...initialTrackerData,
        date: new Date(),
        currency: defaultCurrency,
      });

      setType('lend');
      setValidationMessages({});
      updateDataCurrency(defaultCurrency);
      setFormData(initialFormData);
      setTimeout(() => {
        setIsReset(false);
      }, 100);

      //-------------------------------
      //update total available budget global state
      const {
        data: {
          data: { total_balance },
        },
      } = await axios.get<BalanceBankRespType>(
        `${url_get_total_account_balance_by_type}/?type=bank&user=${user}`
      );

      if (typeof total_balance === 'number') {
        setAvailableBudget(total_balance);
      }
      //----------------------------------
    } catch (error) {
      console.error('Submission error:', error);
      setMessageToUser('Error processing transaction debt');
      setShowMessage(true);
    }
  }
  //---------------------------------
  //-------Top Card elements
  const topCardElements = {
    titles: { title1: 'amount', title2: 'debtor' },
    value: formData.amount,
    selectOptions: debtorOptions,
  };
  //---------------------------------
  //Handle states related to the data submit form
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if ((data || error) && !isLoading) {
      const success = data && !error;
      setMessageToUser(
        success
          ? 'Movement completed successfully!'
          : error ?? 'An error occurred during submission'
      );
      setShowMessage(true);

      timer = setTimeout(() => {
        setMessageToUser(null);
        setShowMessage(false);
      }, 8000);
    }

    return () => clearTimeout(timer);
  }, [data, error, isLoading]);

  //-----useEffect--------
  useEffect(() => {
    // updateDataCurrency(currency);
    // multi currency option?
    // setDataTrack((prev) => ({ ...prev, currency: currency }));
    //it seems that this is not necessary? why?
    setDataTrack((prev) => ({ ...prev, type: type }));
  }, [type]);
  // }, [currency, type, updateDataCurrency]);
  //--------------------------
  return (
    <>
      <form className='debts' style={{ color: 'inherit' }}>
        {/* TOP CARD */}
        <TopCard
          topCardElements={topCardElements}
          validationMessages={validationMessages}
          updateTrackerData={updateTrackerData}
          trackerName={trackerState}
          currency={currency}
          updateCurrency={updateDataCurrency}
          // selectedValue={datatrack.debtor}
          setSelectState={setDataTrack}
          isReset={isReset}
          setIsReset={setIsReset}
          // selectedValue={movementInputData.account}
          //radio input prop

          radioInputProps={{
            radioOptionSelected: datatrack.type ?? initialTrackerData.type!,
            inputRadioOptions: inputRadioOptionsDebtTransactionType,
            setRadioOptionSelected: handleTransactionTypeChange,
            title: '',
            // setRadioOptionSelected: setOriginAccountType,
          }}
          //---------
          // customSelectHandler={accountSelectHandler}
        />

        <CardSeparator />

        {/* BOTTOM CARD */}
        <div className='state__card--bottom'>
          <div className='account card--title card--title--top'>
            Account
            <RadioInput
              radioOptionSelected={
                datatrack.accountType ?? initialTrackerData.accountType!
              }
              inputRadioOptions={inputRadioOptionsAccountType}
              setRadioOptionSelected={handleAccountTypeChange}
              title={''}
              labelId='account'

              // disabfled={radioInputProps.disabled}
            />
          </div>
          <div className='validation__errMsg'>
            {validationMessages['destination']}
          </div>
          <DropDownSelection
            dropDownOptions={accountOptionsToRender}
            updateOptionHandler={accountSelectHandler}
            isReset={isReset}
            setIsReset={setIsReset}
            setIsResetDropdown={setIsResetAccount}
            isResetDropdown={isResetAccount}
          />
          {/* <div className='card__typeDate__container'> */}
          {/*            <div className='card__typeDate--type'>
              <div className='card--title'>Type</div>
              <button className='card__screen--type' onClick={toggleType}>
                <div className='screen--concept'>{type}</div>
              </button>
            </div>*/}

          {/* <div className='card__typeDate--date'>
              <div className='card--title'>Date</div>
              <div className='card__screen--date'>
                <Datepicker
                  changeDate={changeDateFn}
                  date={datatrack.date ?? new Date()}
                  variant='tracker'
                  isReset={isReset}
                ></Datepicker>
              </div>
            </div> */}
          {/* </div> */}

          <CardNoteSave
            title={'note'}
            validationMessages={validationMessages}
            dataHandler={updateTrackerData}
            inputNote={datatrack.note}
            onSaveHandler={onSaveHandler}
          />
        </div>
      </form>
      {/*
      <MessageToUser
        isLoading={isLoading || isLoadingAccounts || isLoadingDebtors}
        //probar que muestra como error o si muestra algo
        error={error || fetchedErrorDebtors}
        messageToUser={messageToUser}
        variant='tracker'
      />
*/}
      {showMessage && !isLoading && (
        <div className='fade-message'>
          <MessageToUser
            isLoading={isLoading || isLoadingAccounts || isLoadingDebtors}
            // isLoading={false}
            error={error || fetchedErrorDebtors}
            messageToUser={messageToUser}
            variant='form'
          />
        </div>
      )}
    </>
  );
}

export default Debts;
