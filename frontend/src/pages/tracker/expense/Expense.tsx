//src/pages/tracker/expense/Expense.tsx
import { useEffect, useMemo, useState } from 'react';
import CardSeparator from '../components/CardSeparator.tsx';
import { useFetch } from '../../../hooks/useFetch.tsx';
//---
import { useLocation } from 'react-router-dom';
// import { Navigate, useLocation } from 'react-router-dom';
import {
  checkNumberFormatValue,
  // numberFormat,
  validationData,
} from '../../../helpers/functions.ts';
import {
  CurrencyType,
  DropdownOptionType,
  FormNumberInputType,
  ExpenseInputDataType,
  VariantType,
} from '../../../types/types.ts';
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
import TopCard from '../components/TopCard.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import {
  AccountByTypeResponseType,
  BalanceBankRespType,
  CategoryBudgetAccountsResponseType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import axios, { AxiosRequestConfig } from 'axios';
import useBalanceStore from '../../../stores/useBalanceStore.ts';
// import { useAuthStore } from '../../../auth/stores/useAuthStore.ts';
// import SpinLoader from '../../../loader/spin/SpinLoader.tsx';

//-----temporarily data 'till decide how to handle currencies
const defaultCurrency = DEFAULT_CURRENCY;
// const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
// console.log('', { formatNumberCountry });
// ********************
const initialExpenseData: ExpenseInputDataType = {
  amount: 0,
  account: '',
  category: '',
  note: '',
  currency: defaultCurrency,
};

