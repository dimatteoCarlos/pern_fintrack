//pages/tracker/profitNloss/PnL.tsx
//here a customized input data validation procedure was implemented. 
// Custom input data validation with useFormManagerPnL hook
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetch } from '../../../hooks/useFetch.ts';
import {
  url_get_accounts_by_type,
  url_get_total_account_balance_by_type,
  url_movement_transaction_record,
} from '../../../endpoints.ts';
import CardSeparator from '../components/CardSeparator.tsx';
import Datepicker from '../../../general_components/datepicker/Datepicker.tsx';
import {
  CurrencyType,
  BasicTrackerMovementInputDataType,
  // TransactionType,
  VariantType,
  TopCardElementsType,
  DropdownOptionType
} from '../../../types/types.ts';

import { useLocation } from 'react-router-dom';
import {
  DEFAULT_CURRENCY,
  PAGE_LOC_NUM,
} from '../../../helpers/constants.ts';
import CardNoteSave from '../components/CardNoteSave.tsx';
import {
  AccountByTypeResponseType,
  BalanceBankRespType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';
import useBalanceStore from '../../../stores/useBalanceStore.ts';
import axios, { AxiosRequestConfig } from 'axios';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import { useFormManagerPnL } from '../../../hooks/useFormManagerPnL.ts';
import { BasicTrackerMovementValidatedDataType } from '../../../validations/types.ts';
import TopCardZod from '../components/TopCard.tsx';


//------------------------------
// Constants
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
}
;

// Initial form data structure
const initialValidatedData: BasicTrackerMovementValidatedDataType = {
  amount: 0,
  account: '',
  currency: defaultCurrency,
  type: 'deposit',//default
  date: new Date(), //default
  note: '',
  accountType:"",
}
;
//---Profit and Loss adjustment ---------
//rule: external deposit/withdraw transfers come from slack bank account, not rendered or visible.
// ======================
// ROUTE & USER CONFIGURATION
// ======================
function PnL() {
//----Account Options----------------
  const { pathname } = useLocation();
  const trackerState = pathname.split('/')[PAGE_LOC_NUM];
  const typeMovement = trackerState.toLowerCase();
// console.log('movement:', typeMovement);//pnl
// const { userData } = useAuthStore((state) => ({
//   userData: state.userData,
//   isAuthenticated: state.isAuthenticated,
// }));

// console.log('userData state:', userData);
//userId
// const user = userData?.userId;
// console.log('userID', userID);

//deal here with user id and authentication
  const user = import.meta.env.VITE_USER_ID;

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
    // createFieldHandler,
    validateAllPnL,
    activateAllValidations,
     
    // Setters
    setFormValidatedData,
    setFormInputData,
    setValidationMessages,
    resetForm,
} = useFormManagerPnL<BasicTrackerMovementInputDataType, BasicTrackerMovementValidatedDataType>(initialData, initialValidatedData);

// ======================
// COMPONENT STATE
// ======================
// UI and feedback states
  const [messageToUser, setMessageToUser] = useState<string | null | undefined>('');
  
  const [showMessage, setShowMessage] = useState(false);

  const [isReset, setIsReset] = useState<boolean>(false);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);
  // Global budget state
  const setAvailableBudget = useBalanceStore((state) => state.setAvailableBudget);

//user interaction state
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
// ======================
// API DATA FETCHING - Accounts
// ======================
// Fetch available bank and investment accounts
//--Account bank and/or investment options
  const fetchUrl = user
    ? `${url_get_accounts_by_type}/?type=bank_and_investment&user=${user}&reload=${reloadTrigger}`
    : // <Navigate to='/auth' />
      undefined; //esto es forzar un error de user ID required
  //definir que hacer si no hay user id
  // console.log('🚀 ~ Pnl ~ fetchUrl:', fetchUrl);

  const {
    apiData: accountDataApiResponse,
    error: fetchedErrorAccountDataApiResponse,
    isLoading: isLoadingAccountDataApiResponse,
  } = useFetch<AccountByTypeResponseType>(fetchUrl as string);

