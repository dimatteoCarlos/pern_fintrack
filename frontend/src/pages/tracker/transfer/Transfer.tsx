//src/pages/tracker/expense/Transfer.tsx
//zod validation and useFormManager were used.
// =======================================
// 📦 Import Section
// =======================================
// ⚛️ React Hooks
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios, { AxiosRequestConfig } from 'axios';
import { useLocation } from 'react-router-dom';

// 🪝 Custom Hooks y utils
import { useFetch } from '../../../hooks/useFetch.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';
import useBalanceStore from '../../../stores/useBalanceStore.ts';
import useFormManager from '../../../hooks/useFormManager.ts';
//-------------------------------------
// import { useAuthStore } from '../../../auth/stores/useAuthStore.ts';
//-------------------------------------
// 🌐Endpoints and constants 
import {
  url_get_accounts_by_type,
  url_get_total_account_balance_by_type,
  url_movement_transaction_record,
} from '../../../endpoints.ts';

import {
  DEFAULT_CURRENCY,
  ACCOUNT_OPTIONS_DEFAULT,
  PAGE_LOC_NUM,
 } from '../../../helpers/constants.ts';

//📝 Data Type Import
import type  {
  DropdownOptionType,
  CurrencyType,
  MovementInputDataType,
  TransferAccountType,
  VariantType,

} from '../../../types/types.ts';

import  type {
  AccountByTypeResponseType,
  BalanceBankRespType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';
//-------------------------------------
// 🛡️ Zod - Schema and data type validation 
import { transferSchema} from '../../../validations/zod_schemas/trackerMovementSchema.ts';
import { MovementValidatedDataType } from '../../../validations/types.ts';

// 🎨 UI Components
import TopCardZod from '../components/TopCard.tsx';
import CardSeparator from '../components/CardSeparator.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import RadioInput from '../../../general_components/radioInput/RadioInput.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
//-------------------------------------
// 📝data type configuration 
export type ShowValidationType={
    amount: boolean;
    origin: boolean;
    currency: boolean;
    destination:  boolean;
    note: boolean;
    originAccountType: boolean;
    destinationAccountType: boolean;
    // originAccountId?: boolean;
    // destinationAccountId?: boolean;
} 

type RadioOptionType<T extends string> = {value:T, label:string}

//=====================================
// ⚙️ Initial Configuration and default values
//====================================
const defaultCurrency = DEFAULT_CURRENCY;
const initialMovementData: MovementInputDataType = {
  amount: "",
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
const inputRadioOptionsAccountTopCard:RadioOptionType<TransferAccountType>[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'investment', label: 'Invest' },
  { value: 'pocket', label: 'Pocket' },
  { value: 'category_budget', label: 'Rev.Expense' },
];

const inputRadioOptionsAccountBottomCard:RadioOptionType<TransferAccountType>[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'investment', label: 'Invest' },
  { value: 'pocket', label: 'Pocket' },
  { value: 'income_source', label: 'Rev. Income' },
];
//==============================
// ⚛️Main Component: Transfer
//==============================
//--Transfer Tracker Movement between accounts--
//-- account types allowed: investment, bank and  pocket_saving accounts -----
function Transfer(): JSX.Element {
//rules: only investment, bank, pocket_saving account types are used.
//slack account is not used.

// 🗺️ Router and User configuration
  const router = useLocation();
  const trackerState = router.pathname.split('/')[PAGE_LOC_NUM];
  const typeMovement = trackerState.toLowerCase();
  // console.log('movement:', typeMovement);
  //----------------------------
  //deal here with user id authenticated
  // const { userData } = useAuthStore((state) => ({
  //   userData: state.userData,
  //   isAuthenticated: state.isAuthenticated,
  // }));

  // console.log('userData state:', userData);
  //userId
  // const user = userData?.userId;
  // console.log('userID', userID);
  const user = import.meta.env.VITE_USER_ID;
//----------------------------------------
//---states-------------
// 🔄 Local States
  // const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [isReset, setIsReset] = useState<boolean>(false);
  
  const [reloadTrigger, setReloadTrigger] = useState(0)
  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null
  );
 
