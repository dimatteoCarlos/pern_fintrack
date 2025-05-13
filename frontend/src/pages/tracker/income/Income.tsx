//src/pages/tracker/income/Income.tsx
import { useEffect, useMemo, useState } from 'react';
import CardSeparator from '../components/CardSeparator.tsx';
import {
  validationData,
  numberFormat,
  checkNumberFormatValue,
} from '../../../helpers/functions.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';
import {
  CurrencyType,
  DropdownOptionType,
  FormNumberInputType,
  IncomeInputDataType,
  VariantType,
  // TopCardSelectStateType,
  // IncomeAccountsType,
  // SourcesType,
  // SourceType,
} from '../../../types/types.ts';
import {
  url_get_accounts_by_type,
  url_get_total_account_balance_by_type,
  url_movement_transaction_record,
  // url_accounts,
  // url_sources,
} from '../../../endpoints.ts';

import { useLocation } from 'react-router-dom';
import {
  DEFAULT_CURRENCY,
  SOURCE_OPTIONS_DEFAULT,
  INCOME_OPTIONS_DEFAULT,
  PAGE_LOC_NUM,
  // CURRENCY_OPTIONS,
} from '../../../helpers/constants.ts';
import TopCard from '../components/TopCard.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import {
  AccountByTypeResponseType,
  BalanceBankRespType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.tsx';
import useBalanceStore from '../../../stores/useBalanceStore.ts';
import axios, { AxiosRequestConfig } from 'axios';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';

//-----temporarily data 'till decide how to handle currencies
const defaultCurrency: CurrencyType = DEFAULT_CURRENCY;
// const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
// console.log('🚀 ~ Income ~ formatNumberCountry:', formatNumberCountry);
//input income data state variables
// type IncomeInputDataType = {
//   amount: number;
//   account: string;
//   source: string;
//   note: string;
//   currency: string;
// };
const initialIncomeData: IncomeInputDataType = {
  amount: 0,
  account: '',
  source: '',
  note: '',
  currency: defaultCurrency,
};

