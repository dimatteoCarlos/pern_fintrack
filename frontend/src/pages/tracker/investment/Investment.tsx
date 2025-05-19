import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetch } from '../../../hooks/useFetch.tsx';
import {
  url_get_accounts_by_type,
  url_get_total_account_balance_by_type,
  url_movement_transaction_record,
} from '../../../endpoints.ts';
import CardSeparator from '../components/CardSeparator.tsx';
import Datepicker from '../../../general_components/datepicker/Datepicker.tsx';
import {
  CurrencyType,
  FormNumberInputType,
  InvestmentInputDataType,
  TransactionType,
  VariantType,
} from '../../../types/types.ts';
import {
  checkNumberFormatValue,
  numberFormat,
  validationData,
} from '../../../helpers/functions.ts';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_CURRENCY,
  INVESTMENT_ACCOUNT_OPTIONS_DEFAULT,
  PAGE_LOC_NUM,
  // CURRENCY_OPTIONS,
} from '../../../helpers/constants.ts';
import TopCard from '../components/TopCard.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import {
  AccountByTypeResponseType,
  BalanceBankRespType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.tsx';
import useBalanceStore from '../../../stores/useBalanceStore.ts';
import axios, { AxiosRequestConfig } from 'axios';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';

//------------------------------
//temporary values
const defaultCurrency: CurrencyType = DEFAULT_CURRENCY;
// const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
// console.log('🚀 ~ Debts ~ formatNumberCountry:', formatNumberCountry);
//input investment data state variables
// type InvestmentInputDataType = {
//   amount: number | '';
//   account: string;
//   currency: CurrencyType;
//   type: TransactionType;
//   date: Date;
//   note: string;
// };
const initialInvestmentData: InvestmentInputDataType = {
  amount: 0,
  account: '',
  currency: defaultCurrency,
  type: 'deposit',
  date: new Date(), //
  note: '',
};
const VARIANT_DEFAULT: VariantType = 'tracker';
const initialFormData: FormNumberInputType = {
  amount: '',
};
//------------------------------------------
function Investment() {
  //----Investment account Options----------
  const { pathname } = useLocation();
  const trackerState = pathname.split('/')[PAGE_LOC_NUM];

  const typeMovement = trackerState.toLowerCase();
  console.log('movement:', typeMovement);

  // const { userData } = useAuthStore((state) => ({
  //   userData: state.userData,
  //   isAuthenticated: state.isAuthenticated,
  // }));

  // console.log('userData state:', userData);
  //userId
  // const user = userData?.userId;
  // console.log('userID', userID);

  const user = import.meta.env.VITE_USER_ID;
  //-----------------------------------------------------
  //DATA FETCHING
  //GET: AVAILABLE ACCOUNTS OF TYPE BANK
  const fetchUrl = user
    ? `${url_get_accounts_by_type}/?type=investment&user=${user}`
    : // <Navigate to='/auth' />
      undefined; //esto ees forzar un error de user ID required
  //definir que hacer si no hay user id
  console.log('🚀 ~ Expense ~ fetchUrl:', fetchUrl);

  const {
    apiData: InvestmentAccountsResponse,
    isLoading: isLoadingInvestmentAccounts,
    error: fetchedErrorInvestmentAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchUrl as string);

  const investmentAccounts = useMemo(
    () =>
      !isLoadingInvestmentAccounts &&
      !fetchedErrorInvestmentAccounts &&
      InvestmentAccountsResponse?.data?.accountList?.length
        ? InvestmentAccountsResponse?.data.accountList?.map((acc) => ({
            value: acc.account_name,
            label: acc.account_name,
          }))
        : INVESTMENT_ACCOUNT_OPTIONS_DEFAULT,
    [
      InvestmentAccountsResponse?.data.accountList,
      fetchedErrorInvestmentAccounts,
      isLoadingInvestmentAccounts,
    ]
  );

  const optionsInvestmentAccounts = {
    title: 'Available Account',
    options: investmentAccounts,
    variant: VARIANT_DEFAULT,
  };
  //---------------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  //extend the type of input data with user id
  type PayloadType = InvestmentInputDataType & { user: string };
  //---------------------------
  const { data, isLoading, error, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });

  //---states--------------------------
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [investmentData, setInvestmentData] = useState<InvestmentInputDataType>(
    initialInvestmentData
  );
  const [typeInv, setTypeInv] = useState<TransactionType>('deposit');
  const [isReset, setIsReset] = useState<boolean>(false);
  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);
  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

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

  //----functions--------
  const updateDataCurrency = useCallback((currency: CurrencyType) => {
    setCurrency(currency);
    setInvestmentData((prev) => ({ ...prev, currency: currency }));
  }, []);
  //-----------

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
        [name]: ` * Format: ${formatMessage}`,
      }));

      if (isError) {
        console.log('Number Format Error occurred');
        setValidationMessages((prev) => ({
          ...prev,
          [name]: ` * Error: ${formatMessage}`,
        }));
      }
      setInvestmentData((prev) => ({ ...prev, [name]: valueToSave }));
      return;
    } else {
      setInvestmentData((prev) => ({ ...prev, [name]: value }));
    }
  }
  //------------------------
  const toggleInvestmentType = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setTypeInv((prev: TransactionType) =>
        prev === 'deposit' ? 'withdraw' : 'deposit'
      );
    },
    []
    // [typeInv]
  );
  //--
  function changeInvestmentDate(selectedDate: Date): void {
    setInvestmentData((prev) => ({ ...prev, date: selectedDate }));
  }
  //-----useEffect--------
  useEffect(() => {
    updateDataCurrency(currency);
    setInvestmentData((prev) => ({ ...prev, type: typeInv }));
  }, [currency, typeInv, updateDataCurrency]);
  //------------------------
  //---------------------------------------
  async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('On Save Handler');
    e.preventDefault();
    const formattedNumber = numberFormat(investmentData.amount || 0);
    console.log(
      'num formato string:',
      { formattedNumber },
      typeof formattedNumber
    );
    //----------------------------------------------------------------------------
    //validation of entered data
    const newValidationMessages = { ...validationData(investmentData) };
    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }

    //----------------------------
    //POST ENDPOINT FOR MOVEMENT TRANSACTION HERE
    console.log('Investment data state to Post:', investmentData);
    //----------------------------
    //update balance account of bank account and income_source accounts in: user_accounts table.

    //record both transaction descriptions: transfer and receive transactions with the correspondent account info.

    //endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=investment

    try {
      const payload: PayloadType = {
        ...investmentData,
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

      //resetting values
      setCurrency(defaultCurrency);
      setInvestmentData(initialInvestmentData);

      setTypeInv('deposit');
      updateDataCurrency(defaultCurrency);
      setIsReset(true);
      setValidationMessages({});
      setFormData(initialFormData);

      // after a delay, change isReset to false
      setTimeout(() => {
        setIsReset(false);
      }, 500);

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

  //-------Top Card elements
  const topCardElements = {
    titles: { title1: 'amount', title2: 'debit account' },
    value: formData.amount,
    selectOptions: optionsInvestmentAccounts,
  };
  //--------------------------
  return (
    <>
      <form className='investment' style={{ color: 'inherit' }}>
        {/* <RadioInput
          title={ratioTitle}
          inputRadioOptions={inputRadioOptions}
          radioOptionSelected={radioOptionSelected}
          setRadioOptionSelected={setRadioOptionSelected}
        /> */}

        {/* TOP CARD START */}

        <TopCard
          topCardElements={topCardElements}
          validationMessages={validationMessages}
          updateTrackerData={updateTrackerData}
          trackerName={trackerState}
          currency={currency}
          updateCurrency={updateDataCurrency}
          setSelectState={setInvestmentData}
          isReset={isReset}
          setIsReset={setIsReset}
          // selectedValue={investmentData.account}
        />
        <CardSeparator />
        {/* BOTTOM CARD START */}
        <div className='state__card--bottom'>
          <div className='card__typeDate__container'>
            <div className='card__typeDate--type'>
              <div className='card--title'>Type</div>
              <button
                className='card__screen--type'
                onClick={toggleInvestmentType}
              >
                <div className='screen--concept'>{typeInv}</div>
              </button>
            </div>

            <div className='card__typeDate--date  '>
              <div className='card--title '> Date </div>
              <div className='card__screen--date '>
                <Datepicker
                  changeDate={changeInvestmentDate}
                  date={investmentData.date ?? new Date()}
                  variant={'tracker'}
                  isReset={isReset}
                />
              </div>
            </div>
          </div>
          {/*  */}
          <CardNoteSave
            title={'note'}
            validationMessages={validationMessages}
            dataHandler={updateTrackerData}
            inputNote={investmentData.note}
            onSaveHandler={onSaveHandler}
          />
        </div>
      </form>

      <MessageToUser
        isLoading={isLoading || isLoadingInvestmentAccounts}
        //probar que muestra como error o si muestra algo
        error={error || fetchedErrorInvestmentAccounts}
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
export default Investment;
