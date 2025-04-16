//pages/tracker/debts/debts.tsx
import { useCallback, useEffect, useState } from 'react';
import CardSeparator from '../components/CardSeparator.tsx';
import { capitalize, validationData } from '../../../helpers/functions.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';
import { url_debtors } from '../../../endpoints.ts';
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
} from '../../../helpers/constants.ts';
import TopCard from '../components/TopCard.tsx';
import useInputNumberHandler from '../../../hooks/useInputNumberHandler.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';

//temporary values
const defaultCurrency: CurrencyType = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
console.log('🚀 ~ Debts ~ formatNumberCountry:', formatNumberCountry);

//input debts datatracked variables
const initialTrackerData: DebtsTrackerInputDataType = {
  amount: 0,
  debtor: '',
  currency: defaultCurrency,
  type: 'lend',
  date: new Date(),
  note: '',
};

function Debts() {
  const trackerState = useLocation().pathname.split('/')[2];
  //----Debtors Options----------
  //debtors
   //DATA FETCHING
  const {
    data: dataDebtors,
    error: fetchedError,
    isLoading,
  } = useFetch<DebtorsListType>(url_debtors); //apply deboune
  // console.log('debtors datatrack:', dataDebtors);
  //define what to do when error
  const debtors =
    !fetchedError && !isLoading && dataDebtors?.debtors?.length
      ? dataDebtors?.debtors?.map((debtor) => ({
          value: debtor.first_name + debtor.last_name,
          label: `${capitalize(debtor.first_name)}, ${capitalize(
            debtor.last_name
          )}`,
        }))
      : DEBTOR_OPTIONS_DEFAULT;

  const debtorOptions = {
    title: debtors ? 'Debtors' : 'No info. available',
    options: debtors,
    variant: 'tracker' as VariantType,
  };
  //-----------------
  const initialFormData: FormNumberInputType = {
    amount: '',
  };
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
    const formattedNumber = numberFormat(datatrack.amount || 0);
    console.log(
      'formatted amount as a string:',
      { formattedNumber },
      typeof formattedNumber
    );
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
    </>
  );
}

export default Debts;