//Transform accounts data for dropdown
const accountsToSelect = useMemo(
() =>
  !isLoadingAccountDataApiResponse &&
  !fetchedErrorAccountDataApiResponse &&
  accountDataApiResponse?.data?.accountList?.length
    ? accountDataApiResponse?.data.accountList?.map((acc) => ({
      label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})` ,
      value: acc.account_name,
      }))
    : [],
[
  accountDataApiResponse?.data.accountList,
  fetchedErrorAccountDataApiResponse,
  isLoadingAccountDataApiResponse,
]
);
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
  type PayloadType = BasicTrackerMovementValidatedDataType & { user: string ;  date: Date; };

  //DATA POST FETCHING
  const { data, isLoading, error, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });
// console.log('data', data)
//-------------------------
//HANDLERS
//-------------------------
//amount handler
const handleAmountChange = createInputNumberHandler('amount');

// Handler for account selection 
const handleAccountSelect = useCallback(
  (selectedOption:DropdownOptionType | null) => {
    const accountName = selectedOption?.value ||'';
    setHasUserInteracted(true);

// Use the dropdown handler from hook for validation
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
// const handleDateChange=createFieldHandler<Date>('date');
const changeDate = useCallback((selectedDate: Date) => {
  setFormInputData(prev => ({ ...prev, date: selectedDate }));

setFormValidatedData(prev => ({ ...prev, date: selectedDate }));
}, [setFormInputData,setFormValidatedData]);

//note handler
const handleNoteChange=(
createTextareaHandler('note'));
//-------------------------------
// Unified handler for TopCardZod input changes
const handleTopCardChange = (e:React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>)=>{
  const {name}=e.target
  if(name === 'amount'){
handleAmountChange(e)
  }
}
// ======================
// SUBMIT HANDLING
// ======================
 async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('On Save Handler');
    e.preventDefault();
    setShowMessage(true); 
    setMessageToUser('Processing transaction...')
     
// Evaluate all fields using hook's validation system   
 const { isValid, messages, validatedData } = validateAllPnL();
console.log('isValid',isValid)

 if(!isValid){
  setValidationMessages(messages)
// Force showing all validation messages
  activateAllValidations(true)
  setMessageToUser('Please correct the highlighted fields');

  setTimeout(() => setMessageToUser(null), 4000);
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
  const payload: PayloadType = {
    ...formValidatedData!,
    user,
      date: validatedData?.date || new Date(),
      // currency: formValidatedData?.currency || defaultCurrency,
  };
  const postUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;

//Submit to server
  const response = await requestFn(payload, {
    url: postUrl,
  } as AxiosRequestConfig);

  if (import.meta.env.VITE_ENVIRONMENT === 'development') {
    console.log('Data from record transaction request:', response);
  }

    if (response?.error ) {
    throw new Error(response?.error || error || 'An unexpected error occurred during submission.');
  }
//---
//update total available global budget state
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
//-------------------------------
// Show success message
    setMessageToUser('Transaction completed successfully!');
    setShowMessage(true);    

// Reset form only on successful submission 
    resetForm()
    setHasUserInteracted(false)
    setReloadTrigger(prev=>prev+1)
    setIsReset(true);
    
// after a delay, change isReset to false
    setTimeout(() => {
      setIsReset(false);
    }, 100);

  } catch (error) {
    console.error('Submission error:', error);
    setMessageToUser('Error processing transaction');
    setTimeout(() => setMessageToUser(null), 5000);
    setShowMessage(true);
  }
}
  // ======================
  // UI CONFIGURATION
  // ======================
  // Props for TopCardZod component
  //-------Top Card elements--
  const topCardElements:TopCardElementsType = {
    titles: { title1: 'amount', title2: 'account' },
    value: formInputData.amount,
    selectOptions: optionsAccountsToSelect,
    accountsListInfo
    };
  // ======================
  // EFFECTS
  // ======================
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
  //---
useEffect(()=>{
//show errors upon user interaction
console.log('intracted', hasUserInteracted)

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
// RENDER
// ======================
  return (
    <>
      <form className='trackerFormAccount'
       style={{ color: 'inherit' }}>

        {/* TOP CARD START */}
        <TopCardZod
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
