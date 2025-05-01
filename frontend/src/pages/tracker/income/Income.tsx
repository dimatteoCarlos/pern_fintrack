//src/pages/tracker/expense/Income.tsx
import { useState } from 'react';
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
  IncomeAccountsType,
  IncomeInputDataType,
  SourcesType,
  SourceType,
  TopCardSelectStateType,
  VariantType,
} from '../../../types/types.ts';
import { url_accounts, url_sources } from '../../../endpoints.ts';

import { useLocation } from 'react-router-dom';
import {
  DEFAULT_CURRENCY,
  CURRENCY_OPTIONS,
  SOURCE_OPTIONS_DEFAULT,
  INCOME_OPTIONS_DEFAULT,
  PAGE_LOC_NUM,
} from '../../../helpers/constants.ts';
import TopCard from '../components/TopCard.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';

//temporary values
const defaultCurrency: CurrencyType = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
console.log('🚀 ~ Debts ~ formatNumberCountry:', formatNumberCountry);
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
function Income() {
  //---- Income account Options ----------
  const { pathname } = useLocation();
  const trackerState = pathname.split('/')[PAGE_LOC_NUM];
  //income accounts
   //DATA FETCHING
  const {
    data,
    error: errorAccount,
    isLoading,
  } = useFetch<IncomeAccountsType>(url_accounts); //income and expense accounts are the same?
  // console.log('data:', data, {errorAccount}, data?.accounts)

  const optionsIncomeAccounts =
    data?.accounts?.length && !errorAccount && !isLoading
      ? data?.accounts?.map((acc) => ({
          value: acc.name,
          label: acc.name,
        }))
      : INCOME_OPTIONS_DEFAULT;
  const accountOptions = {
    title: 'Available Account',
    options: optionsIncomeAccounts,
    variant: VARIANT_DEFAULT,
  };
  //--------
  //income sources - are these sources attached to income accounts?
   //DATA FETCHING
  const {
    data: sources,
    error: errorSources,
    isLoading: loadingSources,
  } = useFetch<SourcesType>(url_sources);

  const sourceOptions = {
    title:
      sources && !loadingSources ? 'Source of income' : 'No Source available',
    options:
      !errorSources && sources?.sources
        ? sources?.sources?.map((src: SourceType) => ({
            value: src.name,
            label: src.name,
          }))
        : SOURCE_OPTIONS_DEFAULT,
    variant: VARIANT_DEFAULT as VariantType,
  };
  //---states------
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [incomeData, setIncomeData] =
    useState<TopCardSelectStateType>(initialIncomeData);

  const [formData, setFormData] = useState(initialFormData);
  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});
  const [isReset, setIsReset] = useState<boolean>(false);
  //----functions--------
  function updateDataCurrency(currency: CurrencyType) {
    setCurrency(currency);
    setIncomeData((prev) => ({ ...prev, currency: currency }));
    // console.log('updateDataCurrency:', currency);
  }

  function sourceSelectHandler(selectedOption: DropdownOptionType | null) {
    setIncomeData((prev: TopCardSelectStateType) => ({
      ...prev,
      ['source']: selectedOption!.value,
    }));
  }
  //-----------
  function updateTrackerData(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    e.preventDefault();
    const { name, value } = e.target;

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
      setIncomeData((prev) => ({ ...prev, [name]: valueToSave }));
      return;
    } else {
      setIncomeData((prev) => ({ ...prev, [name]: value }));
    }
  }
  //------------------------
  function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('On Save Handler');
    e.preventDefault();
    const formattedNumber = numberFormat(incomeData.amount || 0);
    console.log(
      'formatted amount as a string:',
      { formattedNumber },
      typeof formattedNumber
    );
    //validation of entered data
    const newValidationMessages = validationData(incomeData);
    if (Object.values(newValidationMessages).length > 0) {
      setValidationMessages(newValidationMessages);
      return;
    }
    //------------------------
    //POST ENDPOINT HERE
    console.log('Income data state to Post:', incomeData);
    //------------------------
    //reset values after posting the info   -- This could be a function -- need to set initial parameters for all 4 tracker/states in just one function./it seems that all are the same
    setCurrency(defaultCurrency);
    setIncomeData(initialIncomeData);

    setIsReset(true);
    setValidationMessages({});
    setFormData(initialFormData);

    setTimeout(() => {
      setIsReset(false);
    }, 500);
  }

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
          // selectedValue={incomeData.account}
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
    </>
  );
}
export default Income;
