//src/pages/tracker/income/Income.tsx
//Zod for input validation is used
// =======================
// 📦 Import Section
// =======================
// ⚛️ React Hooks
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosRequestConfig } from 'axios';
import { useLocation} from 'react-router-dom';

// 🪝 Custom Hooks y utils
import { useFetch } from '../../../hooks/useFetch.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';

// form input validation manager
import useFormManager from '../../../hooks/useFormManager.ts';

// Zustand store
import useBalanceStore from '../../../stores/useBalanceStore.ts';
//---------------------------
// 🌐Endpoints and constants 
import {
  url_get_accounts_by_type,
  url_get_total_account_balance_by_type,
  url_movement_transaction_record,
} from '../../../endpoints.ts';

import {
  DEFAULT_CURRENCY,
  ACCOUNT_OPTIONS_DEFAULT,
  SOURCE_OPTIONS_DEFAULT,
  PAGE_LOC_NUM,
} from '../../../helpers/constants.ts';

//📝 Data Type Configuration
import type {
  AccountByTypeResponseType,
  BalanceBankRespType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';

import type {
  CurrencyType,
  IncomeInputDataType,
  VariantType,
  MovementTransactionType,
} from '../../../types/types.ts';

// 🛡️ Zod - Schema and data type validation 
import { incomeSchema} from '../../../validations/zod_schemas/trackerMovementSchema.ts';
import { IncomeValidatedDataType } from '../../../validations/types.ts';

// 🎨 UI Components
import TopCardZod from '../components/TopCard.tsx';
import CardSeparator from '../components/CardSeparator.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
//------------------------
// 🛡️ authentication fetch
import { authFetch } from '../../../auth/utils/authFetch.ts';
//-------------------------
// 📝data type definitions
export type ShowValidationType={
  amount: boolean;
  account: boolean;
  source: boolean;
  note: boolean;
}

//=====================================
// ⚙️ Initial Configuration and default values
//====================================
const defaultCurrency = DEFAULT_CURRENCY;

const initialIncomeData: IncomeInputDataType = {
  amount: "", //string for input
  account: '',
  source: '',
  note: '',
  currency: DEFAULT_CURRENCY,
};
const VARIANT_DEFAULT: VariantType = 'tracker';
//======================================
// ⚛️Main Component: Income
//======================================
//----Income Tracker Movement -------
function Income():JSX.Element {
//rules: only bank accounts type are used to receive income amounts.
//select option accounts rendered are all existing bank accounts,except the slack account which is not shown.

// 🗺️ Router and User configuration
 const { pathname } = useLocation();
  const trackerState = pathname.split('/')[PAGE_LOC_NUM];
  const typeMovement : MovementTransactionType= trackerState.toLowerCase();
// console.info('tracker state', trackerState)
//-------------------------------
// 🛡️ Authentication state or user id
// const user = import.meta.env.VITE_USER_ID;
//-------------------------------
//---states------
// 🔄 Local States
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);

  const [isReset, setIsReset] = useState<boolean>(false);
  const [isResetDropdown, setIsResetDropdown] = useState<boolean>(false);

  const [reloadTrigger, setReloadTrigger] = useState(0)

  const [messageToUser, setMessageToUser] = useState<string | null >(null);
//------------
// 🌳 Global State (Zustand)
// update zustand balance / Conecta con el store de Zustand para actualizar el balance disponible.
const setAvailableBudget = useBalanceStore(
  (state) => state.setAvailableBudget
);
//----
// 📝 Hook `useFormManager`
// Centralize the logic of form handling and validation / Centraliza la lógica del formulario, validación y manejadores de eventos.
  const {
    formData: incomeData,
    showValidation,
    validationMessages,
    handlers: {
      updateField,
      debouncedValidateField,
      createDropdownHandler,
      createTextareaHandler,
      updateCurrency,
      handleApiError,
    },

    validateAll,
    resetForm,
    activateAllValidations,

    setters: {
      setShowValidation,
      setValidationMessages,
      setFormData,
    }
  } = useFormManager<IncomeInputDataType, IncomeValidatedDataType>(incomeSchema, initialIncomeData);
//---- Income account Options ------
// 📡 Data Fetching:
//GET: available accounts of type bank
//Endpoints: url_get_accounts_by_type, 
 const fetchUrl = `${url_get_accounts_by_type}?type=bank&reload=${reloadTrigger}`

const {
    apiData: BankAccountsResponse,
    isLoading: isLoadingBankAccounts,
    error: fetchedErrorBankAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchUrl as string);
//---------------------------------
//--- Data Transformations
// 🧠 Memoization: Account Options
// `useMemo` is used to create the account dropdown options, avoiding unnecessary recalculations.
  const optionsIncomeAccounts = useMemo(
    () =>
      BankAccountsResponse?.data?.accountList?.length &&
      !fetchedErrorBankAccounts &&
      !isLoadingBankAccounts
        ? BankAccountsResponse?.data.accountList?.map((acc) => ({
          value: acc.account_name,
          label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code.toLowerCase()} ${acc.account_balance})`
        }))
        : ACCOUNT_OPTIONS_DEFAULT,
    [
      BankAccountsResponse?.data.accountList,
      fetchedErrorBankAccounts,
      isLoadingBankAccounts,
    ]
  );

  const accountOptions = {
    title: 'Select Account',
    options: optionsIncomeAccounts,
    variant: VARIANT_DEFAULT,
  };
//--------------------------------
//--- DATA FETCHING
// Prepare data and url for Fetching income_source account type
 const fetchSourceUrl = `${url_get_accounts_by_type}/?type=income_source&${reloadTrigger}`
 // console.log('🚀 ~ Income ~ fetchSourceUrl:', fetchSourceUrl);
  const {
    apiData: sources,
    isLoading: isLoadingSources,
    error: errorSources,
  } = useFetch<AccountByTypeResponseType>(fetchSourceUrl as string);

//Data Transformations
// 🧠 Memoization: Account Options
// `useMemo` is used to create the account dropdown options, avoiding unnecessary recalculations.
  const sourceOptions = useMemo(()=>({
    title: sources && !isLoadingSources ? 'Source of income' : '',
    options:
      !errorSources && sources?.data.accountList.length
        ? sources?.data.accountList?.map((acc) => ({
            value: acc.account_name,
            label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${Math.abs(acc.account_balance)})`,
          }))
        : SOURCE_OPTIONS_DEFAULT,
    variant: VARIANT_DEFAULT as VariantType,
  }),[errorSources, isLoadingSources,sources]);
