//src/pages/tracker/expense/Expense.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios, { AxiosRequestConfig } from 'axios';
import { useLocation } from 'react-router-dom';

//UI Components
// import TopCard from '../components/TopCard.tsx';
import TopCardZod from '../components/TopCardZod.tsx';
import CardSeparator from '../components/CardSeparator.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';

//hooks and utils
import { useFetch } from '../../../hooks/useFetch.tsx';
import { useFetchLoad } from '../../../hooks/useFetchLoad.tsx';
import useBalanceStore from '../../../stores/useBalanceStore.ts';
//---
//Endpoints and contants 
 import {
  url_get_accounts_by_type,
  url_get_total_account_balance_by_type,
  url_movement_transaction_record,
} from '../../../endpoints.ts';
import {
  ACCOUNT_OPTIONS_DEFAULT,
  CATEGORY_OPTIONS_DEFAULT,
  DEFAULT_CURRENCY,
  // CURRENCY_OPTIONS,
  PAGE_LOC_NUM,
} from '../../../helpers/constants.ts';

//import types
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
  ValidationMessagesType,
} from '../../../types/types.ts';

//----------------------------------------------
//ZOD IMPORTS
import {validateForm  } from '../../../validations/utils/validation_functions.ts';
import { expenseSchema} from '../../../validations/schemas/expenseSchema.ts';
import { useDebouncedCallback } from '../../../hooks/useDebouncedCallback.tsx';
// import { createDropdownFieldHandler } from '../../../validations/utils/createDropdownFieldHandler.ts';
//----------------------------------------------------
// import { createDropdownFieldHandler } from '../../../validations/utils/createDropdownFieldHandler.ts';
// import { createZodFieldHandler } from '../../../validations/utils/createDropdownFieldHandler.ts';
// //----------------------------------------------
// import { useAuthStore } from '../../../auth/stores/useAuthStore.ts';
//-------------------------------------
//type definitions
export type ExpenseValidatedDataType ={
  amount: number;
  account: string;
  category: string;
  note: string;
  currency: CurrencyType;
  // date?: Date;
  // type?: MovementTransactionType;
}; 
export type ShowValidationType={
  amount: boolean;
  account: boolean;
  category: boolean;
  note: boolean;
} 
//===================================
//-----Initial configuration
const defaultCurrency = DEFAULT_CURRENCY;
const initialExpenseData: ExpenseInputDataType = {
  amount: "", //string for input
  account: '',
  category: '',
  note: '',
  currency: DEFAULT_CURRENCY,
};
const VARIANT_DEFAULT: VariantType = 'tracker';

