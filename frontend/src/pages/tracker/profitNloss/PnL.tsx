//pages/tracker/profitNloss/PnL.tsx
//Customized input data validation procedure was implemented. 
// Custom input data validation with useFormManagerPnL hook
// ============================
// 📦 IMPORT DEPENDENCIES
// ============================
// ⚛️ React and react-router-dom Hooks
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosRequestConfig } from 'axios';
import { useLocation } from 'react-router-dom';
// =====================
// CUSTOM HOOKS
// =====================
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';
import { useFetch } from '../../../hooks/useFetch.ts';

import { useFormManagerPnL } from '../../../hooks/useFormManagerPnL.ts';
// Zustand store
import useBalanceStore from '../../../stores/useBalanceStore.ts';
// =====================
// 🌐 ENDPOINTS
// =====================
import {
  url_get_accounts_by_type,
  url_get_total_account_balance_by_type,
  url_movement_transaction_record,
} from '../../../endpoints.ts';
// ====================
// UI COMPONENTS
//=====================
import CardSeparator from '../components/CardSeparator.tsx';
import Datepicker from '../../../general_components/datepicker/Datepicker.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import TopCard from '../components/TopCard.tsx';
// =====================
// 📝 TYPES
// =====================
import { BasicTrackerMovementValidatedDataType } from '../../../validations/types.ts';
import {
  AccountByTypeResponseType,
  AccountListType,
  MovementTransactionResponseType,
  BalanceBankRespType,
} from '../../../types/responseApiTypes.ts';

import {
  CurrencyType,
  BasicTrackerMovementInputDataType,
  VariantType,
  TopCardElementsType,
  DropdownOptionType
  // TransactionType,
} from '../../../types/types.ts';
// =====================
// CONSTANTS
// =====================-
import {
  DEFAULT_CURRENCY,
  PAGE_LOC_NUM,
} from '../../../helpers/constants.ts';

// import useAuth from '../../../auth/hooks/useAuth.ts';

// ===============================
// ⚙️ CONSTANTS & INITIAL VALUES
// ===============================
const VARIANT_DEFAULT: VariantType = 'tracker';
const defaultCurrency: CurrencyType = DEFAULT_CURRENCY;
// Initial form input data structure
const initialData: BasicTrackerMovementInputDataType = {
  amount: '',
  account: '',
  currency: defaultCurrency,
  type: 'deposit',//default
  date: new Date(), //default
  note: '',
  accountType:"",
};

// Initial form data structure
const initialValidatedData: BasicTrackerMovementValidatedDataType = {
  amount: 0,
  currency: defaultCurrency,
  account: '',
  accountType:"",
  type: 'deposit',//default
  date: new Date(), //default
  note: '',
};

// ===============================
// ⚛️ MAIN COMPONENT: PnL
// Profi and Loss Movement Tracker
// ===============================
//---Profit and Loss adjustment ---------
//rule: external deposit/withdraw transfers come from slack bank account, which is not rendered or visible.
function PnL():JSX.Element {
// =============================
// 🗺️ ROUTE & USER CONFIGURATION
// =============================
  const { pathname } = useLocation();
  const trackerState = pathname.split('/')[PAGE_LOC_NUM];
  const typeMovement = trackerState.toLowerCase();
// const navigateTo=useNavigate()
// console.info('tracker state', trackerState)
//-------------------------------
// 🛡️ AUTHENTICATION STATE
// const {isAuthenticated, isCheckingAuth}=useAuth()
// const user = import.meta.env.VITE_USER_ID;
// ======================
// FORM MANAGEMENT HOOK
// ======================
// Centralized form state and validation management
const {
 // States
    formInputData,
    formValidatedData,
    validationMessages,
    showValidation,
  
    // Handlers
    createInputNumberHandler,
    createDropdownHandler,
    createTextareaHandler,
    validateAllPnL,
    activateAllValidations,
    // createFieldHandler,
     
    // Setters
    setFormValidatedData,
    setFormInputData,
    setValidationMessages,
    resetForm,
} = useFormManagerPnL<BasicTrackerMovementInputDataType, BasicTrackerMovementValidatedDataType>(initialData, initialValidatedData);

// ======================
// COMPONENT STATE
// ======================
// 🔄 UI and feedback local states
  const [messageToUser, setMessageToUser] = useState<string | null | undefined>('');
  
  const [showMessage, setShowMessage] = useState(false);

  const [isReset, setIsReset] = useState<boolean>(false);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);
  
  //Map states account_name-account_id
  const [accountIdMap, setAccountIdMap]=useState<{[accountName:string]:string}>({});
  
  //user interaction state
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  
// 🌳 Global State (Zustand)
    const setAvailableBudget = useBalanceStore((state) => state.setAvailableBudget);