const VARIANT_DEFAULT: VariantType = 'tracker';
//------------------------------
const initialFormData: FormNumberInputType = {
  amount: '',
};
//-------------------------------------
//----Expense Tracker Movement -------
function Expense(): JSX.Element {
  //rules: only bank accounts type are used to make expenses
  //select option accounts rendered are all existing bank accounts, but the slack account which is not shown
  const router = useLocation();
  const trackerState = router.pathname.split('/')[PAGE_LOC_NUM];

  const typeMovement = trackerState.toLowerCase();
  // console.log('movement:', typeMovement);

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

  // const user = 'e71a1b29-8838-4398-b481-bd149bceb01f';

  // el user se deberia pasar via cookie o header al backend
  //-----------------------------------------------------
  //url_get_accounts_by_type
  //DATA FETCHING
  //GET: AVAILABLE ACCOUNTS OF TYPE BANK
  const fetchUrl = user
    ? `${url_get_accounts_by_type}/?type=bank&user=${user}`
    : // <Navigate to='/auth' />
      undefined; //esto ees forzar un error de user ID required
  //definir que hacer si no hay user id
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

  // console.log('🚀 ~ Expense ~ BankAccountsResponse:', BankAccountsResponse);
  // console.log('BANK resp', BankAccountsResponse, fetchedErrorBankAccounts);

  const optionsExpenseAccounts = useMemo(() => {
    if (fetchedErrorBankAccounts) {
      return ACCOUNT_OPTIONS_DEFAULT;
    }
    const accountList = BankAccountsResponse?.data?.accountList ?? [];

    return accountList.length
      ? accountList.map((acc) => ({
          value: acc.account_name,
          label: acc.account_name,
        }))
      : ACCOUNT_OPTIONS_DEFAULT;
  }, [BankAccountsResponse?.data.accountList, fetchedErrorBankAccounts]);

  const accountOptions = {
    title: 'Available Account',
    options: optionsExpenseAccounts,
    variant: 'tracker' as VariantType,
  };
  //--------
  //category options
  //GET: ACCOUNTS OF TYPE CATEGORY_BUDGET AVAILABLE
  //DATA FETCHING

  const {
    apiData: CategoryBudgetAccountsResponse,
    isLoading: isLoadingCategoryBudgetAccounts,
    error: fetchedErrorCategoryBudgetAccounts,
  } = useFetch<CategoryBudgetAccountsResponseType>(
    `${url_get_accounts_by_type}/?type=category_budget&user=${user}`
  );

  // console.log('catBudgetResp', {
  //   CategoryBudgetAccountsResponse,
  //   isLoadingCategoryBudgetAccounts,
  //   fetchedErrorCategoryBudgetAccounts,
  // });

  //como evaluar si hay un error y de que tipo>

  // const optionsExpenseCategories = CATEGORY_OPTIONS_DEFAULT;

  const optionsExpenseCategories = useMemo(() => {
    const categoryList =
      CategoryBudgetAccountsResponse?.data?.accountList || [];

    if (fetchedErrorCategoryBudgetAccounts) {
      return CATEGORY_OPTIONS_DEFAULT;
    }

    // if (isLoadingCategoryBudgetAccounts || fetchedErrorCategoryBudgetAccounts) {
    //   return CATEGORY_OPTIONS_DEFAULT;
    // }

    return categoryList.map((cat) => ({
      value: cat.account_name,
      label: cat.account_name,
    }));
  }, [
    CategoryBudgetAccountsResponse?.data?.accountList,
    fetchedErrorCategoryBudgetAccounts,
  ]);

  //---------------------------------------------
  const categoryOptions = {
    title: optionsExpenseCategories
      ? //  && !fetchedErrorCategoryBudgetAccounts
        'Category / Subategory'
      : 'No Categories available',
    options: optionsExpenseCategories ?? CATEGORY_OPTIONS_DEFAULT,
    variant: VARIANT_DEFAULT as VariantType,
  };

  //------------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  type PayloadType = ExpenseInputDataType & {
    user: string;
    // transaction_actual_date: string | Date;
  };
  //DATA POST FETCHING
  const { data, isLoading, error, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });

  //---states-------------
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [isReset, setIsReset] = useState<boolean>(false);

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [expenseData, setExpenseData] =
    useState<ExpenseInputDataType>(initialExpenseData);

  const [formData, setFormData] = useState(initialFormData);

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null
  );
  //---
  const [showMessage, setShowMessage] = useState(false);

  //--------------------------------------------
  const setAvailableBudget = useBalanceStore(
    (state) => state.setAvailableBudget
  );

  //---------------------------------------------
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

  //------------------------------------------------------
  //----functions--------
  function updateDataCurrency(currency: CurrencyType) {
    setCurrency(currency);
    setExpenseData((prev) => ({ ...prev, currency: currency }));
  }

  function categorySelectHandler(selectedOption: DropdownOptionType | null) {
    setExpenseData((prev) => ({
      ...prev,
      ['category']: selectedOption?.value,
    }));
    // console.log(
    //   'desde categorySelectHandler:',
    //   selectedOption,
    //   selectedOption?.value
    // );
  }
  //=========
  function updateTrackerData(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    e.preventDefault();
    const { name, value } = e.target;
    //-----------
    if (name === 'amount') {
      const { formatMessage, isError, valueToSave } =
        checkNumberFormatValue(value);
      // valueNumber,

      // Update numeric state value. Actualizar el estado numerico en el formulario
      setFormData({
        ...formData,
        [name]: value,
      });
      // console.log({ formatMessage, valueNumber, isError, valueToSave });
      setValidationMessages((prev) => ({
        ...prev,
        [name]: ` Format: ${formatMessage}`,
      }));

      if (isError) {
        console.log('Number Format Error occurred');
        setValidationMessages((prev) => ({
          ...prev,
          [name]: ` * Error: ${formatMessage}`,
        }));
      }
      setExpenseData((prev) => ({ ...prev, [name]: valueToSave }));

      return;
    } else {
      setExpenseData((prev) => ({ ...prev, [name]: value }));
    }
  }
  //-----------------------------------------------
  async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('On Save Handler');
    e.preventDefault();

    // const formattedNumber = numberFormat(expenseData.amount || 0);
    // console.log(
    //   'Expense formatted amount as a string:',
    //   { formattedNumber },
    //   typeof formattedNumber
    // );

    //----------------------------------------------
    //validation of entered data
    const newValidationMessages = validationData(expenseData);

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //-------------------------------------------------
    //POST ENDPOINT FOR MOVEMENT TRANSACTION HERE
    //update balance account of bank account and category budget account in: user_accounts table.
    //record both transaction descriptions: transfer and receive transactions with the correspondent account info.
    //endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=expense
    //user id is sent via req.body

    try {
      const payload: PayloadType = {
        ...expenseData,
        user,
      };
      const finalUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;
      // console.log(
      //   '🚀 ~ onSubmitForm ~ finalUrl:',
      //   finalUrl,
      //   'date:',
      //   payload.date,
      //   'este es el payload:',
      //   payload
      // );

      const data = await requestFn(payload, {
        url: finalUrl,
      } as AxiosRequestConfig);

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from record transaction request:', data);
      }

      //reset the state and the selected options on select component
      setCurrency(defaultCurrency);
      setExpenseData(initialExpenseData);
      setIsReset(true); //admitir que category sea undefined - must admit undefined category
      setValidationMessages({});
      setFormData(initialFormData);

      setTimeout(() => setIsReset(false), 300);

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
    } catch (error) {
      console.error('Submission error:', error);
    }
  }

  //---------------------------------------------,

  //-------Top Card elements -----------------------
  const topCardElements = {
    titles: { title1: 'amount', title2: 'account' },
    value: formData.amount,
    selectOptions: accountOptions,
  };

  //-------------------------------------------------
  return (
    <>
      <form className='expense' style={{ color: 'inherit' }}>
        {/* start of TOP CARD */}
        <TopCard
          topCardElements={topCardElements}
          validationMessages={validationMessages}
          updateTrackerData={updateTrackerData}
          trackerName={trackerState}
          currency={currency}
          updateCurrency={updateDataCurrency}
          setSelectState={setExpenseData}
          isReset={isReset}
          setIsReset={setIsReset}
          // selectedValue={expenseData.account}
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
            dataHandler={updateTrackerData}
            inputNote={expenseData.note}
            onSaveHandler={onSaveHandler}
          />

          {/* end of BOTTOM CARD */}
        </div>
      </form>

      <MessageToUser
        isLoading={
          isLoading || isLoadingBankAccounts || isLoadingCategoryBudgetAccounts
        }
        //probar que muestra como error o si muestra algo
        error={
          error ||
          fetchedErrorBankAccounts ||
          fetchedErrorCategoryBudgetAccounts
        }
        messageToUser={messageToUser}
        variant='tracker'
      />

      {showMessage && !isLoading && (
        <div className='fade-message'>
          <MessageToUser
            isLoading={false}
            error={error}
            messageToUser={messageToUser}
            variant='form'
          />
        </div>
      )}
    </>
  );
}

export default Expense;
