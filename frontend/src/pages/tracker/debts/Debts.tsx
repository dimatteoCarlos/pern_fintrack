//pages/tracker/debts/debts.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import CardSeparator from '../components/CardSeparator.tsx';
import { capitalize, validationData } from '../../../helpers/functions.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';
import {
  url_get_accounts_by_type,
  url_movement_transaction_record,
} from '../../../endpoints.ts';
import { useLocation } from 'react-router-dom';
import Datepicker from '../../../general_components/datepicker/Datepicker.tsx';
import {
  CurrencyType,
  DebtorsListType,
  DebtsTrackerInputDataType,
  DebtsTypeMovementType,
  FormNumberInputType,
  TopCardSelectStateType,
  VariantType,
} from '../../../types/types.ts';
import { numberFormat } from '../../../helpers/functions.ts';
import {
  CURRENCY_OPTIONS,
  DEBTOR_OPTIONS_DEFAULT,
  DEFAULT_CURRENCY,
  PAGE_LOC_NUM,
} from '../../../helpers/constants.ts';
import TopCard from '../components/TopCard.tsx';
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import {
  AccountByTypeResponseType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.tsx';
import useBalanceStore from '../../../stores/useBalanceStore.ts';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';

const VARIANT_DEFAULT: VariantType = 'tracker';
//temporary values
const defaultCurrency: CurrencyType = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
// console.log('🚀 ~ Debts ~ formatNumberCountry:', formatNumberCountry);

//input debts datatracked variables
const initialTrackerData: DebtsTrackerInputDataType = {
  amount: 0,
  debtor: '',
  currency: defaultCurrency,
  type: 'lend',
  date: new Date(),
  note: '',
};

const initialFormData: FormNumberInputType = {
  amount: '',
};

//-----------------------------------
function Debts(): JSX.Element {
  //----Debt Tracker Movement -------
  //oberv:no counterpart account is known. lend is deposit/borrow is withdraw
  const trackerState = useLocation().pathname.split('/')[PAGE_LOC_NUM];

  const typeMovement = trackerState.toLowerCase();
  console.log('movement:', typeMovement);

  //deal here with user id and authentication
  const user = import.meta.env.VITE_USER_ID;

  //----Debtors Options----------
  //debtors
  //DATA FETCHING
  const fetchUrl = user
    ? `${url_get_accounts_by_type}/?type=debtor&user=${user}`
    : //<Navigate to = '/auth'/>
      undefined; //this forces to user req err

  const {
    apiData: DebtorsResponse,
    error: fetchedError,
    isLoading: isLoadingDebtor,
  } = useFetch<AccountByTypeResponseType>(fetchUrl as string);

  //apply debounce
  // console.log('debtors datatrack:', DebtorsResponse);
  //define what to do when error
  const debtors = useMemo(
    () =>
      !fetchedError &&
      !isLoadingDebtor &&
      DebtorsResponse?.data.accountList.length
        ? DebtorsResponse.data.accountList.map((debtor) => ({
            value: `${debtor.account_name}`,
            label: debtor.account_name,
          }))
        : // ? DebtorsResponse?.data.accountList.map((debtor) => ({
          //     value: `${capitalize(debtor.account_name)}` ,
          //     label: `${capitalize(debtor.account_name)}`,
          //   }))
          DEBTOR_OPTIONS_DEFAULT,
    [DebtorsResponse?.data.accountList, fetchedError, isLoadingDebtor]
  );

  const debtorOptions = {
    title: debtors ? 'Debtors' : 'No info. available',
    options: debtors,
    variant: VARIANT_DEFAULT as VariantType,
  };

  //---------------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  //extend the type of input data with user id
  type PayloadType = DebtsTrackerInputDataType & { user: string };

  //DATA POST FETCHING
  const { data, isLoading, error, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });

  //---states--------
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [type, setType] = useState<DebtsTypeMovementType>('lend');

  const [datatrack, setDataTrack] = useState<
    DebtsTrackerInputDataType | TopCardSelectStateType
  >(initialTrackerData);

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [isReset, setIsReset] = useState<boolean>(false);

  const [formData, setFormData] =
    useState<FormNumberInputType>(initialFormData);
  const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
    null
  );
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
  //----Functions ------
  const { inputNumberHandlerFn } = useInputNumberHandler(
    setFormData,
    setValidationMessages,
    setDataTrack
  );

  function updateTrackerData(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    e.preventDefault();
    const { name, value } = e.target;
    if (name === 'amount') {
      inputNumberHandlerFn(name, value);
    } else {
      setDataTrack((prev) => ({ ...prev, [name]: value }));
    }
  }
  //---
  const updateDataCurrency = useCallback(
    (currency: CurrencyType) => {
      setCurrency(currency);
      setDataTrack((prev) => ({ ...prev, currency: currency }));
    },
    []
    // [currency]
  );
  //---
  const toggleType = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setType((prev: DebtsTypeMovementType) =>
        prev === 'lend' ? 'borrow' : 'lend'
      );
    },
    []
    // [type]
  );

  function changeDateFn(selectedDate: Date): void {
    setDataTrack((prev) => ({ ...prev, date: selectedDate }));
  }

  function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('On Save Handler');
    e.preventDefault();

    // const formattedNumber = numberFormat(datatrack.amount || 0);
    // console.log(
    //   'formatted amount as a string:',
    //   { formattedNumber },
    //   typeof formattedNumber
    // );
    //-------entered datatrack validation messages --------
    const newValidationMessages = validationData(datatrack);
    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //----------------------------
    //do the post to the endpoint api
    //ENDPOINT HERE FOR POSTING

    //----------------------------
    //reset values

    setIsReset(true);
    setDataTrack({
      ...initialTrackerData,
      date: new Date(),
      currency: defaultCurrency,
    });
    setValidationMessages({});
    setType('lend');
    updateDataCurrency(defaultCurrency);
    setFormData(initialFormData);
    setTimeout(() => {
      setIsReset(false);
    }, 500);
  }

  //-----useEffect--------
  useEffect(() => {
    updateDataCurrency(currency);
    setDataTrack((prev) => ({ ...prev, currency: currency }));
    setDataTrack((prev) => ({ ...prev, type: type }));
  }, [currency, type, updateDataCurrency]);

  //--------------------------
  //-------Top Card elements
  const topCardElements = {
    titles: { title1: 'amount', title2: 'debtor' },
    value: formData.amount,
    selectOptions: debtorOptions,
  };

  return (
    <>
      <form className='debts' style={{ color: 'inherit' }}>
        {/* TOP CARD */}
        <TopCard
          topCardElements={topCardElements}
          validationMessages={validationMessages}
          updateTrackerData={updateTrackerData}
          trackerName={trackerState}
          currency={currency}
          updateCurrency={updateDataCurrency}
          // selectedValue={datatrack.debtor}
          setSelectState={setDataTrack}
          isReset={isReset}
          setIsReset={setIsReset}
        />

        <CardSeparator />

        {/* BOTTOM CARD */}
        <div className='state__card--bottom'>
          <div className='card__typeDate__container'>
            <div className='card__typeDate--type'>
              <div className='card--title'>Type</div>
              <button className='card__screen--type' onClick={toggleType}>
                <div className='screen--concept'>{type}</div>
              </button>
            </div>

            <div className='card__typeDate--date'>
              <div className='card--title'>Date</div>
              <div className='card__screen--date'>
                <Datepicker
                  changeDate={changeDateFn}
                  date={datatrack.date ?? new Date()}
                  variant='tracker'
                  isReset={isReset}
                ></Datepicker>
              </div>
            </div>
          </div>
          <CardNoteSave
            title={'note'}
            validationMessages={validationMessages}
            dataHandler={updateTrackerData}
            inputNote={datatrack.note}
            onSaveHandler={onSaveHandler}
          />
        </div>
      </form>

      <MessageToUser
        isLoading={isLoading || isLoadingDebtor}
        //probar que muestra como error o si muestra algo
        error={error || fetchedError}
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

export default Debts;