//--------------------------------
//OBTAIN THE REQUESTFN FROM userFetchLoad
// 📡 Post Request logic
 type PayloadType = IncomeValidatedDataType & { user?: string ; type?: string;
  };
//----
//DATA POST FETCHING
  const { data, isLoading, error:postError, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });

//---- FUNCTIONS ----------------
//===============================
// ⚙️ Auxiliar: fetch new balance
// ==============================
//this is an alternative to useEffect for updating total balance, as was used in Expense.tsx.
const fetchNewBalance = useCallback(async ()=>{
//--- 📡 Data fetching--------------
//---GET: total balance of accounts of type bank. endpoint: url_get_total_account_balance_by_type
try {
  const balanceBankResponse= await authFetch<BalanceBankRespType>( `${url_get_total_account_balance_by_type}?type=bank`);
    // console.log("🚀 ~ Income ~ balanceBankResponse:", balanceBankResponse)
  
  const total_balance = balanceBankResponse.data?.data.total_balance
  
  if (typeof total_balance === 'number') {
    return total_balance  
    //  setAvailableBudget(total_balance);
  }
  return null  
    } catch (error) {
  console.error('Error fetching new balance:', error);
    return null; 
  }
}, [ ])

//===============================
// ✍️ Event Handlers
// ==============================
  const handleCurrencyChange = useCallback((newCurrency: CurrencyType) => {
    setCurrency(newCurrency);
    updateCurrency(newCurrency);
  }, [updateCurrency]);

  const handleSourceChange = createDropdownHandler('source');
  const handleAccountChange = createDropdownHandler('account');
  const handleNoteChange = createTextareaHandler('note');

//Handler of field 'amount'. Activates all field validation when entering amount.
 const handleAmountChange = useCallback((evt:React.ChangeEvent<HTMLInputElement  | HTMLTextAreaElement>)=>{
   const {name, value } = evt.target
    updateField(name as keyof IncomeInputDataType, value )
    debouncedValidateField('amount', value)

    if (value) {
      setShowValidation({
        amount: true,
        account: true,
        source: true,
        note: true,
        currency: true
      });
    }
  },[updateField,debouncedValidateField, setShowValidation ])
//================================
// Handler of saving button. Validation, API request and Resetting.
async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
// console.log('On Save Handler');
    e.preventDefault();
    setMessageToUser('Processing transaction...')
//--data validation messages --
    activateAllValidations()
    const {fieldErrors,dataValidated}=validateAll() 
// console.log('validated', dataValidated)
    if(Object.keys(fieldErrors).length>0){
      setValidationMessages(fieldErrors)
      setMessageToUser('Please correct the highlithed fields')
      setTimeout(()=>{setMessageToUser(null)},4000)
      return
    }
