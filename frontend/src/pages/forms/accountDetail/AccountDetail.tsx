import { Link, useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
import { CardTitle } from '../../../general_components/CardTitle';
import CurrencyBadge from '../../../general_components/currencyBadge/CurrencyBadge';
 
import {
  ACCOUNT_DEFAULT,
  DEFAULT_CURRENCY,
  // DEFAULT_LAST_MOVEMENTS,
  VARIANT_FORM,
} from '../../../helpers/constants';
import { capitalize, formatDate, numberFormatCurrency,  } from '../../../helpers/functions';
// import ListContent from '../../../general_components/listContent/ListContent';
// import FormDatepicker from '../../../general_components/datepicker/Datepicker';
// import { StatusSquare } from '../../../components/boxComponents.tsx';
// import SummaryDetailBox from '../../../components/summaryDetailBox/SummaryDetailBox.tsx';
// import PlusSignSvg from '../../../assets/PlusSignSvg.svg';
// import FormSubmitBtn from '../../../general_components/formSubmitBtn/FormSubmitBtn';
import '../styles/forms-styles.css';
import { AccountListType } from '../../../types/responseApiTypes';

// import { url_get_accounts_by_type } from '../../../endpoints';
// import { useFetch } from '../../../hooks/useFetch';
// import { AccountByTypeResponseType, AccountListType  } from '../../../types/responseApiTypes';

//  const user = import.meta.env.VITE_USER_ID;
type LocationStateType ={
previousRoute:string; detailedData:AccountListType;
}
//temporary datas
const initialAccountDetail = ACCOUNT_DEFAULT[0]

//Last Movements
// const initialLastMovements = DEFAULT_LAST_MOVEMENTS;
//---------------
function AccountDetail() {

  const location = useLocation()
  const {id} = useParams()
  console.log('location', location, id)
  //data from endpoint request for info account, and for last movements
  //Define the endpoint to get the Last movements and calculate the accountInfo required. set the logic, so as lastMovement be null set it to default
  //--states
  const [accountDetail, setAccountDetail] = useState<AccountListType>(initialAccountDetail);

   const [previousRoute, setPreviousRoute] = useState<string>("/"); 
  //  const [previousRoute, setPreviousRoute] = useState<string>("/fintrack/overview"); 

//este no es el url el endopoint debe ser busdcar por account_id
//  const urlBankAccounts = `${url_get_accounts_by_type}/?type=bank&user=${user}`;

    // const {
    //   apiData: bankAccountsData,
    //   isLoading,
    //   error,
    // } = useFetch<AccountByTypeResponseType>(
    //   location.state?.detailedData?urlBankAccounts
    //   :
    //   ''
    // );
  //--functions---
  // function onSubmitForm(e: React.MouseEvent<HTMLButtonElement>) {
  //   console.log('submit btn clicked');
  //   e.preventDefault();
  //   setAccountDetail(initialAccountDetail);
  // }

  // function updateCurrency(currency: string) {
  //   setAccountDetail((prevState) => ({
  //     ...prevState,
  //     accountInfo: { ...accountInfo, currency },
  //   }));
  // }

  // function inputLastMovementHandler(e: React.ChangeEvent<HTMLInputElement>) {
  //   e.preventDefault();
  //   console.log(accountDetail);
  //   setAccountDetail((prevState) => ({
  //     ...prevState,
  //     lastMovements: { ...lastMovements, [e.target.name]: e.target.value },
  //   }));
  // }

  // function changeStartingPoint(selectedDate: Date) {
  //   setAccountDetail((prevState) => ({
  //     ...prevState,
  //     accountInfo: { ...accountInfo, date: selectedDate },
  //   }));
  // }
//----------------------------------
useEffect(()=>{
const {previousRoute, detailedData} =location.state as LocationStateType
if(detailedData){
setAccountDetail(detailedData)
if(previousRoute){setPreviousRoute(previousRoute)}
}
return ()=>{

}
},[location.state, id])

// useEffect(() => {
// const {}=bankAccountsData.data?.accountList

  // if(bankAccountsData){setAccountDetail(bankAccountsData.data.accountList)}

  // return () => {
    
  // }
// }, [bankAccountsData])


//==============================================
  return (
    <section className='page__container'>
      <TopWhiteSpace variant={'dark'} />
      <div className='page__content'>
        <div className='main__title--container'>
          <Link to={previousRoute} relative='path' className='iconLeftArrow'>
            <LeftArrowLightSvg />
          </Link>
          <div className='form__title'>{capitalize(accountDetail?.account_name).toUpperCase()}</div>
          <Link to='edit' className='flx-col-center icon3dots'>
            <Dots3LightSvg />
          </Link>
        </div>

        <form className='form__box'>
          <div className='form__container'>
            <div className='input__box'>
              <div className='label form__title'>{`Current Balance`}</div>

              <div className='input__container' style={{ padding: '0.5rem' }}>
                {numberFormatCurrency(accountDetail?.account_balance)}
              </div>
            </div>

            <div className='input__box'>
              <label className='label form__title'>{'Account Type'}</label>

              <p className='input__container' style={{ padding: '0.5rem' }}>
                {capitalize(accountDetail.account_type_name!.toLocaleString())}
              </p>
            </div>

            <div className='account__dateAndCurrency'>
              <div className='account__date'>
                <label className='label form__title'>{'Starting Point'}</label>
                <div
                  className='form__datepicker__container'
                  style={{ textAlign: 'center', color:'white' }}
                >
                  {formatDate(new Date(accountDetail.account_start_date ))}
                  {/* {showDate(new Date(accountDetail.account_start_date ))} */}
                  {/* <FormDatepicker
                    variant={VARIANT_FORM}
                    changeDate={changeStartingPoint}
                    date={accountDetail.accountInfo.date}
                  /> */}
                </div>
              </div>

              <div className='account__currency'>
                <div className='label form__title'>{'Currency'}</div>

                <CurrencyBadge
                  variant={VARIANT_FORM}
                  currency={accountDetail.currency_code??DEFAULT_CURRENCY}
                  // updateOutsideCurrencyData={updateCurrency}
                  // apparently there's a currency datum associated to each account
                />
              </div>
            </div>
          </div>

          <div className='presentation__card__title__container'>
            <CardTitle>{'Last Movements'}</CardTitle>
          </div>

          {/* <ListContent listOfItems={lastMovements} /> */}

          {/* <div className='submit__btn__container'>
            <FormSubmitBtn onClickHandler={onSubmitForm}>save</FormSubmitBtn>
          </div> */}
        </form>
      </div>
    </section>
  );
}

export default AccountDetail;
