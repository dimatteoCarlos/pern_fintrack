
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
  BasicTrackerMovementInputDataType,
  TransactionType,
  VariantType,
  TopCardElementsType
} from '../../../types/types.ts';
import {
  checkNumberFormatValue,
 // numberFormat,
  validationData,
} from '../../../helpers/functions.ts';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_CURRENCY,
  PAGE_LOC_NUM,
  // INVESTMENT_ACCOUNT_OPTIONS_DEFAULT,
  // CURRENCY_OPTIONS,
} from '../../../helpers/constants.ts';
import TopCardPnL from '../components/TopCardPnL.tsx';
// import TopCard from '../components/TopCard.tsx';
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
const VARIANT_DEFAULT: VariantType = 'tracker';
//temporary values
const defaultCurrency: CurrencyType = DEFAULT_CURRENCY;
// constants
const initialData: BasicTrackerMovementInputDataType = {
  amount: 0,
  account: '',
  currency: defaultCurrency,
  type: 'deposit',
  date: new Date(), 
  note: '',
  accountType:"",
  //accountId:"",
};

const initialFormNumberData: FormNumberInputType = {
  amount: '',
};

//---Profit and Loss adjustment ---------
function PnL() {
//----Account Options--------------------
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
  // ----------------------------------

  //---states--------------------------
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);

  const [transactionType, setTransactionType] = useState<TransactionType>('deposit');

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  
  const [formInputData, setFormInputData] = useState<BasicTrackerMovementInputDataType>(
    initialData
  );
  
  const [formNumberData, setFormNumberData] =
  useState<FormNumberInputType>(initialFormNumberData);
  
  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null
  );
  
  const [showMessage, setShowMessage] = useState(false);

  const [isReset, setIsReset] = useState<boolean>(false);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);
  
  // const [isResetAccount, setIsResetAccount] = useState<boolean>(true);
  
  //----
  const setAvailableBudget = useBalanceStore(
    (state) => state.setAvailableBudget
  );
  //---------------------------------------------
  //---Account bank and/or investment options----
  //DATA FETCHING
  //GET: AVAILABLE ACCOUNTS OF TYPE BANK OR INVESTMENT
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

   const accountsToSelect = useMemo(
    () =>
      !isLoadingAccountDataApiResponse &&
      !fetchedErrorAccountDataApiResponse &&
      accountDataApiResponse?.data?.accountList?.length
        ? accountDataApiResponse?.data.accountList?.map((acc) => ({
          label: `${acc.account_name} (${acc.account_type_name} ${acc.currency_code} ${acc.account_balance})` ,
          value: acc.account_name,
          }))
        : [
          // {
          //   value: '0',
          //   label: 'No accounts',
          // }
        ],//INVESTMENT_ACCOUNT_OPTIONS_DEFAULT,
    [
      accountDataApiResponse?.data.accountList,
      fetchedErrorAccountDataApiResponse,
      isLoadingAccountDataApiResponse,
    ]
  );

  const optionsAccountsToSelect = {
    title: 'Select Account',
    options: accountsToSelect,
    variant: VARIANT_DEFAULT,
  };
//-----------------------------
const accountsListInfo = 
      !isLoadingAccountDataApiResponse &&
      !fetchedErrorAccountDataApiResponse &&
      accountDataApiResponse?.data?.accountList?.length    
        ? accountDataApiResponse?.data.accountList?.map((account)=>({...account}))
        :[]
  
  // console.log('accountsToSelect',accountsToSelect)
  // console.log('accountsListInfo', accountsListInfo, )
  //------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  //extend the type of input data with user id
  type PayloadType = BasicTrackerMovementInputDataType & { user: string };

  //DATA POST FETCHING
  const { data, isLoading, error, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });

