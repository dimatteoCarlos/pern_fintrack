//pages/tracker/debts/debts.tsx
//Customized input data validation procedure was implemented. No Zod. it considers validation of the current field in real time and whole form data validation when submitting.
// ============================
// 📦 IMPORT DEPENDENCIES
// ============================
// ⚛️ React Hooks
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosRequestConfig } from 'axios';
import { useLocation } from 'react-router-dom';
// =====================
// CUSTOM HOOKS
// =====================
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';
import { useFetch } from '../../../hooks/useFetch.ts';
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.ts';
// Zustand store
import useBalanceStore from '../../../stores/useBalanceStore.ts';
// =====================
// 🪝 HELPERS FUNCTIONS 
// =====================
import { capitalize } from '../../../helpers/functions.ts';
import { checkNumberFormatValue,validateAmount, validationData  } from '../../../validations/utils/custom_validation.ts';
import { fetchNewBalance } from '../../../auth/utils/fetchNewTotalBalance.ts';
// =====================
// 🌐 ENDPOINTS
// =====================
import {
  url_get_accounts_by_type,
  url_movement_transaction_record,
} from '../../../endpoints.ts';
// =====================
// UI COMPONENTS
//=====================
import CardNoteSave from '../components/CardNoteSave.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import RadioInput from '../../../general_components/radioInput/RadioInput.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import TopCardZod from '../components/TopCard.tsx';
import CardSeparator from '../components/CardSeparator.tsx';
// =====================
// 📝 TYPES
// =====================
import {
  AccountByTypeResponseType,
  AccountListType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';

import {
  CurrencyType,
  DebtsTrackerInputDataType,
  DebtsTransactionType,
  DropdownOptionType,
  FormNumberInputType,
  TopCardElementsType,
  VariantType,
} from '../../../types/types.ts';
// =====================
// CONSTANTS
// =====================
import {
  DEBTOR_OPTIONS_DEFAULT,
  DEFAULT_CURRENCY,
  PAGE_LOC_NUM,
} from '../../../helpers/constants.ts';

// ===================================
// ⚙️ CONSTANTS & INITIAL VALUES
// ===================================
const VARIANT_DEFAULT: VariantType = 'tracker';
const defaultCurrency: CurrencyType = DEFAULT_CURRENCY;
// Initial tracker data structure
const initialTrackerData: DebtsTrackerInputDataType = {
  amount: '',
  debtor: '',
  currency: defaultCurrency,
  type: 'lend',//default
  date: new Date(),//default
  note: '',
  account: '',
  accountType: 'bank',//default
};

const initialFormData: FormNumberInputType = {
  amount: '',
};

// Radio options for debt transaction type
const inputRadioOptionsDebtTransactionType = [
  { value: 'lend', label: 'lend' },
  { value: 'borrow', label: 'borrow' },
];
// =======================================
// ⚛️ MAIN COMPONENT: Debts Tracker
// =======================================
//---- Debts Tracker Movement ------------
function Debts(): JSX.Element {
//rules:lend/borrow is equivalent to a deposit/withdraw in deptor account. User must enter the type and counter account selection.
// =====================================
// 🗺️ ROUTE & USER CONFIGURATION
// =====================================
  const trackerState = useLocation().pathname.split('/')[PAGE_LOC_NUM];
  const typeMovement = trackerState.toLowerCase();
// console.info('tracker state', trackerState)
//-------------------------------
// const user = import.meta.env.VITE_USER_ID;
// =========================
// STATE MANAGEMENT
// =========================
// 🔄 Local States
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [type, setType] = useState<DebtsTransactionType>('lend');

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [isReset, setIsReset] = useState<boolean>(false);

  const [isResetAccount, setIsResetAccount] = useState<boolean>(true);

  const [datatrack, setDataTrack] = useState<DebtsTrackerInputDataType>(
  initialTrackerData
  );

  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);

  const [isAmountError, setIsAmountError] = useState<boolean>(false);  

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null
  );
  const [reloadTrigger, setReloadTrigger] = useState(0)

// 🌳 Global State (Zustand)
  const setAvailableBudget = useBalanceStore(
    (state) => state.setAvailableBudget
  );
  //map states account_name-account_id
  const [accountIdMap, setAccountIdMap]=useState<{[accountName:string]:string}>({})
  const [debtorIdMap, setDebtorIdMap]=useState<{[accountName:string]:string}>({})