//------------------------
//POST ENDPOINT FOR MOVEMENT TRANSACTION
//--sending data to server -------------
//update balance account of bank account and income_source accounts in: user_accounts table.

//record both transaction descriptions: transfer and receive transactions with the correspondent account info.

//endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=income

try {
//create a payload with validated data
   if (!dataValidated) {
        throw new Error('Validation failed. Please check your inputs.');
     }
    const payload: PayloadType = {
        ...dataValidated as IncomeValidatedDataType  & { type?: string },
        type: typeMovement,
      };
//--send the post request
   const postUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;

   const response = await requestFn(payload, {
     url: postUrl,
    } as AxiosRequestConfig);

    if (response?.error ) {
      throw new Error(response?.error || postError || 'An unexpected error occurred during submission.');
    }
// -------------------------------------
// ✅ Update total balance after success 
// -------------------------------------
//1. Get the immediate new balance
    const newTotalBalance = await fetchNewBalance()
    //2. Update global state of Zustand store
    if (typeof newTotalBalance === 'number') {setAvailableBudget(newTotalBalance); // 🔥 Éxito: Llamada segura dentro del handler
    }
    
    if (import.meta.env.VITE_ENVIRONMENT === 'development') {
      console.log('Data from record transaction request:', data, response.data);
    }
//---------------------------------
  setMessageToUser('Transaction successfully recorded!');    
//----------------------------------
// reset values after posting the info   
  resetForm();//from useFormManager
  setCurrency(DEFAULT_CURRENCY);
  setReloadTrigger(prev => prev + 1);
  setIsReset(true);
  setIsResetDropdown(true);
  setTimeout(() => setMessageToUser(null), 3000);

  // setTimeout(() => {
  //   setIsReset(false);
  // }, 1500);
      
    } catch (err) {
      console.error('Submission error:', postError);
      const errorMessage = handleApiError(err);
      setMessageToUser(errorMessage);
      setTimeout(() => setMessageToUser(null), 5000);
    }
  }
//--------------------------------
// ⏳--- Side Effects--/--Efectos secundarios
//----------------------------------
// `useEffect` para resetear los estados de la UI (`isReset`, `isResetDropdown`) después de un tiempo.
  useEffect(() => {
    if (isReset || isResetDropdown) {
      const timer = setTimeout(() => {
        setIsReset(false);
        setIsResetDropdown(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isReset, isResetDropdown]);
//----------------------------------
// 📄 Rendering UI Components /Renderizado del componente
// Define UI structure / Define la estructura de la UI
//-------Top Card elements
  const topCardElements = {
    titles: { title1: 'amount', title2: 'account' },
    value: incomeData.amount,
    selectOptions: accountOptions,
  };
// -------------------------------
  return (
    <>
      <form className='income' style={{ color: 'inherit' }}>
        {/* TOP CARD START */}
         <TopCardZod
          topCardElements={topCardElements}
          validationMessages={validationMessages}
          setValidationMessages={setValidationMessages}
          updateTrackerData={handleAmountChange}
          trackerName={trackerState}
          currency={currency}
          updateCurrency={handleCurrencyChange}
          setSelectState={setFormData}
          isReset={isReset}
          isResetDropdown={isResetDropdown}
          setIsReset={setIsReset}
          setIsResetDropdown={setIsResetDropdown}
          customSelectHandler={handleAccountChange}
        />
  {/* end of TOP CARD */}
        <CardSeparator />
        {/* BOTTOM CARD START */}
        <div className='state__card--bottom '>
          <div className='card--title card--title--top'>
            Source
            <span className='validation__errMsg'>
              {validationMessages['source']}
            </span>
          </div>

          <DropDownSelection
            dropDownOptions={sourceOptions}
            updateOptionHandler={handleSourceChange}
            isReset={isReset}
            setIsReset={setIsReset}
          />

          <CardNoteSave
            title={'note'}
            validationMessages={validationMessages}
            dataHandler={handleNoteChange}
            inputNote={incomeData.note}
            onSaveHandler={onSaveHandler}
            isDisabled={isLoading || isLoadingBankAccounts || isLoadingSources}
            showError={showValidation.note}
          />
        </div>
      </form>

      {messageToUser && (
        <div className='fade-message'>
          <MessageToUser
            isLoading={isLoading || isLoadingBankAccounts || isLoadingSources }
            error={postError || errorSources || fetchedErrorBankAccounts}
            messageToUser={messageToUser}
            variant='tracker'
          />
        </div>
      )}
    </>
  );
}
export default Income;