// ======================
// API DATA FETCHING 
// ======================
//Reactive fetch for total balance (as in Expense.tsx), with reloadTrigger to update after every submit
const balanceBankResponse = useFetch<BalanceBankRespType>(
 `${url_get_total_account_balance_by_type}/?type=bank&reload=${reloadTrigger}`);

// Fetch available bank and investment accounts
//--Account bank and/or investment options
  const fetchUrl =`${url_get_accounts_by_type}?type=bank_and_investment&reload=${reloadTrigger}`
//definir que hacer si no hay user id
// console.log('🚀 ~ Pnl ~ fetchUrl:', fetchUrl);

const {
  apiData: accountDataApiResponse,
  isLoading: isLoadingAccountDataApiResponse,
  error: fetchedErrorAccountDataApiResponse,
} = useFetch<AccountByTypeResponseType>(fetchUrl as string);

//Transform accounts data for dropdown
const accountsToSelect = useMemo(
() =>{
// Early returns for edge cases
  if (isLoadingAccountDataApiResponse) return [];
  if (fetchedErrorAccountDataApiResponse) return [];
  if (!accountDataApiResponse?.data?.accountList?.length) return [];
  // if (isLoadingAccountDataApiResponse || fetchedErrorAccountDataApiResponse || !accountDataApiResponse?.data?.accountList?.length) return [];

  //Map and build idMap
  const idMap:{[accountName:string]:string} = {};
  const options = accountDataApiResponse?.data.accountList?.map((acc: AccountListType) => {
   idMap[acc.account_name] = acc.account_id.toString();
   return {
     label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})` ,
     value: acc.account_name,
       }
     } )
    setAccountIdMap(idMap);
  return options;
},[
  accountDataApiResponse?.data.accountList,
  fetchedErrorAccountDataApiResponse,
  isLoadingAccountDataApiResponse,
]);

  const optionsAccountsToSelect = {
    title: 'Select account',
    options: accountsToSelect,
    variant: VARIANT_DEFAULT,
  };
//-----------------------------
// Full accounts info 
  const accountsListInfo =useMemo( ()=>
    !isLoadingAccountDataApiResponse &&
    !fetchedErrorAccountDataApiResponse &&
    accountDataApiResponse?.data?.accountList?.length    
      ? accountDataApiResponse?.data.accountList?.map((account)=>({...account}))
      :[], [accountDataApiResponse?.data.accountList, fetchedErrorAccountDataApiResponse, isLoadingAccountDataApiResponse])

// console.log('accountsToSelect',accountsToSelect)
// console.log('accountsListInfo', accountsListInfo, )
// ======================
// API REQUEST CONFIGURATION
// ======================
//OBTAIN THE REQUESTFN FROM userFetchLoad
// Payload type for server submission
//extend the type of input data with user id
  type PayloadType = BasicTrackerMovementValidatedDataType & { user?: string ;  date: Date;
    account_id?:string;
    };
//----
//DATA POST FETCHING
  const {  isLoading, error:postError, requestFn, resetFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });
// console.log('data', data)
//-------------------------
const error = fetchedErrorAccountDataApiResponse || postError
// ==========================
// EVENT HANDLERS
// ==========================
//---- FUNCTIONS ------------
//amount handler
const handleAmountChange = createInputNumberHandler('amount');

// Handler for account selection 
  const handleAccountSelect = useCallback(
  (selectedOption:DropdownOptionType | null) => {
    const accountName = selectedOption?.value ||'';
    setHasUserInteracted(true);

// Use the dropdown handler from useFormManager custom hook for validation
   const handler = createDropdownHandler('account')
    handler(selectedOption)

//set accountType based on selection
    const selectedAccount = accountsListInfo.find(acc => acc.account_name === accountName)

    if (selectedAccount) {
    setFormInputData(prev => ({
      ...prev,
      accountType: selectedAccount.account_type_name,
    }));

    setFormValidatedData(prev => ({
      ...prev,
      accountType: selectedAccount.account_type_name,
    }));
  }
  },
  [createDropdownHandler, accountsListInfo, setFormInputData,setFormValidatedData,],
)

// Handler for currency changes
const updateDataCurrency = useCallback((currency: CurrencyType) => {
    setFormInputData((prev) => ({ ...prev, currency }));
    setFormValidatedData((prev) => ({ ...prev, currency }));
  }, [setFormInputData,setFormValidatedData]);

// Handler for transaction type toggle
const toggleTransactionType = useCallback(
  (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
    const newType = formInputData.type === 'deposit' ? 'withdraw' : 'deposit';

  setFormInputData(prev => ({
    ...prev,
    type: newType
  }));

  setFormValidatedData(prev => ({
    ...prev,
    type: newType
  }));
},
[formInputData.type,setFormInputData, setFormValidatedData]
);

// Handler for date changes
const changeDate = useCallback((selectedDate: Date) => {
  setFormInputData(prev => ({ ...prev, date: selectedDate }));
  setFormValidatedData(prev => ({ ...prev, date: selectedDate }));
}, [setFormInputData,setFormValidatedData]);

//Note handler
const handleNoteChange=(
createTextareaHandler('note'));

// Unified handler for TopCard input changes
const handleTopCardChange = (e:React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>)=>{
  const {name}=e.target
  if(name === 'amount'){
handleAmountChange(e)
  }
}
//-----------------------
// ======================
// FORM SUBMIT HANDLING
// ======================
 async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
    // console.log('On Save Handler');
    e.preventDefault();
    if(resetFn)(resetFn())
    setShowMessage(true); 
    setMessageToUser('Processing transaction...')
// Evaluate all fields using useFormManager custom hook's validation system   
 const { isValid, messages, validatedData } = validateAllPnL();
 console.log('isValid',isValid, {validatedData})

 if(!isValid || !validatedData){
  setValidationMessages(messages)
// Force showing all validation messages
  activateAllValidations(true)
  setMessageToUser('Please correct the highlighted fields');
  setTimeout(() => setMessageToUser(null), 3000);
  return
 }
//----------------------------
//POST ENDPOINT FOR MOVEMENT TRANSACTION HERE
// console.log('data state to Post:', formValidatedData);
//----------------------------
//send post data to backend to update the balance account of bank or investment account and the counter account called slack in: user_accounts table.

//record both transaction descriptions: transfer and receive transactions with the correspondent account info.

//endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=pnl

try {
// Prepare payload with validated data
  const accountId = accountIdMap[formValidatedData.account];

  const payload: PayloadType = {
   ...validatedData!,
    // ...formValidatedData!,//Aunque suelen ser lo mismo, si hay un pequeño retraso en la actualización del estado de React, podrías estar enviando el valor anterior
   account_id: accountId ,
   date: validatedData?.date || new Date(),
// currency: formValidatedData?.currency || defaultCurrency,
  };
// console.log("🚀 ~ onSaveHandler ~ payload:", payload)  
  const postUrl = `${url_movement_transaction_record}?movement=${typeMovement}`;

//Submit to server
  const response = await requestFn(payload, {
    url: postUrl,
  } as AxiosRequestConfig);
  console.log("🚀 ~ onSaveHandler ~ response:", {response})
    
  if (response?.error ) {
    throw new Error(response?.error || error || 'An unexpected error occurred during form submission.');
  }

  if (import.meta.env.VITE_ENVIRONMENT === 'development') {
    console.log('Data from record transaction request:', response);
  }
// -------------------------------------
// ✅ Update total balance after success 
// -------------------------------------
  // const newTotalBalance =  await fetchNewBalance();
  // console.log('newTotalBalance', {newTotalBalance})
  //  if (typeof newTotalBalance === 'number') {
  //    setAvailableBudget(newTotalBalance);
  //   }else{ setMessageToUser('Check total_balance')}

//----------------------------------

// Show success message
    setMessageToUser('Transaction completed successfully!');
    setShowMessage(true);    

// Reset form only on successful submission 
    resetForm()
    setHasUserInteracted(false)
    setReloadTrigger(prev=>prev+1)
    setIsReset(true);
    if(resetFn)resetFn();
    
// after a delay, change isReset to false
    setTimeout(() => {
     setMessageToUser(null);
     setShowMessage(false);
      setIsReset(false);
    }, 4000);

  } catch (error) {
    console.error('Submission error:', error);
    setMessageToUser('Error processing transaction');
    setTimeout(() => setMessageToUser(null), 5000);
    setShowMessage(true);
  }
}
// =======================
// ⏳--- SIDE EFFECTS
// =======================
//Sync with balance in global sotre
useEffect(()=>{
const total_balance = balanceBankResponse.apiData?.data?.total_balance;
if (typeof total_balance === 'number') {
  setAvailableBudget(total_balance); // Update zustand when reactive fetch finish
}
},[balanceBankResponse.apiData, setAvailableBudget])
// AUTHENTICATION AND REDIRECTION EFFECT
//Message to user and action, when auth is checking or not authenticated
/*
useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isCheckingAuth) {
      setMessageToUser('Verifying session status. Please wait...');
    } else if (!isAuthenticated) {
// Use existing messageToUser state for feedback before redirecting
      setMessageToUser('Session not active or expired. Redirecting to the sign-in page in 3 seconds...');
      
      timer = setTimeout(() => {
        navigateTo('/auth', { replace: true });
      }, 3000); 

    } else {
// If authenticated, clear the message (only if it was set by the auth check)
      if (messageToUser?.includes('Verifying') || messageToUser?.includes('Session not active')) {setMessageToUser(null);}
    }
    return () => {
      if (timer) clearTimeout(timer); // Cleanup timer
    };
  }, [isAuthenticated, isCheckingAuth, navigateTo, messageToUser]);
  */
//-----useEffect--------
//Handle states related to the data submit form
// useEffect(() => {
// let timer: ReturnType<typeof setTimeout>;

// if ((data || error) && !isLoading) {
//   const success = data && !error;
//   setMessageToUser(
//     success
//       ? 'Movement completed successfully!'
//       : error ?? 'An error occurred during submission'
//   );
//   setShowMessage(true);
//   timer = setTimeout(() => {
//     setMessageToUser(null);
//     setShowMessage(false);
//   }, 8000);
// }
// return () => clearTimeout(timer);
// }, [data, error, isLoading]);
useEffect(() => {
  if (error && !isLoading) {
    setMessageToUser(error);
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 5000);
  }
}, [error, isLoading]);


//----------------------
useEffect(()=>{
//show errors upon user interaction
 if(!hasUserInteracted) {setValidationMessages(prev=>{
    const newMessages={...prev};
    delete newMessages.account;
    delete newMessages.note;
    delete newMessages.amount;
    return newMessages;
  });
}
// console.log('formInputData.account', !!formInputData.account)
//---
if(formInputData.account === ""  && (formInputData.amount !== '' || formInputData.note !==''))
{
  setValidationMessages(prev=>({
    ...prev, account:"* Please select an Account"
  }));
  activateAllValidations(true)
}
//---
if(formInputData.note === "" && (formInputData.amount !== '' || formInputData.account !=='') )
  {
    setValidationMessages(prev=>({
      ...prev, note:"* Please insert a Note"
    }));
    activateAllValidations(true)
  }
},[formInputData.account,formInputData.note, formInputData.amount, hasUserInteracted,setValidationMessages, activateAllValidations])

// ======================
// UI CONFIGURATION
// ======================
// Props for TopCard component
//-------Top Card elements--
const topCardElements:TopCardElementsType = {
  titles: { title1: 'amount', title2: 'account' },
  value: formInputData.amount,
  accountsListInfo,
  selectOptions: optionsAccountsToSelect,
};

// ======================
// COMPONENT RENDER
// ======================
  return (
    <>
      <form className='trackerFormAccount'
       style={{ color: 'inherit' }}>

        {/* TOP CARD START */}
        <TopCard
          topCardElements={topCardElements}
          validationMessages={validationMessages}
           setValidationMessages={ setValidationMessages}
          updateTrackerData={handleTopCardChange}
          trackerName={trackerState}
          currency={formInputData.currency}
          updateCurrency={updateDataCurrency}
          setSelectState={setFormInputData}
          isReset={isReset}
          setIsReset={setIsReset}
           customSelectHandler={handleAccountSelect}
        
        />
        <CardSeparator />
        {/* BOTTOM CARD START */}
        <div className='state__card--bottom'>
          <div className='card__typeDate__container'>
            <div className='card__typeDate--type'>
              <div className='card--title'>Type</div>
              <button
                className='card__screen--type'
                onClick={toggleTransactionType}
              >
                <div className='screen--concept'>{formInputData.type}
                </div>
              </button>
            </div>

            <div className='card__typeDate--date  '>
              <div className='card--title '> Date </div>
              <div className='card__screen--date '>
                <Datepicker
                  changeDate={changeDate}
                  date={formInputData.date ?? new Date()}
                  variant={'tracker'}
                  isReset={isReset}
                />
              </div>
            </div>
          </div>

         {/* NOTE AND SAVE SECTION */}       
          <CardNoteSave
            title={'note'}
            validationMessages={validationMessages}
            dataHandler={(e:React.ChangeEvent<HTMLTextAreaElement>)=>{setHasUserInteracted?.(true);handleNoteChange(e)}}
            inputNote={formInputData.note}
            onSaveHandler={onSaveHandler}
            isDisabled={isLoading}
            showError={showValidation.note}
          />
        </div>
      </form>

      {/* USER FEEDBACK MESSAGES */}
      {showMessage && !isLoading && (
        <div className='fade-message'>
          <MessageToUser
            isLoading={false}
            error={error}
            messageToUser={messageToUser}
            variant='tracker'
          />
        </div>
      )}
    </>
  );
}
export default PnL;