//----------------------------------------
  // //Handle states related to the data submit form
  // useEffect(() => {
  //   let timer: ReturnType<typeof setTimeout>;

  //   if ((data || error) && !isLoading) {
  //     const success = data && !error;
  //     setMessageToUser(
  //       success
  //         ? 'Movement completed successfully!'
  //         : error ?? 'An error occurred during submission'
  //     );
  //     setShowMessage(true);

  //     timer = setTimeout(() => {
  //       setMessageToUser(null);
  //       setShowMessage(false);
  //     }, 8000);
  //   }

  //   return () => clearTimeout(timer);
  // }, [data, error, isLoading]);

  //----functions--------
  const updateDataCurrency = useCallback((currency: CurrencyType) => {
    setCurrency(currency);
    setFormInputData((prev) => ({ ...prev, currency: currency }));
  }, []);
  //----------------
  //updateTrackerData just updates data entered from input or textarea form
  function updateTrackerData(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    e.preventDefault();
    const { name, value } = e.target;
    //---------------
    if (name === 'amount') {
      const { formatMessage, 
       // valueNumber,
       isError, valueToSave } =
        checkNumberFormatValue(value);

      // Update numeric state value / Actualizar el estado numerico en el formulario
      setFormNumberData({
        ...formNumberData,
        [name]: value,
      });
     // console.log({ formatMessage, valueNumber, isError, valueToSave });

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

      setFormInputData((prev) => ({ ...prev, [name]: valueToSave }));

      console.log('on save', {[name]: valueToSave})

      return;
    } else {
      setFormInputData((prev) => ({ ...prev, [name]: value }));
    }
    // setFormInputData((prev) => ({ ...prev, accountType: }));
  }
  //------------------------
  const toggleTransactionType = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setTransactionType((prev: TransactionType) =>
        prev === 'deposit' ? 'withdraw' : 'deposit'
      );
    },
    []
    // [transactionType]
  );
  //--
  function changeDate(selectedDate: Date): void {
    setFormInputData((prev) => ({ ...prev, date: selectedDate }));
  }
 
  //---------------------------------------
  async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('On Save Handler');
    e.preventDefault();

  //-------------------------
    // const formattedNumber = numberFormat(datatrack.amount || 0);
    // console.log(
    //   'formatted amount as a string:',
    //   { formattedNumber },
    //   typeof formattedNumber
    // );
    //---entered datatrack validation messages -------
    //validation of entered data
    const newValidationMessages = { ...validationData(formInputData) };
    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      console.log("🚀 ~ onSaveHandler ~ newValidationMessages:", newValidationMessages)
      return;
    }
    //----------------------------
    //POST ENDPOINT FOR MOVEMENT TRANSACTION HERE
    console.log('data state to Post:', formInputData);
    //----------------------------
    //send post data to backend to update the balance account of bank or investment account and the counter account called slack in: user_accounts table.

    //record both transaction descriptions: transfer and receive transactions with the correspondent account info.

    //endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=pnl

    try {
      const payload: PayloadType = {
        ...formInputData,
        user,
      };
      const postUrl = `${url_movement_transaction_record}/?movement=${typeMovement}`;
      
      const data = await requestFn(payload, {
        url: postUrl,
      } as AxiosRequestConfig);

      if (import.meta.env.VITE_ENVIRONMENT === 'development') {
        console.log('Data from record transaction request:', data);
      }

      //resetting values--------------------
      setReloadTrigger(prev=>prev+1)
      setCurrency(defaultCurrency);
      setIsReset(true);
      setFormInputData(initialData);

      setTransactionType('deposit');
      updateDataCurrency(defaultCurrency);
      setValidationMessages({});
      setFormNumberData(initialFormNumberData);
      // after a delay, change isReset to false
      setTimeout(() => {
        setIsReset(false);
      }, 100);
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
            setMessageToUser('Error processing transaction');
      setShowMessage(true);
    }
  }
  //---------------------------------------
  //-------Top Card elements--
  const topCardElements:TopCardElementsType = {
    titles: { title1: 'amount', title2: 'account' },
    value: formNumberData.amount,
    selectOptions: optionsAccountsToSelect,
    accountsListInfo
      };
 //----------------------------------------
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

  //-----useEffect----------
  useEffect(() => {
    updateDataCurrency(currency);
    setFormInputData((prev) => ({ ...prev, type: transactionType }));
  }, [currency, transactionType, updateDataCurrency]);
  //------------------------

  //------------------------
  return (
    <>
      <form className='trackerFormAccount'
       style={{ color: 'inherit' }}>

        {/* TOP CARD START */}
        <TopCardPnL
          topCardElements={topCardElements}
          validationMessages={validationMessages}
          updateTrackerData={updateTrackerData}
          trackerName={trackerState}
          currency={currency}
          updateCurrency={updateDataCurrency}
          setSelectState={setFormInputData}
          isReset={isReset}
          setIsReset={setIsReset}

          // selectedValue={formInputData.account}
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
                <div className='screen--concept'>{transactionType}</div>
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
          {/*  */}
          <CardNoteSave
            title={'note'}
            validationMessages={validationMessages}
            dataHandler={updateTrackerData}
            inputNote={formInputData.note}
            onSaveHandler={onSaveHandler}
            isDisabled={isLoading}
          />
        </div>
      </form>

      <MessageToUser
        isLoading={isLoading || isLoadingAccountDataApiResponse}
        //probar que muestra como error o si muestra algo
        error={error || fetchedErrorAccountDataApiResponse}
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
export default PnL;
