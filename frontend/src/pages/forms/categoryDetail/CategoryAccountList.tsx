import { Link, useLocation, useParams } from 'react-router-dom';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
import { CardTitle } from '../../../general_components/CardTitle.tsx';

import { url_get_accounts_by_category,  USER_ID } from '../../../endpoints.ts';
import { CategoryBudgetAccountsResponseType } from '../../../types/responseApiTypes.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';
import { CurrencyType } from '../../../types/types.ts';
import { capitalize } from '../../../helpers/functions.ts';
import SummaryDetailBox from './summaryDetailBox/SummaryDetailBox.tsx';
import ListAccountOfCategory from './ListAccountOfCategory.tsx';
//====================================
function CategoryAccountList() {

const location = useLocation()
//check location state data from ListCategory
const {
  pathname:categoryAccountListPageAddress,
  state:{categorySummaryDetailed},
  state:{previousRoute:budgetPageAddress}}=location
 //params 
 const {categoryName} =useParams()

//  console.log('category',categoryName)
// console.log('location', location)

// console.log("🚀 ~ CategoryAccountList ~ location:",
//   //location,
//   //  categorySummaryDetailed,
//   //  budgetPageAddress,
//   categoryAccountListPageAddress
// )
// //-----------

//--Fetch Data to get accounts info associated to categoryName
const urlAccountsByCategoryName =`${url_get_accounts_by_category}/${categoryName}?&user=${USER_ID}` 
   const {
      apiData,
      // isLoading,
      // error,
    } = useFetch<CategoryBudgetAccountsResponseType>(
      urlAccountsByCategoryName
    );

    //console.log('cuentas', apiData, isLoading, error, apiData?.data.accountList)

    const categoryAccountsExists = apiData &&apiData.data.accountList.length>0

   const categoryAccounts = categoryAccountsExists? apiData?.data.accountList : []
   //console.log("🚀 ~ CategoryAccountList ~ categoryAccounts:", categoryAccounts)
//===========================
// --Category detailed summary info
  function calculateCategorySummaryInfo (currency_code:CurrencyType='usd'){
    const categorySummaryInfo ={total_balance:0,
      category_name:categoryName,currency_code:currency_code,
      total_budget:0,total_remaining:0,statusAlert:false,
    remain:0,
    };

  for (let i=0;i<categoryAccounts.length;i++){
    categorySummaryInfo.total_balance +=Number(categoryAccounts[i].account_balance)
    ;

    categorySummaryInfo.total_budget += +(categoryAccounts[i].budget);
    }    

    categorySummaryInfo.remain=Math.round(-categorySummaryInfo.total_balance + categorySummaryInfo.total_budget);
  
    categorySummaryInfo.remain=Math.round(-categorySummaryInfo.total_balance + categorySummaryInfo.total_budget);

    categorySummaryInfo.statusAlert=categorySummaryInfo.remain<=0;

    categorySummaryInfo.category_name;

    return categorySummaryInfo
  }

//here currency code is assumed to be the same for every account, not multicurrencies
const categorySummaryInfo= categorySummaryDetailed ?? {...calculateCategorySummaryInfo(categoryAccounts[0].currency_code??'usd'), };

 //console.log("🚀 ~ CategoryAccountList ~ categorySummaryInfo:", categorySummaryInfo,categoryAccounts);

//summary data
  const summaryData = {
    title: 'Budget',

    amount: Number(categorySummaryInfo.total_budget),

    subtitle1: 'Spent',

    amount1:+categorySummaryInfo.total_balance,

    status: categorySummaryInfo.statusAlert as boolean,

    amount2:(+categorySummaryInfo.remain),

    currency_code: categorySummaryInfo.currency_code,
   
  };
//===============================
  return (
    <>
      <section className='page__container'>
        <TopWhiteSpace variant={'dark'} />
        <div className='page__content'>
          <div className='main__title--container'>

            <Link to={budgetPageAddress}
            relative='path' className='iconLeftArrow'>
              <LeftArrowLightSvg />
            </Link>
            
            <div className='form__title'>{capitalize(categoryName!)}</div>
            {/* <div className='form__title'>{categoryInfo.name}</div> */}
            <Link to='edit' className='flx-col-center icon3dots'>
              <Dots3LightSvg />
            </Link>
          </div>
        </div>

        <SummaryDetailBox bubleInfo={summaryData}></SummaryDetailBox>
  
        <CardTitle>{`${capitalize(categoryName!)} Accounts`}</CardTitle>  

        <ListAccountOfCategory previousRoute={categoryAccountListPageAddress}
        accounts={categoryAccounts}
  /> 
      </section>
    </>
  );
}

export default CategoryAccountList;