//--set states for reseting dropdown selection of accounts
  const [isResetOriginAccount, setIsResetOriginAccount] =
  useState<boolean>(true);
  const [isResetDestinationAccount, setIsResetDestinationAccount] =
  useState<boolean>(true);
//----------
// 🌳 Global State (Zustand store) to update available balance 
//--available balance was former named available budget from figma design which is the name used here
// ---------
  const setAvailableBudget = useBalanceStore(
    (state) => state.setAvailableBudget
  );
// ---------
 // 📝 Hook `useFormManager`, initialization.
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

    setters: {
      // setShowValidation,
      setValidationMessages,
      setFormData,
    }
  } = useFormManager<MovementInputDataType, MovementValidatedDataType>(
 transferSchema, 
    initialMovementData
  );
//--- DATA FETCHING------
// Prepare data and url for Fetching origin accounts
  const originAccountTypeFromDb =
    formData.originAccountType === 'pocket'
      ? 'pocket_saving'
      : formData.originAccountType;

  const fetchOriginAccountUrl =
    user && originAccountTypeFromDb
      ? `${url_get_accounts_by_type}/?type=${originAccountTypeFromDb}&user=${user}&${reloadTrigger}`
      : // <Navigate to='/auth' />
        undefined;

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

//---DATA TRANSFORMATIONS
// 🧠 Memoization: Account Options
  const optionsOriginAccounts = useMemo(() => {
    if (fetchedErrorOriginAccounts) {
      return ACCOUNT_OPTIONS_DEFAULT;
    }
    const originAccountList = originAccountsResponse?.data?.accountList ?? [];
    // console.log(
    //   '🚀 ~ optionsOriginAccounts ~ originAccountList:',
    //   originAccountList
    // );

    return originAccountList.length
      ? originAccountList.map((acc) => ({
          value: acc.account_name,
           label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})`
          // account_id: acc.account_id,
        }))
      : ACCOUNT_OPTIONS_DEFAULT;
  }, [originAccountsResponse?.data.accountList, fetchedErrorOriginAccounts]);
//-------------------------------------
//filtering origin account list
  const filteredOriginOptions = useMemo(() => {
    if (!formData.destinationAccountId) {
      return optionsOriginAccounts;
    }
    const originAccountList = originAccountsResponse?.data?.accountList ?? [];

    const filteredAccounts = originAccountList.length
      ? originAccountList.filter(
          (acc) => acc.account_id !== formData.destinationAccountId
        )
      : originAccountList;

    //map to dropdown format without account_id
    return filteredAccounts.map((acc) => ({
      value: acc.account_name,
      label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})`
    }));
  }, [
    formData.destinationAccountId,
    originAccountsResponse?.data.accountList,
    optionsOriginAccounts,
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
  const destinationAccTypeDb =
    formData.destinationAccountType === 'pocket'
      ? 'pocket_saving'
      : formData.destinationAccountType;

//GET: AVAILABLE ACCOUNTS BY TYPE for Destination account
  const fetchDestinationAccountUrl =
    user && destinationAccTypeDb
      ? `${url_get_accounts_by_type}/?type=${destinationAccTypeDb}&user=${user}&${reloadTrigger}`
      : // <Navigate to='/auth' />
        undefined;

  // console.log(fetchOriginAccountUrl, fetchDestinationAccountUrl);

  const {
    apiData: destinationAccountsResponse,
    isLoading: isLoadingDestinationAccounts,
    error: fetchedErrorDestinationAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchDestinationAccountUrl as string);

//Data Transformations
//🧠 Memoization: Account Options
  // console.log('destinationAccountsResponse', {
  //   destinationAccountsResponse,
  //   isLoadingDestinationAccounts,
  //   fetchedErrorDestinationAccounts,
  // });
  
const destinationAccountOptions = useMemo(
()=>(
  {
    title:destinationAccountsResponse?.data.accountList.length?'Select Account':'',

    options:destinationAccountsResponse?.data?.accountList?.filter(dest=>dest.account_id!==formData.originAccountId).map(acc=>({value:acc.account_name, label:`${acc.account_name} (${acc.currency_code} ${acc.account_balance})`})) || ACCOUNT_OPTIONS_DEFAULT,
    variant:VARIANT_DEFAULT
  }), [destinationAccountsResponse ,formData.originAccountId])

//-------------------------------------
//OBTAIN THE REQUESTFN FROM userFetchLoad
  type PayloadType = MovementValidatedDataType & {
    user: string;
    type?: string;
    // transaction_actual_date: string | Date;
  };
  //---
//DATA POST FETCHING
  // const { data, isLoading, error:errorPost, requestFn } = useFetchLoad<
  const {  isLoading, error:errorPost, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });

  const error = errorPost ||fetchedErrorDestinationAccounts||fetchedErrorOriginAccounts
  
