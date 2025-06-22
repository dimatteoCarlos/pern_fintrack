import { Link, useLocation, useParams } from 'react-router-dom';
import { useState } from 'react';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
import ListContent from '../../../general_components/listContent/ListContent.tsx';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn.tsx';
import DropDownSelection from '../../../general_components/dropdownSelection/DropDownSelection.tsx';

import SummaryDetailBox from '../../../general_components/summaryDetailBox/SummaryDetailBox.tsx';
import PlusSignSvg from '../../../assets/PlusSignSvg.svg';

// import { StatusSquare } from '../../../general_components/boxComponents.tsx';
import '../styles/forms-styles.css';
import {
  DEFAULT_LAST_MOVEMENTS,
  VARIANT_FORM,
} from '../../../helpers/constants.ts';
import { AccountByTypeResponseType, DebtorListType } from '../../../types/responseApiTypes.ts';
import { url_get_account_by_id, url_get_debtor_by_id } from '../../../endpoints.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';
//
const user = import.meta.env.VITE_USER_ID;

type LocationStateType ={
previousRoute:string; detailedData:DebtorListType;
}
const initialAccountDetail:DebtorListType = {
  account_name: 'Lastname, name example',
  account_id:1000, //| null;
  currency_code: 'usd',
  total_debt_balance: 10, //| null;
  debt_receivable: 10, //| null;
  debt_payable: 0,
  debtor: 1, //1/0
  creditor: 0, //1/0
  };

function DebtorDetail() {
const location = useLocation() 
  const state = location.state as LocationStateType | null;
  const detailedData = state?.detailedData;
  const previousRouteFromState = state?.previousRoute ?? "/";
  const {accountId} = useParams()
  console.log('location',  accountId, detailedData)

 //--states
  //--state for account detail global info
     const [accountDetail, setAccountDetail] = useState<DebtorListType>(initialAccountDetail);
     const [previousRoute, setPreviousRoute] = useState<string>("/fintrack/debts/debtors"); 
     //--state for account transactions data
        //  const [transactions, setTransactions]=useState<AccountTransactionType[]>(initialAccountTransactionsData.transactions)
     
        //  const [summaryAccountBalance, setSummaryAccountBalance]=useState<AccountSummaryBalanceType>(initialAccountTransactionsData.summary)
     
//-------------------------------------
    //--Fetch Data
    //--account detail global info
  const urlAccountById = `${url_get_account_by_id}/${accountId}?&user=${user}`;
    const {
      apiData: accountsData,
      isLoading,
      error,
    } = useFetch<AccountByTypeResponseType>(
      detailedData?"":urlAccountById
    );
 //--how to handle dates period

  const debtorInfo = {
    debtor_name: 'Name, Lastname ',
    debtor_id: 1,
    total_amount_borrowed: 100,
    total_amount_lent: 90,
    net_amount: -10,
    type: 'lender',
  };

  //summary data
  const summaryData = {
    title: 'amount',
    amount: 2222.11,
    subtitle1: '',
    subtitle2: 'type', //lender or debtor
  };

  //Account Options
  const accountSelectionProp = {
    title: 'account',
    options: [
      { value: 'account_01', label: 'Account_01' },
      { value: 'account_02', label: 'Account_02' },
      { value: 'account_03', label: 'Account_03' },
    ],
    variant: VARIANT_FORM, //define the custom styles to use in selection dropdown component
  };

  // const transactionType =
  //   -total_amount_borrowed + total_amount_lent < 0
  //     ? 'lender'
  //     : 'debtor';

  //Last Movements
  const lastMovements = DEFAULT_LAST_MOVEMENTS;

  const initialDebtorDetail = {
    debtorInfo,
    lastMovements,
  };

  const [debtorDetail, setDebtorDetail] = useState(initialDebtorDetail);
  const [isReset, setIsReset] = useState<boolean>(false);

  //--functions---
  // function inputHandler(e: React.ChangeEvent<HTMLInputElement>) {
  //   e.preventDefault();
  //   setDebtorDetail((prevState) => ({
  //     ...prevState,
  //     debtorInfo: { ...debtorInfo, [e.target.name]: e.target.value },
  //   }));
  // }

  function addMoneyHandler(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    console.log('click on plus sign button');
  }

  function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
    console.log('submit btn clicked');
    e.preventDefault();
    setDebtorDetail(initialDebtorDetail);
  }

  function accountSelectHandler(
    selectedOption: {
      value:  string; //check any
      label: string;
    } | null
  ) {
    setDebtorDetail((prev) => ({
      ...prev,
      debtorInfo: { ...debtorInfo, account: selectedOption?.value },
    }));
    console.log('selectedOption', selectedOption);
  }

  return (
    <>
      <section className='page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div className='main__title--container '>
            <Link to='/debts' relative='path' className='iconLeftArrow'>
              <LeftArrowLightSvg />
            </Link>
            <div className='form__title'>
              {debtorDetail.debtorInfo.debtor_name}
            </div>
            <Link to='edit' className='flx-col-center icon3dots'>
              <Dots3LightSvg />
            </Link>
          </div>

          <SummaryDetailBox summaryData={summaryData}></SummaryDetailBox>

          <form className='form__box'>
            <div className='form__container'>
              <div className='input__box'>
                <label className='label form__title'>{'Add Money'}</label>

                <DropDownSelection
                  dropDownOptions={accountSelectionProp}
                  updateOptionHandler={accountSelectHandler}
                  isReset={isReset}
                  setIsReset={setIsReset}
                />

                <div className='inputAmountAndPlusSign '>
                  {/* <input
                    type='text'
                    className={`input__container input__container--amount`}
                    placeholder={`0,00`}
                    name={'amount'}
                    onChange={inputHandler}
                    value={debtorDetail.debtorInfo.net_amount}
                    style={{ fontSize: '1.25rem', padding: '0 0.75rem' }}
                  /> */}
                  <div
                    className={`input__container input__container--amount`}
                    style={{
                      fontSize: '1.25rem',
                      padding: '0 0.75rem',
                      width: '85%',
                    }}
                  >
                    {' '}
                    {debtorDetail.debtorInfo.net_amount}
                  </div>

                  {/* Do not know what this plus sign does */}
                  <button
                    className='flx-col-center iconPlusSign'
                    onClick={addMoneyHandler}
                  >
                    <PlusSignSvg />
                  </button>
                </div>
              </div>
            </div>

            <div className='presentation__card__title__container'>
              <CardTitle>{'Last Movements'}</CardTitle>
            </div>

            <ListContent listOfItems={lastMovements} />

            <div className='submit__btn__container'>
              <FormSubmitBtn onClickHandler={onSubmitForm}>save</FormSubmitBtn>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}

export default DebtorDetail;
