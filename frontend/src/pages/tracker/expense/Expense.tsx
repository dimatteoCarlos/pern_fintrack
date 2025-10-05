//src/pages/tracker/expense/Expense.tsx
// ⚛️ REACT HOOKS AND react router dom
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosRequestConfig } from 'axios';
import { useLocation,useNavigate  } from 'react-router-dom';

// 🔑 AUTHENTICATION HOOK
import useAuth from '../../../auth/hooks/useAuth.ts'; 

// 🪝 CUSTOM HOOKS Y UTILS
import { useFetch } from '../../../hooks/useFetch.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.ts';
import { useDebouncedCallback } from '../../../hooks/useDebouncedCallback.ts';

// ZUSTAND STORES
import useBalanceStore from '../../../stores/useBalanceStore.ts';
//---
// 🎨 UI COMPONENTS
import TopCardZod from '../components/TopCard.tsx';
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
} from '../../../endpoints.ts';
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
  CategoryBudgetAccountsResponseType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';
import {
  CurrencyType,
  DropdownOptionType,
  ExpenseInputDataType,
  VariantType,
  MovementTransactionType,
  TopCardElementsType,
  // ValidationMessagesType,
} from '../../../types/types.ts';
//----------------------------------------
// 🛡️ ZOD - SCHEMA AND DATA TYPE VALIDATIONS
import {validateForm  } from '../../../validations/utils/zod_validation.ts';
import { expenseSchema} from '../../../validations/zod_schemas/trackerMovementSchema.ts';
import { ExpenseValidatedDataType, ValidationMessagesType } from '../../../validations/types.ts';
import { handleError } from '../../../helpers/handleError.ts';
//-------------------------------------
// 📝DATA TYPE DEFINITIONS
export type ShowValidationType={
  amount: boolean;
  account: boolean;
  category: boolean;
  note: boolean;
} 
//========================================
// ⚙️ INITIAL CONFIGURATION AND DEFAULT VALUES
//========================================
const defaultCurrency = DEFAULT_CURRENCY;
const initialExpenseData: ExpenseInputDataType = {
  amount: "", //string for input
  account: '',
  category: '',
  note: '',
  currency: DEFAULT_CURRENCY,
};
const VARIANT_DEFAULT: VariantType = 'tracker';

