//src/pages/tracker/expense/Transfer.tsx
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
  MovementInputDataType,
  VariantType,
} from '../../../types/types.ts';
import {
  url_get_accounts_by_type,
  url_get_total_account_balance_by_type,
  url_movement_transaction_record,
} from '../../../endpoints.ts';
import {
  ACCOUNT_OPTIONS_DEFAULT,
  INVESTMENT_ACCOUNT_OPTIONS_DEFAULT,
  DEFAULT_CURRENCY,
  PAGE_LOC_NUM,
  // CURRENCY_OPTIONS,
} from '../../../helpers/constants.ts';
import TopCard from '../components/TopCard.tsx';
import CardNoteSave from '../components/CardNoteSave.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';
import {
  AccountByTypeResponseType,
  AccountListType,
  BalanceBankRespType,
  MovementTransactionResponseType,
} from '../../../types/responseApiTypes.ts';
import { useFetchLoad } from '../../../hooks/useFetchLoad.tsx';
import { MessageToUser } from '../../../general_components/messageToUser/MessageToUser.tsx';
import axios, { AxiosRequestConfig } from 'axios';
import useBalanceStore from '../../../stores/useBalanceStore.ts';
import RadioInput from '../../../general_components/radioInput/RadioInput.tsx';

// import { useAuthStore } from '../../../auth/stores/useAuthStore.ts';
// import SpinLoader from '../../../loader/spin/SpinLoader.tsx';

//-----temporarily data 'till decide how to handle currencies
const defaultCurrency = DEFAULT_CURRENCY;
// const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
// console.log('', { formatNumberCountry });
// ********************
//type configuration
//, InvestmentInputDataType,
// ********************
const initialMovementData: MovementInputDataType = {
  amount: 0,
  origin: '',
  destination: '',

  originAccountId: -1000,
  destinationAccountId: -1000,

  note: '',
  currency: defaultCurrency,
  originAccountType: 'bank',
  destinationAccountType: 'investment',
};