//------------------------------------
//----Expense Tracker Movement -------
function Expense(): JSX.Element {
  //rules: only bank accounts type are used to make expenses.
  //select option accounts renders are all existing bank accounts, except, the slack account which is not shown.

 //auth and route config 
  const router = useLocation();
  const trackerState = router.pathname.split('/')[PAGE_LOC_NUM];
  const typeMovement: MovementTransactionType = trackerState.toLowerCase() //as MovementTransactionType;
  // console.log('movement:', typeMovement);
  //---authentication
  //deal here with user id and authentication
  // const { userData } = useAuthStore((state) => ({
  //   userData: state.userData,
  //   isAuthenticated: state.isAuthenticated,
  // }));
  
  // console.log('userData state:', userData);
  //userId
  // const user = userData?.userId;
  // console.log('userID', userID);
  const user = import.meta.env.VITE_USER_ID;

  //---states-------------
  //---local states ------
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [isReset, setIsReset] = useState<boolean>(false);
  const [isResetDropdown, setIsResetDropdown] = useState<boolean>(false);

  const [expenseData, setExpenseData] =
    useState<ExpenseInputDataType>(initialExpenseData);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(null);
  const [validationMessages, setValidationMessages] = useState<
  ValidationMessagesType<typeof initialExpenseData>>({});

//error messages rendering control
const [showValidation, setShowValidation] = useState<ShowValidationType>({
    amount: false,
    account: false,
    category: false,
    note: false
});

//---zustand global state---------------------
  const setAvailableBudget = useBalanceStore(
    (state) => state.setAvailableBudget
  );
//---------------------------------------
//--DATA FETCHING------------------------
  //Endpoints: url_get_accounts_by_type, url_get_total_account_balance_by_type
  //GET: AVAILABLE ACCOUNTS OF TYPE BANK
  const fetchUrl = user
    ? `${url_get_accounts_by_type}/?type=bank&user=${user}&reload=${reloadTrigger}`
    : // <Navigate to='/auth' />
      undefined; //force an error of user ID required
  // console.log('🚀 ~ Expense ~ fetchUrl:', fetchUrl);

  const {
    apiData: BankAccountsResponse,
    isLoading: isLoadingBankAccounts,
    error: fetchedErrorBankAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchUrl as string);
  // console.log({
  //   BankAccountsResponse,
  //   isLoadingBankAccounts,
  //   fetchedErrorBankAccounts,
  // });

//---data transformation
  const optionsExpenseAccounts = useMemo(() => {
    if (fetchedErrorBankAccounts) {
      return ACCOUNT_OPTIONS_DEFAULT;
    }
    const accountList = BankAccountsResponse?.data?.accountList ?? [];

    return accountList.length
      ? accountList.map((acc) => ({
          value: acc.account_name,
          label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})`,
          // label: acc.account_name,
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
  //DATA FETCHING
  const {
    apiData: CategoryBudgetAccountsResponse,
    isLoading: isLoadingCategoryBudgetAccounts,
    error: fetchedErrorCategoryBudgetAccounts,
  } = useFetch<CategoryBudgetAccountsResponseType>(
    `${url_get_accounts_by_type}/?type=category_budget&user=${user}&reload=${reloadTrigger}`
  );

  // console.log('catBudgetResp', {
  //   CategoryBudgetAccountsResponse,
  //   isLoadingCategoryBudgetAccounts,
  //   fetchedErrorCategoryBudgetAccounts,
  // });

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
      ? //  && !fetchedErrorCategoryBudgetAccounts
        'Category / Subategory'
      : '',
    options: optionsExpenseCategories ?? CATEGORY_OPTIONS_DEFAULT,
    variant: VARIANT_DEFAULT as VariantType,
  };
  //-------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  type PayloadType = ExpenseValidatedDataType & {
    user: string; type?:string;
    };
  //FOR DATA POST FETCHING
  const { data, isLoading, error, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });

//-------------------------------------
//----functions--------
// const resetForm = () => {
//   setCurrency(DEFAULT_CURRENCY);
//   setExpenseData(initialExpenseData);
//   setReloadTrigger(prev => prev + 1);
//   setIsReset(true);
//   setIsResetDropdown(true);
//   setValidationMessages({});
//   setShowValidation({
//     amount: false,
//     account: false,
//     category: false,
//     note: false
//   });
// };
// --- Handlers -------
  function updateDataCurrency(currency: CurrencyType) {
    setCurrency(currency);
    setExpenseData((prev) => ({ ...prev, currency: currency }));
  }
//--personalized field handler for category
  function categorySelectHandler(selectedOption: DropdownOptionType | null) {

    setExpenseData((prev) => ({
      ...prev,
      ['category']: selectedOption?.value || '',//mmm
    }));

     // Only validate if we're showing validation for category
    if (showValidation.category) {
      setValidationMessages((prev) => ({ 
        ...prev, 
        category: selectedOption?.value ? '' : '* Please select a category' 
      }));
    }
 //  setValidationMessages((prev) => ({ ...prev, category: '' }));
    console.log(
      'desde categorySelectHandler:',
      selectedOption,
      selectedOption?.value
    );
  }
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
 //  setValidationMessages((prev) => ({ ...prev, account: '' }));
  
  }
//------------------------------------------
//field handler with zod validation
// const accountSelectHandler = createDropdownFieldHandler(
//   expenseSchema,
//   'account',
//   setExpenseData,
//   setValidationMessages
// );
  
// const handleCategoryChange = createDropdownFieldHandler(
//   expenseSchema,
//   'category',
//   setExpenseData,
//   setValidationMessages
// );
  
 //==========================
 //--validation functions and logic ---------------
//EXTRACT FUNCTION for validation and update logic, which will be debounced. 
// Real Time Validation.
// useCallback to make the function stable if its dependencies don't change.

 const processValidationAndUpdateFn = useCallback((name: string, value: string) => {
// Data object for Zod. Zod waits an object with all input data fields to validate them
// Always validate if showValidation is true for this field
if (showValidation[name as keyof ShowValidationType]) 
{
  const currentDataForValidation = {
    ...expenseData ,
      [name]:value, // Value input is taken to validate it
  };
  const {errors:fieldErrors, data:dataValidated} = validateForm(expenseSchema, currentDataForValidation);
  console.log('fieldErrors', fieldErrors, dataValidated);

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
//-------------------------------------
//Handler for form submit
  async function onSaveHandler_zod(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('On Save Handler');
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

    // console.log("🚀 ~ onSaveHandler_zod ~ fullFormErrors:", fullFormErrors, )

  if (fullFormErrors && Object.keys(fullFormErrors).length > 0) {
      setValidationMessages(fullFormErrors);
      setMessageToUser('Please correct the highlighted errors.');
      setTimeout(() => setMessageToUser(null), 4000);
      return; //abort
    }
  //check if validated data exists
  if (!dataValidated) {
    setMessageToUser('Validation failed. Please check your inputs.');
    return;
  }
 
    setMessageToUser('Processing transaction...');

  //--sending data to server -----------------
    //POST ENDPOINT FOR MOVEMENT TRANSACTION HERE
    //update balance account of bank account and category budget account in: user_accounts table.

    //record both transaction descriptions: transfer and receive transactions with the correspondent account info.

    //endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=expense
    //user id is sent via req.body

    try {
      //create a payload with validated data
      const payload: PayloadType = {
        ...dataValidated as ExpenseValidatedDataType  & { user: string; type?: string }
         ,
        user,type: typeMovement
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

     // Verificar si hay error en la respuesta (aunque status sea 200)
     console.log('response from requestFN', error, 'error', error, 'isLoading', isLoading)

    if (response.error || error) {
      const errorMsg = response.error ?? error ?? undefined
      console.log('response?.error?', errorMsg)
      throw new Error(errorMsg);
    }

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from record transaction request:', response);
      }
      
    //-------------------------------
    //update total available balance global state
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
    //------------------------------------  
     setMessageToUser('Transaction recorded successfully!');
      setTimeout(() => setMessageToUser(null), 3000);
    } catch (error) {
      console.error('Submission error (Zod):', error);
      setMessageToUser(error instanceof Error ? error.message : 'An unexpected error occurred during submission.');
      setTimeout(() => setMessageToUser(null), 5000);
    }
  }
  //-------------------------------------
  // --- Side Effects ---
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if ((data || error) && !isLoading) {
      const success = data && !error;
      setMessageToUser(
        success
          ? 'Movement completed successfully!'
          : error ?? 'An error occurred during submission'
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
  }, [data, error, isLoading]);
//-------------------------------------------------
  ///SHOW VALIDATION MSG SIDE EFFECTS
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
// Efecto específico para amount
// ===========================================
useEffect(() => {
  if (expenseData.amount !== '' && !showValidation.amount) {
    setShowValidation(prev => ({ ...prev, amount: true }));
    // La validación real se hará en processValidationAndUpdateFn
  }
}, [expenseData.amount,showValidation.amount]);
//---------------------------------------------------
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
 //rendering compoennts
 //-------Top Card elements ----------
  const topCardElements:TopCardElementsType = {
    titles: { title1: 'amount', title2: 'account' },
    value: expenseData.amount as string,
    selectOptions: accountOptions,
  };
  //-----------------------------------------
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
 {/* } */}
      {messageToUser  && (
        <div className='fade-message'>
          <MessageToUser
            // isLoading={false}
             isLoading={isLoading || isLoadingBankAccounts || isLoadingCategoryBudgetAccounts}
            error={error || fetchedErrorCategoryBudgetAccounts
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
