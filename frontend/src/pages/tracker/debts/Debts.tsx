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
  TopCardElementsType,
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
  //--------------------------------------------------
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

  const [isResetAccount, setIsResetAccount] = useState<boolean>(true);

  const [reloadTrigger, setReloadTrigger] = useState(0)
  //--------------------------------------------
  const setAvailableBudget = useBalanceStore(
    (state) => state.setAvailableBudget
  );
  //--------------------------------------------------
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
      !fetchedErrorDebtors &&
      !isLoadingDebtors &&
      debtorsResponse?.data.accountList.length
        ? debtorsResponse.data.accountList.map((debtor) => ({
            value: `${debtor.account_name}`,
            label: debtor.account_name,
          })
        )
        : DEBTOR_OPTIONS_DEFAULT,
    [debtorsResponse?.data.accountList, fetchedErrorDebtors, isLoadingDebtors]
  );

  const debtorOptions = {
    title: debtorsResponse?.data.accountList.length ? 'Select Debtor/Lender' : 'No Debtor/Lender found', //'No info. available',
    options: debtors,
    variant: VARIANT_DEFAULT as VariantType,
  };
  //--------------------------------------------
  // Fetch counter accounts
  //GET: ACCOUNTS OF TYPE DESTINATION AVAILABLE
  //DATA FETCHING

  const fetchAccountUrl = user
    ? `${url_get_accounts_by_type}/?type=${datatrack.accountType}&user=${user}&${reloadTrigger}`
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
          // label: acc.account_name,
          label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})`,
        }))
      : [];
  }, [accountsResponse?.data.accountList, fetchedErrorAccounts]);

  const accountOptionsToRender = {
    title: accountsResponse?.data?.accountList?.length? 'Select account' : 'No accounts available',
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

  //--------------------------------------------
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
  
  //---for new version with radio input transaction type selection
  //RadioInput for transaction type selection
  function handleTransactionTypeChange(newType: DebtsTransactionType) {
    setDataTrack((prev) => ({ ...prev, type: newType }));
  }

  //for DropdownSelection of counter balance account
  function accountSelectHandler(selectedOption: DropdownOptionType | null) {
    
    setDataTrack((prev) => ({
      ...prev,
      ['account']: selectedOption?.value || '',
    }));

    setValidationMessages((prev) => ({ ...prev, account: '' }));
  }

  //--------------------------------------
  //--submit form
  async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
    // console.log('On Save Handler');
    e.preventDefault();

    //-------------------------
    //----entered datatrack validation messages --------
    const newValidationMessages = validationData(datatrack);
    // console.log('values', Object.values(newValidationMessages));

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }

    //----------------------------
    //ENDPOINT HERE FOR POSTING
    //endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=debts
    //user id is sent via req.body but can be sent via query param ttoo
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
      setReloadTrigger(prev=>prev+1)
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
  const debtorAccountLabel = datatrack.type ==='lend'?'debtor':'lender'
  const topCardElements:TopCardElementsType = {
    titles: { title1: 'amount', title2: 'debtor', label2:debtorAccountLabel },
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
          : error ?? 'An error occurred during data submission'
      );
      setShowMessage(true);

      timer = setTimeout(() => {
        setMessageToUser(null);
        setShowMessage(false);
      }, 3000);
    }

    return () => clearTimeout(timer);
  }, [data, error, isLoading]);

  //-----useEffect--------
  useEffect(() => {
    setDataTrack((prev) => ({ ...prev, type: type }));
  }, [type]);

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
          setSelectState={setDataTrack}
          isReset={isReset}
          setIsReset={setIsReset}
          
        />

        <CardSeparator />

        {/* BOTTOM CARD */}
        <div className='state__card--bottom'>
          <div className='account card--title card--title--top'>
           {datatrack.type==='lend'?'From:':'To:'}
            
            <RadioInput
              radioOptionSelected=
              {
                datatrack.type ?? initialTrackerData.type!
              }

              inputRadioOptions={inputRadioOptionsDebtTransactionType}
              setRadioOptionSelected={handleTransactionTypeChange}
              title={''}
              labelId='transaction'
              // labelId='account'
              disabled={isLoading || isLoadingAccounts || isLoadingDebtors}
            />
          </div>

          <div className='validation__errMsg'>
            {validationMessages['account']}
          </div>

          <DropDownSelection
            dropDownOptions={accountOptionsToRender}
            updateOptionHandler={accountSelectHandler}
            isReset={isReset}
            setIsReset={setIsReset}
            setIsResetDropdown={setIsResetAccount}
            isResetDropdown={isResetAccount}
          />

          <CardNoteSave
            title={'note'}
            validationMessages={validationMessages}
            dataHandler={updateTrackerData}
            inputNote={datatrack.note}
            onSaveHandler={onSaveHandler}
            isDisabled = {isLoading || isLoadingAccounts || isLoadingDebtors}
          />
        </div>
      </form>
      
      {showMessage && !isLoading && (
        <div className='fade-message'>
          <MessageToUser
            isLoading={isLoading || isLoadingAccounts || isLoadingDebtors}

            error={error || fetchedErrorDebtors}
            
            messageToUser={messageToUser}
            variant='tracker'
          />
        </div>
      )}
    </>
  );
}

export default Debts;