const VARIANT_DEFAULT: VariantType = 'tracker';
//------------------------------
const initialFormData: FormNumberInputType = { amount: '' };
//------------------------------
//----Income Tracker Movement -------
function Income() {
  //rules: only bank accounts type are used to receive income
  //select option accounts rendered are all existing bank accounts, but the slack account which is not shown
  const { pathname } = useLocation();
  const trackerState = pathname.split('/')[PAGE_LOC_NUM];

  const typeMovement = trackerState.toLowerCase();
  console.log('movement:', typeMovement);
  //--------------------------------------
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
  //---- Income account Options -----------
  //DATA FETCHING
  //GET: AVAILABLE ACCOUNTS OF TYPE BANK
  const fetchUrl = user
    ? `${url_get_accounts_by_type}/?type=bank&user=${user}`
    : // <Navigate to='/auth' />
      undefined; //esto ees forzar un error de user ID required
  //definir que hacer si no hay user id
  console.log('🚀 ~ Income ~ fetchUrl:', fetchUrl);

  const {
    apiData: BankAccountsResponse,
    isLoading: isLoadingBankAccounts,
    error: fetchedErrorBankAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchUrl as string);

  // console.log('🚀 ~ Income ~ BankAccountsResponse:', BankAccountsResponse);
  // console.log('BANK resp', BankAccountsResponse, fetchedErrorBankAccounts);

  const optionsIncomeAccounts = useMemo(
    () =>
      BankAccountsResponse?.data?.accountList?.length &&
      !fetchedErrorBankAccounts &&
      !isLoadingBankAccounts
        ? BankAccountsResponse?.data.accountList?.map((acc) => ({
            value: acc.account_name,
            label: acc.account_name,
          }))
        : INCOME_OPTIONS_DEFAULT,
    [
      BankAccountsResponse?.data.accountList,
      fetchedErrorBankAccounts,
      isLoadingBankAccounts,
    ]
  );

  const accountOptions = {
    title: 'Available Account',
    options: optionsIncomeAccounts,
    variant: VARIANT_DEFAULT,
  };

  //--------
  //income sources - are these sources attached to a specific bank accounts?
  //DATA FETCHING
  const fetchSourceUrl = user
    ? `${url_get_accounts_by_type}/?type=income_source&user=${user}`
    : // <Navigate to='/auth' />
      undefined; //esto ees forzar un error de user ID required
  //definir que hacer si no hay user id
  // console.log('🚀 ~ Income ~ fetchSourceUrl:', fetchSourceUrl);

  const {
    apiData: sources,
    error: errorSources,
    isLoading: loadingSources,
  } = useFetch<AccountByTypeResponseType>(fetchSourceUrl as string);

  const sourceOptions = {
    title:
      sources && !loadingSources ? 'Source of income' : 'No Source available',
    options:
      !errorSources && sources?.data.accountList.length
        ? sources?.data.accountList?.map((src) => ({
            value: src.account_name,
            label: src.account_name,
          }))
        : SOURCE_OPTIONS_DEFAULT,
    variant: VARIANT_DEFAULT as VariantType,
  };
  //---------------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  //extend the type of input data with user id
  type PayloadType = IncomeInputDataType & { user: string };
  //---------------------------
  //DATA POST FETCHING
  const { data, isLoading, error, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });

  //---states------
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [incomeData, setIncomeData] =
    useState<IncomeInputDataType>(initialIncomeData);

  const [formData, setFormData] = useState(initialFormData);
  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});
  const [isReset, setIsReset] = useState<boolean>(false);

  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null
  );
  const [showMessage, setShowMessage] = useState(false);

  //----
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

  //
  //----functions--------
  function updateDataCurrency(currency: CurrencyType) {
    setCurrency(currency);
    setIncomeData((prev) => ({ ...prev, currency: currency }));
    // console.log('updateDataCurrency:', currency);
  }

  function sourceSelectHandler(selectedOption: DropdownOptionType | null) {
    setIncomeData((prev) => ({
      ...prev,
      ['source']: selectedOption?.value, //could be undefined
    }));

    // console.log(
    //   'desde incomeSelectHandler:',
    //   selectedOption,
    //   selectedOption?.value
    // );
  }
  //---------------------------------------
  function updateTrackerData(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    e.preventDefault();
    const { name, value } = e.target;

    if (name === 'amount') {
      const { formatMessage, valueNumber, isError, valueToSave } =
        checkNumberFormatValue(value);

      // Update numeric state value in the form. Actualizar el estado numerico en el
      // formulario
      setFormData({
        ...formData,
        [name]: value,
      });
      console.log({ formatMessage, valueNumber, isError, valueToSave });

      setValidationMessages((prev) => ({
        ...prev,
        [name]: ` * Format: ${formatMessage}`,
      }));

      if (isError) {
        console.log('Number Format Error occurred');
        setValidationMessages((prev) => ({
          ...prev,
          [name]: ` * Error: ${formatMessage}`,
        }));
      }
      setIncomeData((prev) => ({ ...prev, [name]: valueToSave }));
      return;
    } else {
      setIncomeData((prev) => ({ ...prev, [name]: value }));
    }
  }
  //------------------------
  async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('On Save Handler');
    e.preventDefault();
    //-------------------------
    const formattedNumber = numberFormat(incomeData.amount || 0);
    console.log(
      'formatted amount as a string:',
      { formattedNumber },
      typeof formattedNumber
    );
    //-------entered datatrack validation messages --------
    //validation of entered data
    const newValidationMessages = validationData(incomeData);
    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //------------------------
    //POST ENDPOINT FOR MOVEMENT TRANSACTION HERE
    console.log('Income data state to Post:', incomeData);
    //------------------------
    //update balance account of bank account and income_source accounts in: user_accounts table.

    //record both transaction descriptions: transfer and receive transactions with the correspondent account info.

    //endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=income

    try {
      const payload: PayloadType = {
        ...incomeData,
        // source: incomeData.source || '',
        user,
      };
      const postUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;
      // console.log(
      //   '🚀 ~ onSubmitForm ~ finalUrl:',
      //   finalUrl,
      //   'date:',
      //   payload.date,
      //   'este es el payload:',
      //   payload
      // );

      const data = await requestFn(payload, {
        url: postUrl,
      } as AxiosRequestConfig);

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from record transaction request:', data);
      }

      //reset values after posting the info   -- This could be a function -- need to set initial parameters for all 4 tracker/states in just one function./it seems that all are the same
      setCurrency(defaultCurrency);
      setIncomeData(initialIncomeData);

      setIsReset(true);
      setValidationMessages({});
      setFormData(initialFormData);

      setTimeout(() => {
        setIsReset(false);
      }, 1500);
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

  //---------------------------------------------

  //---------------------------------------------
  //-------Top Card elements
  const topCardElements = {
    titles: { title1: 'amount', title2: 'account' },
    value: formData.amount,
    selectOptions: accountOptions,
  };
  //--------------------------
  return (
    <>
      <form className='income' style={{ color: 'inherit' }}>
        {/* TOP CARD START */}
        <TopCard
          topCardElements={topCardElements}
          validationMessages={validationMessages}
          updateTrackerData={updateTrackerData}
          trackerName={trackerState}
          currency={currency}
          updateCurrency={updateDataCurrency}
          selectedValue={incomeData.account}
          setSelectState={setIncomeData}
          isReset={isReset}
          setIsReset={setIsReset}
        />
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
            updateOptionHandler={sourceSelectHandler}
            isReset={isReset}
            setIsReset={setIsReset}
          />

          <CardNoteSave
            title={'note'}
            validationMessages={validationMessages}
            dataHandler={updateTrackerData}
            inputNote={incomeData.note}
            onSaveHandler={onSaveHandler}
          />
        </div>
      </form>

      <MessageToUser
        isLoading={isLoading || isLoadingBankAccounts || loadingSources}
        //probar que muestra como error o si muestra algo
        error={error || fetchedErrorBankAccounts || errorSources}
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
export default Income;