//==================================
// ✍️ Event Handlers
// =================================
const handleAmountChange=createNumberHandler('amount');

  const handleCurrencyChange = useCallback((newCurrency: CurrencyType) => {
    updateCurrency(newCurrency);
  }, [updateCurrency]);
//-------
// const handleOriginChange = createDropdownHandler('origin');
  const handleOriginChange = useCallback((selectedOption: DropdownOptionType | null) => {
  const accountName = selectedOption?.value || '';
  
// Find data completed account for Origin
  const selectedAccount = originAccountsResponse?.data?.accountList?.find(
    acc => acc.account_name === accountName
  );

  setFormData(prev => ({
    ...prev,
    origin: accountName,
    originAccountId: selectedAccount?.account_id
  }));

  //Validation and cleaning of validation messages 
  if (accountName) {
    setValidationMessages(prev => ({ ...prev, origin: '' }));
  }
}, [originAccountsResponse?.data?.accountList, setFormData, setValidationMessages]);

//--------------------------------
// const handleDestinationChange = createDropdownHandler('destination');
const handleDestinationChange = useCallback((selectedOption:DropdownOptionType | null)=>{
const accountName = selectedOption?.value ||'';
const selectedAccount = destinationAccountsResponse?.data.accountList.find(acc=>acc.account_name === accountName)
setFormData(prev=>({...prev, destination:accountName, //selectedAccount.account_name
destinationAccountId:selectedAccount?.account_id}))
if(accountName){
  setValidationMessages(prev=>({...prev, destination:''}))
}
 },[destinationAccountsResponse?.data?.accountList, setFormData, setValidationMessages]);

//-------------------------------
  const handleNoteChange = createTextareaHandler('note');

//Radio Input Handlers
 const handleOriginAccountTypeChange = useCallback((newType: string) => {
    setFormData(prev => ({
      ...prev,
      originAccountType: newType as Exclude<TransferAccountType, 'income_source'>,
      origin: '', // Reset origin when type changes
      originAccountId: undefined // Reset ID
    }));
    
// Reset validation
    setValidationMessages(prev => ({ ...prev, origin: '' }));
// force reset of dropdown
  setIsResetOriginAccount(false); // first deactivate
  setTimeout(() => setIsResetOriginAccount(true), 10); //Then activate for following render

  }, [setFormData, setValidationMessages]);

 //---
 const handleDestinationAccountTypeChange = useCallback((newType: string) => {
    setFormData(prev => ({
      ...prev,
      destinationAccountType: newType as Exclude<TransferAccountType,'category_budget'>,
      destination: '', // Reset destination when type changes
      destinationAccountId:undefined //Reset account ID
        }));

  //Reset Validation
    setValidationMessages(prev => ({ ...prev, destination: '' }));
  //force reset of dropdown
    setIsResetDestinationAccount(false);//first deactivate
    setTimeout(()=>setIsResetDestinationAccount(true),10) //Then activate for following rendering
  }, [setFormData, setValidationMessages]); 
 
//-------------------------------------
//--Handler submit form
  async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
  // console.log('On Save Handler');
    e.preventDefault();
    setMessageToUser('Processing transaction...')
  //--data validation messages --
    activateAllValidations()
    const {fieldErrors,dataValidated}=validateAll() 
    console.log(fieldErrors, 'fieldErrors desde onSaveHandler') 
    if (formData.origin === formData.destination) {
      fieldErrors.destination = 'Origin and destination must be different';
    }

    if (Object.keys(fieldErrors).length > 0) {
      setValidationMessages(fieldErrors);
      setMessageToUser('Please correct the fields');
      setTimeout(() => setMessageToUser(null), 4000);
      return;
    }