const VARIANT_DEFAULT: VariantType = 'tracker';
//------------------------------
const initialFormData: FormNumberInputType = {
  amount: '',
};
//-------------------------------------
//--Transfer Tracker Movement between accounts
//-- account types allowed: investment, bank, pocket_saving accounts   -------
function Transfer(): JSX.Element {
  //rules: only investment, bank, pocket_saving  are used
  //select option accounts rendered are all existing bank accounts, but the slack account which is not shown
  const router = useLocation();
  const trackerState = router.pathname.split('/')[PAGE_LOC_NUM];

  const typeMovement = trackerState.toLowerCase();
  // console.log('movement:', typeMovement);
  //------------------------------------------------
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
  //--RadioOption selection for account type
  // const [radioOptionSelected, setRadioOptionSelected] = useState('investment');

  const inputRadioOptions = [
    { value: 'bank', label: 'bank' },
    { value: 'investment', label: 'investment' },
    { value: 'pocket', label: 'pocket' },
  ];
  //-----------------------------------------------------
  //---states-------------
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [isReset, setIsReset] = useState<boolean>(false);

  const [validationMessages, setValidationMessages] = useState<{
    [key: string]: string;
  }>({});

  const [movementInputData, setMovementInputData] =
    useState<MovementInputDataType>(initialMovementData);

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
  //--------------------------------------------
  //--set states for account types selected and default values

  // const [originAccountType, setOriginAccountType] = useState<string>('pocket');

  const [isResetOriginAccount, setIsResetOriginAccount] =
    useState<boolean>(true);
  const [isResetDestinationAccount, setIsResetDestinationAccount] =
    useState<boolean>(true);

  // const [destinationAccountType, setDestinationAccountType] =
  //   useState<string>('investment');
  //account type url get based on user existence
  //url_get_accounts_by_type

  const originAccTypeDb =
    movementInputData.originAccountType === 'pocket'
      ? 'pocket_saving'
      : movementInputData.originAccountType;

  const fetchOriginAccountUrl =
    user && originAccTypeDb
      ? `${url_get_accounts_by_type}/?type=${originAccTypeDb}&user=${user}`
      : // <Navigate to='/auth' />
        undefined;
  //-------------------------------
  //DATA FETCHING
  //GET: AVAILABLE ACCOUNTS OF TYPE BANK

  const {
    apiData: originAccountsResponse,
    isLoading: isLoadingOriginAccounts,
    error: fetchedErrorOriginAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchOriginAccountUrl as string);

  // console.log({
  //   originAccountsResponse,
  //   isLoadingOriginAccounts,
  //   fetchedErrorOriginAccounts,
  // });

  // console.log('🚀 ~ Transfer ~ originAccountsResponse:', originAccountsResponse);
  // console.log('BANK resp', originAccountsResponse, fetchedErrorOriginAccounts);

  const optionsOriginAccounts = useMemo(() => {
    if (fetchedErrorOriginAccounts) {
      return ACCOUNT_OPTIONS_DEFAULT;
    }

    const originAccountList = originAccountsResponse?.data?.accountList ?? [];

    console.log(
      '🚀 ~ optionsOriginAccounts ~ originAccountList:',
      originAccountList
    );

    return originAccountList.length
      ? originAccountList.map((acc) => ({
          value: acc.account_name,
          label: acc.account_name,
        }))
      : ACCOUNT_OPTIONS_DEFAULT;
  }, [originAccountsResponse?.data.accountList, fetchedErrorOriginAccounts]);
  //---------------------------------------------
  //filtering origin account list
  const filteredOriginOptions = useMemo(() => {
    if (!movementInputData.destinationAccountId) {
      return optionsOriginAccounts;
    }
    const originAccountList = originAccountsResponse?.data?.accountList ?? [];

    const filteredAccounts = originAccountList.length
      ? originAccountList.filter(
          (acc) => acc.account_id !== movementInputData.destinationAccountId
        )
      : originAccountList;

    //map to dropdown format without account_id
    return filteredAccounts.map((acc) => ({
      value: acc.account_name,
      label: acc.account_name,
    }));
  }, [
    movementInputData.destinationAccountId,
    originAccountsResponse?.data.accountList,
    optionsOriginAccounts,
  ]);

  //---------------------------------------------
  const originAccountOptionsToRender = {
    title: 'Available Accounts',
    options: filteredOriginOptions,
    variant: 'tracker' as VariantType,
  };

  //------------------------------------------------------
  //destination options
  //GET: ACCOUNTS OF TYPE DESTINATION AVAILABLE
  //DATA FETCHING
  const destinationAccTypeDb =
    movementInputData.destinationAccountType === 'pocket'
      ? 'pocket_saving'
      : movementInputData.destinationAccountType;

  const fetchDestinationAccountUrl =
    user && destinationAccTypeDb
      ? `${url_get_accounts_by_type}/?type=${destinationAccTypeDb}&user=${user}`
      : // <Navigate to='/auth' />
        undefined;

  // console.log(fetchOriginAccountUrl, fetchDestinationAccountUrl);

  const {
    apiData: destinationAccountsResponse,
    isLoading: isLoadingDestinationAccounts,
    error: fetchedErrorDestinationAccounts,
  } = useFetch<AccountByTypeResponseType>(fetchDestinationAccountUrl as string);

  // console.log('destinationAccountsResponse', {
  //   destinationAccountsResponse,
  //   isLoadingDestinationAccounts,
  //   fetchedErrorDestinationAccounts,
  // });

  // const optionsDestinationAccounts = INVESTMENT_ACCOUNT_OPTIONS_DEFAULT;

  const optionsDestinationAccounts = useMemo(() => {
    if (fetchedErrorDestinationAccounts) {
      return INVESTMENT_ACCOUNT_OPTIONS_DEFAULT;
    }

    const destinationAccountList =
      destinationAccountsResponse?.data?.accountList ?? [];

    console.log(
      '🚀 ~ optionsDestinationAccounts ~ destinationAccountList:',
      destinationAccountList
    );

    return destinationAccountList.length
      ? destinationAccountList.map((acc: AccountListType) => ({
          value: acc.account_name,
          label: acc.account_name,
        }))
      : INVESTMENT_ACCOUNT_OPTIONS_DEFAULT;
  }, [
    destinationAccountsResponse?.data.accountList,
    fetchedErrorDestinationAccounts,
  ]);

  //---------------------------------------------
  //filtering destination account list
  const fileteredDestinationOptions = useMemo(() => {
    if (!movementInputData.originAccountId) {
      return optionsDestinationAccounts;
    }

    //filtereing excluding origin account id
    const destinationAccountList =
      destinationAccountsResponse?.data.accountList ?? [];
    const filteredAccounts = destinationAccountList.filter(
      (acc) => acc.account_id !== movementInputData.originAccountId
    );

    if (filteredAccounts.length === 0) {
      return INVESTMENT_ACCOUNT_OPTIONS_DEFAULT;
    }

    //map to the dropdown format

    return filteredAccounts.map((acc) => ({
      value: acc.account_name,
      label: acc.account_name,
    }));
  });

  //---------------------------------------------
  const destinationAccountOptionsToRender = {
    title: optionsDestinationAccounts
      ? //  && !fetchedErrorDestinationAccounts
        'Accounts'
      : 'No accounts available',
    options: fileteredDestinationOptions,
    variant: VARIANT_DEFAULT as VariantType,
  };

  //------------------------------------------
  //OBTAIN THE REQUESTFN FROM userFetchLoad
  type PayloadType = MovementInputDataType & {
    user: string;
    // transaction_actual_date: string | Date;
  };
  //DATA POST FETCHING
  const { data, isLoading, error, requestFn } = useFetchLoad<
    MovementTransactionResponseType,
    PayloadType
  >({ url: url_movement_transaction_record, method: 'POST' });

  // //---states-------------
  // const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  // const [isReset, setIsReset] = useState<boolean>(false);

  // const [validationMessages, setValidationMessages] = useState<{
  //   [key: string]: string;
  // }>({});

  // const [movementInputData, setMovementInputData] =
  //   useState<MovementInputDataType>(initialMovementData);

  // const [formData, setFormData] = useState(initialFormData);

  // const [messageToUser, setMessageToUser] = useState<string | null | undefined>(
  //   null
  // );
  // //---
  // const [showMessage, setShowMessage] = useState(false);

  // //--------------------------------------------
  // const setAvailableBudget = useBalanceStore(
  //   (state) => state.setAvailableBudget
  // );

  // //---------------------------------------------
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
    setMovementInputData((prev) => ({ ...prev, currency: currency }));
  }

  //=========
  function updateTrackerData(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    e.preventDefault();
    const { name, value } = e.target;
    console.log('🚀 ~ Transfer ~ e.target:', e.target);

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
      setMovementInputData((prev) => ({ ...prev, [name]: valueToSave }));

      return;
    } else {
      setMovementInputData((prev) => ({ ...prev, [name]: value }));
    }
  }

  //--for DropdownSelection into TopCard
  function originAcountSelectHandler(
    selectedOption: DropdownOptionType | null
  ) {
    //get the account_id of the origin selected account_name

    const selectedAccount = originAccountsResponse?.data?.accountList.find(
      (acc) => acc.account_name === selectedOption?.value
    );

    //update the movementInputData state with name and id origin account

    setMovementInputData((prev) => ({
      ...prev,
      ['origin']: selectedOption?.value || '',
      originAccountId: selectedAccount?.account_id,
    }));

    console.log(
      'desde destinationAccountSelectHandler:',
      selectedOption,
      selectedOption?.value
    );
  }

  //--for DropdownSelection
  function destinationAccountSelectHandler(
    selectedOption: DropdownOptionType | null
  ) {
    // get the account_id of the selected account_name. it suppose account)name is unique too.

    const selectedAccount = destinationAccountsResponse?.data?.accountList.find(
      (acc) => acc.account_name === selectedOption?.value
    );

    setMovementInputData((prev) => ({
      ...prev,
      ['destination']: selectedOption?.value || '',
      destinationAccountId: selectedAccount?.account_id,
    }));

    console.log(
      'desde destinationAccountSelectHandler:',
      selectedOption,
      selectedOption?.value
    );
  }
  //-----
  //for RadioInput

  function handleOriginAccountTypeChange(newAccountType: string) {
    //reset selected values on movementInputData state
    setMovementInputData((prev) => ({
      ...prev,
      origin: '', //reset dropdown selected values
      originAccountType: newAccountType,
      // destination: '',
    }));

    //reset error messages
    setValidationMessages((prev) => ({
      ...prev,
      origin: '',
      originAccountType: '',
      // destination: '',
    }));

    //force reset dropdown selected value for origin
    // setIsReset(true); //
    setIsResetOriginAccount(false);
    setTimeout(() => setIsResetOriginAccount(true), 100);
  }
  //-----
  function handleDestinationAccountTypeChange(newAccountType: string) {
    // setOriginAccountType(newAccountType);
    //reset dropdown selected values
    setMovementInputData((prev) => ({
      ...prev,
      destination: '', //reset dropdown selected values
      destinationAccountType: newAccountType,
      // destination: '',
    }));

    //reset error messages
    setValidationMessages((prev) => ({
      ...prev,
      destination: '',
      destinationAccountType: '',
      // destination: '',
    }));

    //force reset dropdown selected value for destination
    setIsResetDestinationAccount(false);
    setTimeout(() => setIsResetDestinationAccount(true), 100);
  }
  //-----------------------------------------------

  async function onSaveHandler(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('On Save Handler');
    e.preventDefault();

    // const formattedNumber = numberFormat(movementInputData.amount || 0);
    // console.log(
    //   'Transfer formatted amount as a string:',
    //   { formattedNumber },
    //   typeof formattedNumber
    // );

    //----------------------------------------------
    //validation of entered data
    const newValidationMessages = validationData(movementInputData);
    console.log(
      '🚀 ~ onSaveHandler ~ newValidationMessages:',
      newValidationMessages
    );

    // if (Object.values(newValidationMessages).length > 0) {
    //   setValidationMessages(newValidationMessages);
    //   return;
    // }
    //-------------------------------------------------
    //-------------------------------------------------
    //POST ENDPOINT FOR MOVEMENT TRANSACTION HERE
    //update balance account of bank account and category budget account in: user_accounts table.
    //record both transaction descriptions: transfer and receive transactions with the correspondent account info.
    //endpoint ex: http://localhost:5000/api/fintrack/transaction/transfer-between-accounts/?movement=expense
    //user id is sent via req.body

    try {
      const payload: PayloadType = {
        ...movementInputData,
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
      setMovementInputData(initialMovementData);
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
  //-------Top Card elements --------------------------
  const topCardElements = {
    titles: { title1: 'amount', title2: ' Origin' }, //deben coincidir con el key de validation messages
    value: formData.amount,
    selectOptions: originAccountOptionsToRender,
  };

  console.log('validation messages', validationMessages);
  //-------------------------------------
  return (
    <>
      <form className='transfer' style={{ color: 'inherit' }}>
        {/* start of TOP CARD */}
        <TopCard
          topCardElements={topCardElements}
          validationMessages={validationMessages}
          updateTrackerData={updateTrackerData}
          trackerName={trackerState}
          currency={currency}
          updateCurrency={updateDataCurrency}
          setSelectState={setMovementInputData}
          isReset={isReset}
          setIsReset={setIsReset}
          //specific reset for dropdown (isResetOriginAccount)
          isResetDropdown={isResetOriginAccount}
          setIsResetDropdown={setIsResetOriginAccount}
          // selectedValue={movementInputData.account}
          //radio input prop

          radioInputProps={{
            radioOptionSelected:
              movementInputData.originAccountType ??
              initialMovementData.originAccountType!,
            inputRadioOptions,
            setRadioOptionSelected: handleOriginAccountTypeChange,
            title: '',
            // setRadioOptionSelected: setOriginAccountType,
          }}
          //---------
          customSelectHandler={originAcountSelectHandler}
        />

        {/* end of TOP CARD */}
        <CardSeparator />
        {/*start of BOTTOM CARD */}

        <div className='state__card--bottom'>
          <div className='account card--title card--title--top'>
            Destination
            <RadioInput
              radioOptionSelected={
                movementInputData.destinationAccountType ??
                initialMovementData.destinationAccountType!
              }
              inputRadioOptions={inputRadioOptions}
              setRadioOptionSelected={handleDestinationAccountTypeChange}
              title={''}
              labelId='destination'

              // disabled={radioInputProps.disabled}
            />
          </div>
          <div className='validation__errMsg'>
            {validationMessages['destination']}
          </div>
          <DropDownSelection
            dropDownOptions={destinationAccountOptionsToRender}
            updateOptionHandler={destinationAccountSelectHandler}
            isReset={isReset}
            setIsReset={setIsReset}
            setIsResetDropdown={setIsResetDestinationAccount}
            isResetDropdown={isResetDestinationAccount}
          />

          <CardNoteSave
            title={'note'}
            validationMessages={validationMessages}
            dataHandler={updateTrackerData}
            inputNote={movementInputData.note}
            onSaveHandler={onSaveHandler}
          />

          {/* end of BOTTOM CARD */}
        </div>
      </form>

      <MessageToUser
        isLoading={
          isLoading || isLoadingOriginAccounts || isLoadingDestinationAccounts
        }
        //probar que muestra como error o si muestra algo
        error={
          error || fetchedErrorOriginAccounts || fetchedErrorDestinationAccounts
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

export default Transfer;
