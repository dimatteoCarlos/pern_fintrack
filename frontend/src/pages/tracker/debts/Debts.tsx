//pages/tracker/debts/debts.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import CardSeparator from '../components/CardSeparator.tsx';
import { capitalize, checkNumberFormatValue, validateAmount, validationData } from '../../../helpers/functions.ts';
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
//---------------------------------------------
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
  //------------------------------------------
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

  const [isAmountError, setIsAmountError] = useState<boolean>(false);  

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null
  );

  // const [showMessage, setShowMessage] = useState(false);

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
    ? `${url_get_accounts_by_type}/?type=debtor&user=${user}&${reloadTrigger}`
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
          label:`${debtor.account_name} (${debtor.currency_code} ${debtor.account_balance}) (${debtor.account_balance>=0? 'Debtor':'Lender'})`,
            value: `${debtor.account_name}`,
           // label: debtor.account_name,
          })
        )
        : DEBTOR_OPTIONS_DEFAULT,
    [debtorsResponse?.data.accountList, fetchedErrorDebtors, isLoadingDebtors]
  );
//----------------------------------
  const debtorOptions = {
    title: debtorsResponse?.data.accountList.length ? 'Select Debtor/Lender' : 'No Debtor/Lender found', //'No info. available',
    options: debtors,
    variant: VARIANT_DEFAULT as VariantType,
  };
  //------------------------------------------
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
  //-------------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  //extend the type of input data with user id
  type PayloadType = DebtsTrackerInputDataType & { user: string };

  //DATA POST FETCHING
  const { data, isLoading, error:postError, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });
  //-----------------------------------------
  const error = fetchedErrorDebtors || fetchedErrorAccounts || postError
  //-----------------------------------------
  //---functions ------
  const updateDataCurrency = useCallback(
    (currency: CurrencyType) => {
      setCurrency(currency);
      setDataTrack((prev) => ({ ...prev, currency: currency }));
    },
    []
    // [currency]
  );

  const { inputNumberHandlerFn,  } = useInputNumberHandler(
    setFormData, //numeric state
    setValidationMessages,//validation message for amount
    setDataTrack, //setStateData with valueToSave in db
    setIsAmountError,
    setMessageToUser
  );
  
  //--update input data
  function updateTrackerData(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    console.log('updateTrackerData')
    e.preventDefault();
    const { name, value } = e.target;
    // console.log('target', e.target)

    if (name === 'amount') {
      //update amount value with value input entered, set validation message for amount either format message or error format message, set amount state value with valueToSave, in case of error valueToSave is "".
      console.log('cono pasa por aqui')
      inputNumberHandlerFn(name, value);

//inmeadiate validation of amount
      if(isAmountError){
      console.log('validationsMessages',validationMessages)
      return;
    }

    const errorValidationAmount = validateAmount(value);

    if(errorValidationAmount){
      setValidationMessages((prev)=>({...prev, [name]:errorValidationAmount}))
      setIsAmountError(true)
      return
    }
      // inputNumberHandlerFn(name, value);
      
    } else {
      setDataTrack((prev) => ({ ...prev, [name]: value }));

     //---VALIDACIÓN PUNTUAL / LOCAL VALIDATION
      setValidationMessages((prev)=>{
      const updatedErrorMessages = {...prev}

      if(value ==='' || value ===null){
      updatedErrorMessages[name]=`* Please provide the ${capitalize(name)}`
      } 
      else if(!isNaN(Number(value)) && Number(value)<=0){updatedErrorMessages[name]=`* ${capitalize(name)} negative or cero values are not allowed`}
      else{delete updatedErrorMessages[name]}

      return updatedErrorMessages}
      )
//--- 
    }
  }

//---for new version with radio input transaction type selection
//RadioInput for transaction type selection
  function handleTransactionTypeChange(newType: DebtsTransactionType) {
    setDataTrack((prev) => ({ ...prev, type: newType }));
  }

  //for DropdownSelection of account
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
  //===================================
 //amount validation
 const amountString = formData.amount;
 console.log('amount on save',formData.amount, datatrack.amount, 'errorMsgs', validationMessages )

 const amountChecked = checkNumberFormatValue(amountString)
 console.log(amountChecked)

 if(amountChecked.isError && !amountChecked.valueToSave){
  setValidationMessages(prev =>({...prev, amount:amountChecked.formatMessage}));
  setDataTrack(prev=>({...prev, amount:""}))
  return
 }
//----------------
  setValidationMessages(prev =>({...prev, amount:""}));

  setDataTrack(prev=>({...prev, amount:amountChecked?.valueToSave as number}))

  //===================================
    //-------------------------
    //----entered datatrack validation messages --------
    const newValidationMessages = validationData(datatrack);

    console.log('newValidationMessages values', Object.values(newValidationMessages), isAmountError);

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //----------------------------
    //ENDPOINT HERE FOR POSTING
    //endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=debts
    //user id is sent via req.body but can be sent via query param too
    try {
      const payload = { ...datatrack,
         user } as PayloadType;

      const postUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;

      const data = await requestFn(payload, {
        url: postUrl,
      } as AxiosRequestConfig);

      if(error){
      setMessageToUser(error)
      console.log(error, 'desde sumit')
      return
      }
      console.log('data despues del post', data)

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from record transaction request:', data);
      }

      //-------------------------------
      //update total available in bank accounts. global state
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
      // setShowMessage(true);
    }
  }
  //--------------------------------------
  //------- Top Card elements ------------
  const debtorAccountLabel = datatrack.type ==='lend'?'debtor':'lender'
  const topCardElements:TopCardElementsType = {
    titles: { title1: 'amount', title2: 'debtor', label2:debtorAccountLabel },
    value: formData.amount,
    selectOptions: debtorOptions,
  };
  //---------------------------------
  //Handle states related to the data submit form
  //-----useEffect--------
  useEffect(()=>{
  // if( !isLoading){setShowMessage(true);}
  if(data && !isLoading && !error && !isAmountError){
  // setShowMessage(true);
  //--success
      setMessageToUser('Movement completed successfully!');
     
  //if success, reset the state and the selected options on select component
        setIsReset(true);
        setValidationMessages({});
        setFormData(initialFormData);
        setReloadTrigger(prev=>prev+1)
        setCurrency(defaultCurrency);
        setDataTrack({
          ...initialTrackerData,
          date: new Date(),
          currency: defaultCurrency,
        });
        setType('lend');
        updateDataCurrency(defaultCurrency);

}else if(!isLoading && (error || isAmountError)){
  //setShowMessage(true);
  console.log('error', error, isAmountError)
  setMessageToUser(error ?? (isAmountError? "Enter a valid amount":""))
}

const timer:ReturnType<typeof setTimeout>  = setTimeout(()=>{setMessageToUser(null)
  // setShowMessage(false)
},5000);

return ()=>{if(timer)clearTimeout(timer)
  // setShowMessage(false)
  setTimeout(() => {
  setIsReset(false);
      }, 100);
  }
}, [data, error, isLoading,updateDataCurrency,isAmountError]
)

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
          setValidationMessages={setValidationMessages}
          updateTrackerData={updateTrackerData}
          trackerName={trackerState}
          currency={currency}
          updateCurrency={updateDataCurrency}
          setSelectState={setDataTrack}
          isReset={isReset}
          setIsReset={setIsReset}
          // isAmountError
          // setIsAmountError
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
      
      {/* {showMessage && !isLoading && ( */}
      {messageToUser  && (
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
