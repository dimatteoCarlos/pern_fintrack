//src/pages/tracker/expense/Expense.tsx
import { useEffect, useMemo, useState } from 'react';
import CardSeparator from '../components/CardSeparator.tsx';
import { useFetch } from '../../../hooks/useFetch.tsx';
//---
import { useLocation } from 'react-router-dom';
import {
  checkNumberFormatValue,
  numberFormat,
  validationData,
} from '../../../helpers/functions.ts';
import {} from '../../../helpers/functions.ts';
import {
  CurrencyType,
  DropdownOptionType,
  FormNumberInputType,
  ExpenseInputDataType,
  VariantType,
} from '../../../types/types.ts';
import {
  url_get_accounts_by_type,
  url_movement_transaction_record,
} from '../../../endpoints.ts';
import {
  ACCOUNT_OPTIONS_DEFAULT,
  CATEGORY_OPTIONS_DEFAULT,
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
} from '../../../helpers/constants.ts';
import TopCard from '../components/TopCard.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import {
  AccountByTypeResponseType,
  CategoryBudgetAccountsResponseType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import { AxiosRequestConfig } from 'axios';

//-----temporarily data 'till decide how to handle currencies
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
console.log('', { formatNumberCountry });

// ********************PENDIENTE: hay que definir algunas reglas de negocio para status. Establecer como es el manejo de los currencies. data fetching from backend, edition  pages design, buttons and functionality and integration to backend as post (Updating, deleting, patching), definir en overview lo que se refleja en los goals, definir funcionalidad de los pockets y manejo de la informacion. Todo el proceso de calculo en el backend. Que es available Budget? es la suma de los budget? es el balance total de las cuentas tipo bank? o es todo el patrimonio?o que?.
//------------------------------------------------------

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
function Expense(): JSX.Element {
  //----Expense Tracker Movement -------
  //rules: only bank accounts type are used to make expenses
  //select option accounts rendered are all existing bank accounts, but the slack account which is not shown
  const router = useLocation();
  const trackerState = router.pathname.split('/')[2];
  const typeMovement = trackerState.toLowerCase();
  console.log('movement:', typeMovement);
  const user = import.meta.env.VITE_USER_ID;

  // el usuario se deberia pasar via cookie o header al backend
  //url_get_accounts_by_type
  //DATA FETCHING
  //GET: AVAILABLE ACCOUNTS OF TYPE BANK
  // console.log(
  //   'url get accounts by type:',
  //   `${url_get_accounts_by_type}/?type=bank&user=${user}`
  // );

  const {
    data: BankAccountsResponse,
    isLoading: isLoadingBankAccounts,
    error: fetchedErrorBankAccounts,
    message: messageBA,
  } = useFetch<AccountByTypeResponseType>(
    `${url_get_accounts_by_type}/?type=bank&user=${user}`
  );

  console.log('PRUEBA ERROR:', fetchedErrorBankAccounts);

  const optionsExpenseAccounts = useMemo(() => {
    return !isLoadingBankAccounts &&
      !fetchedErrorBankAccounts &&
      BankAccountsResponse?.data.accountList?.length
      ? BankAccountsResponse?.data.accountList?.map((acc) => ({
          value: `${acc.account_name}`,
          label: `${acc.account_name}`,
        }))
      : ACCOUNT_OPTIONS_DEFAULT;
  }, [
    BankAccountsResponse?.data.accountList,
    isLoadingBankAccounts,
    fetchedErrorBankAccounts,
  ]);

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
    data: CategoryBudgetAccountsResponse,
    isLoading: isLoadingCategoryBudgetAccounts,
    error: fetchedErrorCategoryBudgetAccounts,
    message: messageCBA,
  } = useFetch<CategoryBudgetAccountsResponseType>(
    `${url_get_accounts_by_type}/?type=category_budget&user=${user}`
  );

  const optionsExpenseCategories = useMemo(() => {
    return !isLoadingCategoryBudgetAccounts &&
      !fetchedErrorCategoryBudgetAccounts
      ? CategoryBudgetAccountsResponse?.data.accountList?.map((cat) => ({
          value: `${cat.account_name}`,
          label: `${cat.account_name}`,
        }))
      : null;
  }, [
    isLoadingCategoryBudgetAccounts,
    fetchedErrorCategoryBudgetAccounts,
    CategoryBudgetAccountsResponse?.data.accountList,
  ]);

  const categoryOptions = {
    title:
      optionsExpenseCategories && !fetchedErrorCategoryBudgetAccounts
        ? 'Category / Subategory'
        : 'No Categories available',
    options: optionsExpenseCategories ?? CATEGORY_OPTIONS_DEFAULT,
    variant: VARIANT_DEFAULT as VariantType,
  };

  //---------------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  type PayloadType = ExpenseInputDataType & {
    user: string;
    // transaction_actual_date: string | Date;
  };

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

  //--------------------------------------------

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if ((data || error) && !isLoading) {
      setShowMessage(true);
      timer = setTimeout(() => {
        setShowMessage(false);
      }, 3000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [data, error, isLoading]);
  //---------------------------------------------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    //Success for POST
    if (data && !isLoading && !error) {
      // Success response

      console.log('Received data:', data);
      setMessageToUser('Movement completed successfully!');
      // setMessageToUser(message || 'Movement completed successfully!');

      //resetting message to user
      timer = setTimeout(() => {
        setMessageToUser(null);
      }, 6000);
    }
    //Any error
    else if (
      error ||
      fetchedErrorBankAccounts ||
      fetchedErrorCategoryBudgetAccounts
    ) {
      const errorMessage = messageBA || messageCBA ;

      setMessageToUser(errorMessage || 'Unknown error');

      timer = setTimeout(() => setMessageToUser(null), 7000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    data,
    isLoading,
    error,
    fetchedErrorBankAccounts,
    fetchedErrorCategoryBudgetAccounts,
    messageBA,
    messageCBA,
  ]);
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
      const { formatMessage, valueNumber, isError, valueToSave } =
        checkNumberFormatValue(value);

      // Update numeric state value. Actualizar el estado numerico en el formulario
      setFormData({
        ...formData,
        [name]: value,
      });
      console.log({ formatMessage, valueNumber, isError, valueToSave });
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

    const formattedNumber = numberFormat(expenseData.amount || 0);
    console.log(
      'Expense formatted amount as a string:',
      { formattedNumber },
      typeof formattedNumber
    );

    //----------------------------------------------
    //validation of entered data
    const newValidationMessages = validationData(expenseData);

    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }

    //--------------------------------------------------
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
      console.log(
        '🚀 ~ onSubmitForm ~ finalUrl:',
        finalUrl,
        'date:',
        payload.date,
        'este es el payload:',
        payload
      );

      const data = await requestFn(payload, {
        url: finalUrl,
      } as AxiosRequestConfig);

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from New Account request:', data);
      }

      //reset the state and the selected options on select component

      setCurrency(defaultCurrency);
      setExpenseData(initialExpenseData);
      setIsReset(true); //admitir que category sea undefined - must admit undefined category
      setValidationMessages({});
      setFormData(initialFormData);

      setTimeout(() => setIsReset(false), 300);
    } catch (error) {
      console.error('Submission error:', error);
    }
  }

  //---------------------------------------------

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
          selectedValue={expenseData.account}
          setSelectState={setExpenseData}
          isReset={isReset}
          setIsReset={setIsReset}
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
        error={error}
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

// if (import.meta.env.VITE_ENVIRONMENT === 'development') {
//   console.log('Data from New Account request:', BankAccountsResponse);
// }

// (${numberFormatCurrency(
//   acc.account_balance,
//   0,
//   acc.currency_code,
//   'en-US'
// )}
//   )