//---------------------------------------
//POST ENDPOINT FOR MOVEMENT TRANSACTION HERE
//update balance account of bank account and category budget account in: user_accounts table.
//record both transaction descriptions: transfer and receive transactions with the correspondent account info.
//endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=expense
//user id is sent via req.body
      try {
        if (!dataValidated) {
        throw new Error('Validation failed. Please check your inputs.');
     } 

       const payload: PayloadType = {
        amount: Number(formData.amount),
        origin: formData.origin,
        destination: formData.destination,
        note: formData.note,
        currency: formData.currency,
        originAccountType: formData.originAccountType,
        destinationAccountType: formData.destinationAccountType,
        user,
        type: typeMovement,
          };
      //  console.log('compare', dataValidated, payload)   
       const finalUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;
        const response = await requestFn(payload, {
          url: finalUrl,
        } as AxiosRequestConfig);
        
        if (import.meta.env.VITE_ENVIRONMENT === 'development') {
          console.log('Data from record transaction request:', response);
        }

        if (response?.error ) {
        throw new Error(response?.error || error || 'An unexpected error occurred during submission.');
      }
//-------------------------------------
// update total available budget global state
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
//-----------------------------  
    setMessageToUser('Transaction recorded successfully!');       
//-------------------------------
//reset the state and the selected options on select component
    resetForm();
    setReloadTrigger(prev => prev + 1);
    setIsReset(true);
    // setMessageToUser('Transfer completed successfully!');
    setTimeout(() => setMessageToUser(null), 3000);
          
      } catch (error) {
   console.error('Submission error:', error);
      const errorMessage = handleApiError(error);
      setMessageToUser(errorMessage);
      setTimeout(() => setMessageToUser(null), 5000);
      }
    }
//--------------------------------
// ⏳--- Side Effects--/--Efectos secundarios
  useEffect(() => {
    if (isReset ) {
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
    titles: { title1: 'amount', title2: 'origin', label2:'From: ' }, //title1 and title2, deben coincidir con el key de validation messages / these titles must match to validation messages keys
    value: formData.amount,
    selectOptions: originAccountOptionsToRender,
  };

  // console.log('validation messages', validationMessages, data);
  //-----------------------------------
  return (
    <>
      <form className='transfer' style={{ color: 'inherit' }}>
        {/* start of TOP CARD */}
        <TopCardZod
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
            disabled:isLoading || isLoadingOriginAccounts || isLoadingDestinationAccounts 
            
          }}
        />
        {/* end of TOP CARD */}

        <CardSeparator />

        {/*start of BOTTOM CARD */}

        <div className='state__card--bottom'>
          <div className='account card--title card--title--top'>
          <span className="account-label">To:</span> 
          {/* <div className="radio-input-container"> */}
           <div className="radio-input__options">
            <RadioInput
              radioOptionSelected={
                formData.destinationAccountType ??
                initialMovementData.destinationAccountType!
              }
              inputRadioOptions={inputRadioOptionsAccountBottomCard}
              setRadioOptionSelected={handleDestinationAccountTypeChange}
              title={''}
              labelId='destination'
              disabled=  {isLoading || isLoadingOriginAccounts || isLoadingDestinationAccounts }
            />
           </div> 
          {/* </div> */}
 
        </div>

          <div className='validation__errMsg'>
            {validationMessages['destination']}
          </div>
          <DropDownSelection
            dropDownOptions={destinationAccountOptions }
            updateOptionHandler={handleDestinationChange}
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
          isDisabled=  {isLoading || isLoadingOriginAccounts || isLoadingDestinationAccounts }
          showError={showValidation.note}
          />
      {/* end of BOTTOM CARD */}
        </div>
      </form>

        <div className='fade-message'>
          <MessageToUser
            isLoading={false}
            error={error}
            messageToUser={messageToUser}
            variant='tracker'
          />
        </div>
      
    </>
  );
}

export default Transfer;