// ==========================
// 📡 API DATA FETCHING
// Fetch debtors data
// ==========================
//---- Debtor account Options ------
  const fetchDebtorUrl = `${url_get_accounts_by_type}/?type=debtor&reload=${reloadTrigger}`

  const {
    apiData: debtorsResponse,
    error: fetchedErrorDebtors,
    isLoading: isLoadingDebtors,
  } = useFetch<AccountByTypeResponseType>(fetchDebtorUrl as string);

   const debtors = useMemo(() =>{
       if (fetchedErrorDebtors || isLoadingDebtors ||!debtorsResponse?.data.accountList.length) return DEBTOR_OPTIONS_DEFAULT;

       const newIdMap:{[accountName:string]:string} = {};
      
      const options = debtorsResponse?.data.accountList
        .map((debtor) => {
        newIdMap[debtor.account_name] = String(debtor.account_id);

          return {
          label:`${debtor.account_name} (${debtor.currency_code} ${debtor.account_balance}) (${debtor.account_balance>=0? 'Debtor':'Lender'})`,
          value: `${debtor.account_name}`,
          } 
          }
        );

      setDebtorIdMap(newIdMap);
      return options
      
    }, [debtorsResponse?.data.accountList, 
      fetchedErrorDebtors, isLoadingDebtors]
    );
 //----------------------------------
  const debtorOptions = {
    title: debtorsResponse?.data.accountList.length ? 'Select Debtor/Lender' : "", //'No info. available',
    options: debtors,
    variant: VARIANT_DEFAULT as VariantType,
  };
//-------------------------------------
// Fetch counter accounts
//GET: ACCOUNTS OF TYPE BANK AVAILABLE
//DATA FETCHING
  const fetchAccountUrl =`${url_get_accounts_by_type}/?type=${datatrack.accountType}&reload=${reloadTrigger}`
  const {
    apiData: accountsResponse,
    isLoading: isLoadingAccounts,
    error: fetchedErrorAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchAccountUrl as string);