// ====================================
//  ⚛️MAIN COMPONENT: EXPENSE
// ===================================
//----Expense Tracker Movement -------
function Expense(): JSX.Element {
 //rules: only bank accounts type are used to do operations.(eg. expenses)
 //select option accounts renders are all existing bank accounts, except, the slack account which is not shown.
//---
// 🗺️ ROUTER AND NAVIGATION CONFIGURATION
const router = useLocation();
const trackerState = router.pathname.split('/')[PAGE_LOC_NUM];
const typeMovement: MovementTransactionType = trackerState.toLowerCase(); 
const navigateTo=useNavigate()
//---
// 🛡️ AUTHENTICATION STATE
const { isAuthenticated, isCheckingAuth , } = useAuth();

// 🔄 LOCAL STATES
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [isReset, setIsReset] = useState<boolean>(false);
  const [isResetDropdown, setIsResetDropdown] = useState<boolean>(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [expenseData, setExpenseData] =
  useState<ExpenseInputDataType>(initialExpenseData);
  // const [localError, setLocalError] = useState<string | null>(null); 

// Message States
  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(null);
  const [validationMessages, setValidationMessages] = useState<
  ValidationMessagesType<typeof initialExpenseData>>({});

  const [showValidation, setShowValidation] = useState<ShowValidationType>({
    amount: false,
    account: false,
    category: false,
    note: false
  });

// 🌳 Global State (Zustand)-------------
const setAvailableBudget = useBalanceStore((state) => state.setAvailableBudget); 
//---
  const balanceBankResponse = useFetch<BalanceBankRespType>(
  `${url_get_total_account_balance_by_type}/?type=bank&reload=${reloadTrigger}`
  );
  // console.log("🚀 ~ Expense ~ balanceBankResponse:", balanceBankResponse)
  const total_balance = balanceBankResponse.apiData?.data.total_balance
   if (typeof total_balance === 'number') {
     setAvailableBudget(total_balance);
   }
// ===========================================
//--- DATA FETCHING------------------
// 📡 Data Fetching: Bank Accounts 
//Endpoints: url_get_accounts_by_type, url_get_total_account_balance_by_type

//GET: AVAILABLE ACCOUNTS OF TYPE BANK
  const fetchUrl = `${url_get_accounts_by_type}/?type=bank&reload=${reloadTrigger}`
//console.log('🚀 ~ Expense ~ fetchUrl:', fetchUrl);

  const {
    apiData: BankAccountsResponse,
    isLoading: isLoadingBankAccounts,
    error: fetchedErrorBankAccounts,
    // ...rest
  } = useFetch<AccountByTypeResponseType>(fetchUrl as string);

  // console.log('',{
  //   BankAccountsResponse,
  //   isLoadingBankAccounts,
  //   fetchedErrorBankAccounts,
  //   rest
  // });

//---data transformation
// 🧠 Memoization: Account Options
  const optionsExpenseAccounts = useMemo(() => {
    if (fetchedErrorBankAccounts) {
      return ACCOUNT_OPTIONS_DEFAULT;
    }
    const accountList = BankAccountsResponse?.data?.accountList ?? [];

    return accountList.length
      ? accountList.map((acc) => ({
          value: acc.account_name,
          label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})`,
        }))
      : ACCOUNT_OPTIONS_DEFAULT;
  }, [BankAccountsResponse?.data.accountList, fetchedErrorBankAccounts]);

  const accountOptions = {
    title: 'Select Account',
    options: optionsExpenseAccounts,
    variant: 'tracker' as VariantType,
  };
//--------
//CATEGORY OPTIONS
//GET: ACCOUNTS OF TYPE CATEGORY_BUDGET AVAILABLE
// 📡 Data Fetching: Category budget Accounts 
  const {
    apiData: CategoryBudgetAccountsResponse,
    isLoading: isLoadingCategoryBudgetAccounts,
    error: fetchedErrorCategoryBudgetAccounts,
  } = useFetch<CategoryBudgetAccountsResponseType>(
    `${url_get_accounts_by_type}/?type=category_budget&reload=${reloadTrigger}`
  );
  // console.log('catBudgetResp', {
  //   CategoryBudgetAccountsResponse,
  //   isLoadingCategoryBudgetAccounts,
  //   fetchedErrorCategoryBudgetAccounts,
  // });

//Category Data Transformation - 
  // 🧠 Memoización: category dropdown options
  const optionsExpenseCategories = useMemo(() => {
    const categoryList =
      CategoryBudgetAccountsResponse?.data?.accountList || [];
    if (fetchedErrorCategoryBudgetAccounts) {
      return CATEGORY_OPTIONS_DEFAULT;
    }
   return categoryList.map((cat) => ({
      value: cat.account_name,
      label: `${cat.account_name} (${cat.currency_code} ${cat.account_balance})`,
// label: cat.account_name,
    }));
  }, [
    CategoryBudgetAccountsResponse?.data?.accountList,
    fetchedErrorCategoryBudgetAccounts,
  ]);
  //-------------------------------------
  const categoryOptions = {
    title: optionsExpenseCategories
      ? 'Category / Subategory'
      : '',
    options: optionsExpenseCategories ?? CATEGORY_OPTIONS_DEFAULT,
    variant: VARIANT_DEFAULT as VariantType,
  };
  //-------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
    // 📡 Post Request logic
  type PayloadType = ExpenseValidatedDataType & {
    type?:string;
    };
    const { data, isLoading, error:postError, requestFn } = useFetchLoad<

    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });

//---- FUNCTIONS --------
// ===============================
// ✍️ Event Handlers
// ===============================
  function updateDataCurrency(currency: CurrencyType) {
    setCurrency(currency);
    setExpenseData((prev) => ({ ...prev, currency: currency }));
  }
//--custom field handler for category
  function categorySelectHandler(selectedOption: DropdownOptionType | null) {
    setExpenseData((prev) => ({
      ...prev,
      ['category']: selectedOption?.value || '',//update field
    }));

   // Only validate if showing validation for category
    if (showValidation.category) {
      setValidationMessages((prev) => ({ 
        ...prev, 
        category: selectedOption?.value ? '' : '* Please select a category' 
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
        account: selectedOption?.value ? '' : '* Please select an account' 
      }));
    }
   }
//===================================
//-- VALIDATION FUNCTIONS AND LOGIC ---
//Extract function for validation and update logic, which will be debounced. 
// Real Time Validation.
// useCallback to make the function stable if its dependencies don't change.

// ✍️ EVENT HANDLERS
 const processValidationAndUpdateFn = useCallback((name: string, value: string) => {
// Data object for Zod. Zod waits an object with all input data fields to validate them
// Always validate if showValidation is true for this field
if (showValidation[name as keyof ShowValidationType]) 
{
  const currentDataForValidation = {
    ...expenseData ,
      [name]:value, // Value input is taken to validate it
  };
  const {errors:fieldErrors, } = validateForm(expenseSchema, currentDataForValidation);

  // const { data:dataValidated} = validateForm(expenseSchema, currentDataForValidation);

  // console.log('fieldErrors', fieldErrors, dataValidated);

//update just the message of the current field (name) and if it should show
   if (fieldErrors[name as keyof ExpenseInputDataType]) {
      setValidationMessages((prev) => ({ ...prev, [name]: fieldErrors[name as keyof ExpenseInputDataType] }));
    } else {
      setValidationMessages((prev) => {
        const newMessages = { ...prev };
        delete newMessages[name as keyof ExpenseInputDataType];
        return newMessages;
      });
    }
  }
   }, [expenseData,showValidation]); 
//---
// Apply the debounce to the `processValidationAndUpdate` function
  const debouncedProcessValidationAndUpdateFn = useDebouncedCallback(processValidationAndUpdateFn, 500);  
//---
// updateTrackerData_Zod: It only updates the immediate state and calls the debounced function.
  function updateTrackerData_Zod(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.preventDefault();
    const { name, value } = e.target;

//validate in real time field
    setExpenseData((prev) => ({ ...prev, [name]: value }));

// inmediate validation for amount
  if (name === 'amount') {
    setShowValidation(prev => ({ ...prev, amount: true }));
    debouncedProcessValidationAndUpdateFn(name, value);
    
// show validation message for other fields when amount value is entered.
    if (value && !showValidation.account) {
      setShowValidation(prev => ({
        ...prev,
        account: true,
        category: true,
        note: true
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

//-------------------------------------
//Handler for form submit
  async function onSaveHandler_zod(e: React.MouseEvent<HTMLButtonElement>) {
    // console.log('On Save Handler');
    e.preventDefault();

  // Show all validation messages when submitting
    setShowValidation({
      amount: true,
      account: true,
      category: true,
      note: true
    });

    //validate the whole input form data
    const {errors:fullFormErrors, data:dataValidated} = validateForm(expenseSchema, expenseData );

  // console.log("🚀 ~ onSaveHandler_zod ~ fullFormErrors:", fullFormErrors,)

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

//--sending data to server -----------------
//POST ENDPOINT FOR MOVEMENT TRANSACTION HERE
//update balance account of bank account and category budget account in: user_accounts table.

//record both transaction descriptions: transfer and receive transactions with the correspondent account info.

//endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=expense

  try {
    //create a payload with validated data
    const payload: PayloadType = {
      ...dataValidated as ExpenseValidatedDataType  & { type?: string }
        ,
      type: typeMovement
    };

    //send the request
    const finalUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;
    // console.log(
    //   '🚀 ~ onSubmitForm ~ finalUrl:',
    //   finalUrl,
    //   'date:',
    //   payload.date,
    //   'este es el payload:',
    //   payload
    // );

    const response = await requestFn(payload, {
      url: finalUrl,
    } as AxiosRequestConfig);

  if (response.error) {
    const errorMsg = response.error
    console.log('response?.error?', errorMsg)
    throw new Error(errorMsg);
  }

  if (import.meta.env.VITE_ENVIRONMENT === 'development') {
    console.log('Data from record transaction request:', response);
  }
//-------------------------------- 
 showMessage('Transaction recorded successfully!', 3000);
  } catch (error) {
      const { message, status, isAuthError } = handleError(error);
      if (isAuthError) {
        return;
          }
      console.error(`Error (${status}): ${message}`);
      showMessage(`Error (${status}): ${message}` );
      }
}
//-----------------------------------
// ⏳--- SIDE EFFECTS 
//-----------------------------------
//---------
// AUTHENTICATION AND REDIRECTION EFFECT
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
      if (messageToUser?.includes('Verifying') || messageToUser?.includes('Session not active')) {
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
    if ((data ) && !isLoading) {
      const success = data;
      setMessageToUser(
 'Movement completed successfully!'
          
      );
//reset only in case of success
    if (success) {
      setCurrency(DEFAULT_CURRENCY);
      setExpenseData(initialExpenseData);
      setReloadTrigger(prev => prev + 1);
      setIsReset(true);
      setIsResetDropdown(true);
      setValidationMessages({});
    }
      setShowValidation({
          amount: false,
          account: false,
          category: false,
          note: false
        });   

      timer = setTimeout(() => {
        setMessageToUser(null);
        setIsReset(false);
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [data,  isLoading]);
//---
// Data Fetching Effect to control when useFetch re-execute 
  useEffect(() => {
    if (!isAuthenticated || isCheckingAuth) return; 
  }, [isAuthenticated, isCheckingAuth, reloadTrigger]);
//-------------------------------------------
//SHOW VALIDATION MSG SIDE EFFECTS
// Effect to handle note validation when amount is entered
useEffect(() => {
  if (expenseData.amount !== '' && !showValidation.note) {
    setShowValidation(prev => ({
      ...prev,
      note: true
    }));
  // Validate note field immediately when activated
    if (expenseData.note === '') {
      setValidationMessages(prev => ({
        ...prev,
        note: '* Please write the note'
      }));
    } else {
      setValidationMessages(prev => {
        const newMessages = {...prev};
        delete newMessages.note;
        return newMessages;
      });
    }
  }
}, [expenseData.amount, expenseData.note, showValidation.note]);

// Effect to handle account validation when amount is entered
useEffect(() => {
  // Activar validación solo si hay amount y no está ya activa
  if (expenseData.amount !== '' && !showValidation.account) {
    setShowValidation(prev => ({ ...prev, account: true }));
    
    // Initial validation with Zod
    const { errors } = validateForm(expenseSchema, {
      ...expenseData,
      account: expenseData.account
    });
    
    if (errors.account) {
      setValidationMessages(prev => ({ ...prev, account: errors.account }));
    }
  }
}, [expenseData, showValidation.account]
);
// ===========================================
// Specific effect for amount
// ===========================================
useEffect(() => {
  if (expenseData.amount !== '' && !showValidation.amount) {
    setShowValidation(prev => ({ ...prev, amount: true }));
    // La validación real se hará en processValidationAndUpdateFn
  }
}, [expenseData.amount,showValidation.amount]);
//------------------------------------------
// Effect to handle category validation when amount is entered
useEffect(() => {
  if (expenseData.amount !== '' && !showValidation.category) {
    setShowValidation(prev => ({
      ...prev,
      category: true
    }));
    
    // Validate category field immediately when activated
    if (expenseData.category === '') {
      setValidationMessages(prev => ({
        ...prev,
        category: '* Please select a category'
      }));
    } else {
      setValidationMessages(prev => {
        const newMessages = {...prev};
        delete newMessages.category;
        return newMessages;
      });
    }
  }
}, [expenseData.amount, expenseData.category, showValidation.category]);
  
//------------------------------------
//RENDERING COMPONENTS
//-------Top Card elements ----------
  const topCardElements:TopCardElementsType = {
    titles: { title1: 'amount', title2: 'account' },
    value: expenseData.amount as string,
    selectOptions: accountOptions,
  };
// ----------------------------------------
// 🧱 RENDER LOGIC
// ----------------------------------------
// Separate UI of "checking" and "not authenticated"
if (isCheckingAuth) {
  return (
    <div className='expense loading-screen' style={{ color: 'inherit' }}>
      <MessageToUser
        isLoading={true} 
        messageToUser={messageToUser}
        variant='tracker'
        error={ postError || fetchedErrorCategoryBudgetAccounts || fetchedErrorBankAccounts }
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
        messageToUser={messageToUser ?? 'Session not active or expired. Redirecting to sign-in...'} // MODIFICACIÓN: fallback mensaje
        variant='tracker'
        error={ postError || fetchedErrorCategoryBudgetAccounts || fetchedErrorBankAccounts }
      />
    </div>
  );
}

// ----------------------------------------
// If authenticated and not checking, render the form:
  return (
  <>
  {/*  {!isLoadingBankAccounts && !isLoadingCategoryBudgetAccounts  &&!isLoading && */}
    <form className='expense' style={{ color: 'inherit' }}>
    {/* TOP CARD */}
    <TopCardZod<typeof initialExpenseData>
      topCardElements={topCardElements}
      validationMessages={validationMessages}
      setValidationMessages={setValidationMessages}
      updateTrackerData={updateTrackerData_Zod}
      trackerName={trackerState}
      currency={currency}
      updateCurrency={updateDataCurrency}
      setSelectState={setExpenseData as React.Dispatch<React.SetStateAction<typeof initialExpenseData>>}
      isReset={isReset}
      isResetDropdown={isResetDropdown}
      setIsReset={setIsReset}
      setIsResetDropdown={setIsResetDropdown} 
      customSelectHandler={accountSelectHandler}
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

      <CardNoteSave
        title={'note'}
        validationMessages={validationMessages}
        dataHandler={updateTrackerData_Zod}
        inputNote={expenseData.note}
        onSaveHandler={onSaveHandler_zod}
        isDisabled={isLoading || isLoadingBankAccounts || isLoadingCategoryBudgetAccounts}
             showError={showValidation.note}
      />

      {/* end of BOTTOM CARD */}
        </div>
      </form>

      {messageToUser  && (
        <div className='fade-message'>
          <MessageToUser
            // isLoading={false}
             isLoading={isLoading || isLoadingBankAccounts || isLoadingCategoryBudgetAccounts}
            error={ postError || fetchedErrorCategoryBudgetAccounts
              ||
            fetchedErrorBankAccounts
            }  
           messageToUser={messageToUser}
            variant='tracker'
          />
        </div>
      )    }
    </>
   );
}

export default Expense;