// console.log('🚀 ~ Debts ~ accountsResponse:', accountsResponse);
// =====================
// DATA TRANSFORMATION
// =====================
// Process accounts data for dropdown
  const optionsAccounts = useMemo(() => {
    if (fetchedErrorAccounts) {
      return [];
    }
    const optionsAccountList = accountsResponse?.data.accountList ?? [];
    const idMap:{[accountName:string]:string} = {};

    const options =  optionsAccountList.length
    ? optionsAccountList.map((acc: AccountListType) => {
        idMap[acc.account_name] = acc.account_id.toString();
         return {      
          label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})`,
          value: acc.account_name,
         }
        })
      :[]
    
      setAccountIdMap(idMap);
      return options;
  }, [accountsResponse?.data.accountList, fetchedErrorAccounts]);

  const accountOptionsToRender = {
    title: accountsResponse?.data?.accountList?.length? 'Select account' : '',//'No accounts available',
    options: optionsAccounts,
    variant: VARIANT_DEFAULT as VariantType,
  };
// ===========================
// API REQUEST CONFIGURATION
// ===========================
//OBTAIN THE REQUESTFN FROM userFetchLoad
// 📡 Post Request logic
//extend the type of input data with user id
  type PayloadType = DebtsTrackerInputDataType & { user?: string , debtor_id?:string; account_id?:string;}
//----
//DATA POST FETCHING
  const { data, isLoading, error:postError, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });
//----------------------------
  const error = fetchedErrorDebtors || fetchedErrorAccounts || postError
// ==========================
// EVENT HANDLERS
// ==========================
//---- FUNCTIONS ------------
// Currency update handler
  const updateDataCurrency = useCallback(
    (currency: CurrencyType) => {
      setCurrency(currency);
      setDataTrack((prev) => ({ ...prev, currency: currency }));
    },[]
  );
  // Input number handler
  const { inputNumberHandlerFn,  } = useInputNumberHandler(
    setFormData, //numeric state
    setValidationMessages,//validation message for amount
    setDataTrack, //setStateData with valueToSave in db
    setIsAmountError,
    setMessageToUser
  );
  // Form field update handler
  //--update input data
  function updateTrackerData(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
  // console.log('updateTrackerData')
    e.preventDefault();
    const { name, value } = e.target;
    // console.log('target', e.target)

    if (name === 'amount') {
//update amount value with value input entered, set validation message for amount either format message or error format message, set amount state value with valueToSave, in case of error valueToSave is ""?.
    inputNumberHandlerFn(name, value);
    // Activar validaciones cuando se introduce un valor en amount
     if (value !== '') {
       setShowValidation(prev => ({
          ...prev,
          debtor: true,
          account: true,
          note: true
        }));
      }
//inmediate validation of amount
// console.log('validationsMessages',validationMessages)
    if(isAmountError){
      return;
    }
    const errorValidationAmount = validateAmount(value);
    if(errorValidationAmount){
      setValidationMessages((prev)=>({...prev, [name]:errorValidationAmount}))
      setIsAmountError(true)
      return
    }
    } else {
      setDataTrack((prev) => ({ ...prev, [name]: value }));

//---VALIDACIÓN PUNTUAL / LOCAL FIELD VALIDATION
     setValidationMessages((prev)=>{
      const updatedErrorMessages = {...prev}

      if(value ==='' || value ===null){
      updatedErrorMessages[name]=`* Please provide the ${capitalize(name)}`
      } 
      else if(!isNaN(Number(value)) && Number(value)<=0){ updatedErrorMessages[name]=`* ${capitalize(name)} negative or zero values are not allowed`}
      else{delete updatedErrorMessages[name]}

      return updatedErrorMessages
      }
    )
    }
  }
// TRANSACTION TYPE HANDLER
//radioinput for transaction type selection
  function handleTransactionTypeChange(newType: DebtsTransactionType) {
    setDataTrack((prev) => ({ ...prev, type: newType }));
  }
// Account selection handler
  function accountSelectHandler(selectedOption: DropdownOptionType | null) {
    setDataTrack((prev) => ({
      ...prev,
      ['account']: selectedOption?.value || '',
    }));
    setValidationMessages((prev) => ({ ...prev, account: '' }));
  }
 // =====================
 // Form submission handler
 // =====================
 async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
// console.log('On Save Handler');
    e.preventDefault();
//show all validation messages 
  setShowValidation({
    amount: true,
    debtor: true,
    account: true,
    note: true
  });    
//Amount validation
 const amountString = formData.amount;
// console.log('amount on save',formData.amount, datatrack.amount, 'errorMsgs', validationMessages )
 const amountChecked = checkNumberFormatValue(amountString)
//  console.log(amountChecked)

 if(amountChecked.isError && !amountChecked.valueToSave){
  setValidationMessages(prev =>({...prev, amount:amountChecked.formatMessage}));
  setDataTrack(prev=>({...prev, amount:''})) //string type
  return
 }
//----------------
  setValidationMessages(prev =>({...prev, amount:""}));
  setDataTrack(prev=>({...prev, amount:amountChecked?.valueToSave as number}))
//------------------------
//----entered datatrack validation messages --------------------------
// Form validation
    const newValidationMessages = validationData(datatrack);
  // console.log('newValidationMessages values', Object.values(newValidationMessages), isAmountError);

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
//------------------------------------
//API REQUEST. ENDPOINT HERE FOR POSTING
//endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=debts
//user id is sent via req.body but can be sent via query param too
 try {
  const debtorId = debtorIdMap[datatrack.debtor];
  const accountId = accountIdMap[datatrack.account];
  // console.log('accounts id', debtorId, accountId)
      const payload = { ...datatrack,
          debtor_id: debtorId, 
          account_id: accountId 
        } as PayloadType;
// console.log("🚀 ~ onSaveHandler ~ payload:", payload)
      const postUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;
//Submit to server    
      const {data, error:postError} = await requestFn(payload, {
        url: postUrl,
      } as AxiosRequestConfig);

      if (postError ) {
      const errorMsg = postError ?? "unexpected error"
      // console.log('response?.error?', errorMsg)
      throw new Error(errorMsg);
    }
    
      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from record transaction request:', data);
      }
// -------------------------------------
// ✅ Update total balance after success 
// -------------------------------------
//update GLOBAL BALANCE of total available in bank accounts. it's a global state
//1. Get the immediate new balance
    const newTotalBalance =  await fetchNewBalance()
    // console.log('newTotalBalance', newTotalBalance)
     if (typeof newTotalBalance === 'number') {
        setAvailableBudget(newTotalBalance);
      }else{ setMessageToUser('Check total_balance')}

      setMessageToUser('Debt transaction successfully recorded!');
      setTimeout(() => setMessageToUser(null), 3000);
      //----------------------------------
    } catch (error) {
      console.error('Submission error (Zod):', error);
      setMessageToUser(error instanceof Error ? error.message : 'An unexpected error occurred during submission.');
      setTimeout(() => setMessageToUser(null), 5000);
    }
  }
// =======================
// ⏳--- SIDE EFFECTS
// =======================
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
        setShowValidation({
          amount: false,
          debtor: false,
          account: false,
          note: false
        });   
}
else if(!isLoading && (error || isAmountError)){
setMessageToUser(error ?? (isAmountError? "Enter a valid amount":""))
}

const timer:ReturnType<typeof setTimeout>  = setTimeout(()=>{setMessageToUser(null)
  // setIsReset(false);
},5000);

return ()=>{if(timer)clearTimeout(timer)
  setTimeout(() => {
  setIsReset(false);
      }, 100);
  }
}, [data, error, isLoading,updateDataCurrency,isAmountError]
)
//error messages rendering control
const [showValidation, setShowValidation] = useState({
  amount: false,
  debtor: false,
  account: false,
  note: false
});
//-----useEffect--------
  useEffect(() => {
    setDataTrack((prev) => ({ ...prev, type: type }));
  }, [type]);
//--- side effect for error messages
useEffect(() => {
  // Mostrar validación para debtor solo si amount tiene valor / show debtor validation only if amount is entered
  if (datatrack.debtor === '' && (formData.amount !== '' || validationMessages.amount || showValidation.debtor)) {
    setValidationMessages(prev => ({
      ...prev,
      debtor: `* Please select the ${datatrack.type ==='lend'?'Debtor':'Lender'}`
    }));
    setShowValidation(prev => ({...prev, debtor: true}));
  } else {
    setValidationMessages(prev => {
      const newMessages = {...prev};
      delete newMessages.debtor;
      return newMessages;
    });
  }
}, [datatrack.debtor,datatrack.type, formData.amount, showValidation.debtor, validationMessages.amount]);
//---
useEffect(() => {
  // show account validation messages after amount has been entered
  if (datatrack.account === "" && (formData.amount !== '' || showValidation.account)) {
    setValidationMessages(prev => ({
      ...prev,
      account: '* Please select an account'
    }));
    setShowValidation(prev => ({...prev, account: true}));
  } else {
    setValidationMessages(prev => {
      const newMessages = {...prev};
      delete newMessages.account;
      return newMessages;
    });
  }
}, [datatrack.account, formData.amount, showValidation.account]);
//---
useEffect(() => {
  // show note validation message only if amount is entered
  if (datatrack.note === '' && (formData.amount !== '' || showValidation.note)) {
    setValidationMessages(prev => ({
      ...prev,
      note: '* Please write the note'
    }));
    setShowValidation(prev => ({...prev, note: true}));
  } else {
    setValidationMessages(prev => {
      const newMessages = {...prev};
      delete newMessages.note;
      return newMessages;
    });
  }
}, [datatrack.note, formData.amount, showValidation.note]);
// ====================
// UI CONFIGURATION
// ====================
//-- Top Card elements ---
 const debtorAccountLabel = datatrack.type ==='lend'?'debtor':'lender'
 const topCardElements:TopCardElementsType = {
    titles: { title1: 'amount', title2: 'debtor', label2:debtorAccountLabel },
    value: formData.amount,
    selectOptions: debtorOptions,
  };
// ======================
// COMPONENT RENDER
// ======================
  return (
    <>
      <form className='debts' style={{ color: 'inherit' }}>
        {/* TOP CARD */}
        <TopCardZod
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
             {showValidation.account && validationMessages['account']}
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
            showError={showValidation.note}
          />
        </div>
      </form>
      
      {/* USER MESSAGES */}
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
