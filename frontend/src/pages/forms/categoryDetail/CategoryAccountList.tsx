//CategoryAccountList.tsx
import { Link, useLocation, useParams } from 'react-router-dom';
import TopWhiteSpace from '../../../general_components/topWhiteSpace/TopWhiteSpace.tsx';
import LeftArrowLightSvg from '../../../assets/LeftArrowSvg.svg';
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import { url_get_accounts_by_category,  USER_ID } from '../../../endpoints.ts';
import { CategoryBudgetAccountsResponseType } from '../../../types/responseApiTypes.ts';
import { useFetch } from '../../../hooks/useFetch.tsx';
import { CategorySummaryInfoType, CurrencyType } from '../../../types/types.ts';
import { capitalize } from '../../../helpers/functions.ts';
import SummaryDetailBox from './summaryDetailBox/SummaryDetailBox.tsx';
import ListAccountOfCategory from './ListAccountOfCategory.tsx';
import { useCallback, useEffect, useMemo, useState } from 'react';
//=================================
function CategoryAccountList() {
console.log('componente', 'CategoryAccountList')
//get the info from location state
const location = useLocation()
const {categoryName} =useParams()
console.log('category',categoryName)

//check location state data from ListCategory
// const {
//   pathname:categoryAccountListPageAddress,
//   state:{categorySummaryDetailed},
//   state:{previousRoute:budgetPageAddress}}=location

const state = location.state ?? {}

const {categorySummaryDetailed=null, previousRoute:budgetPageAddress = `/fintrack/budget`} = state as {
  categorySummaryDetailed?:CategorySummaryInfoType | null; previousRoute:string ;
}
// console.log('location', location)
// console.log("🚀 ~ CategoryAccountList ~ location:",
//   //location,
//   //  categorySummaryDetailed,
//   //  budgetPageAddress,
//   categoryAccountListPageAddress
// )
//--states-------------------------
const [categorySummaryInfo, setCategorySummaryInfo] = useState<CategorySummaryInfoType | null>(categorySummaryDetailed ?? null)

//--Fetch Data to get accounts info associated to categoryName
const urlAccountsByCategoryName =`${url_get_accounts_by_category}/${categoryName}?&user=${USER_ID}` 
   const {
      apiData,
      isLoading,
      error,
    } = useFetch<CategoryBudgetAccountsResponseType>(
      urlAccountsByCategoryName
    );

    const categoryAccountsExists = apiData && apiData.data.accountList.length>0

   const categoryAccounts =useMemo(() => {return categoryAccountsExists ? apiData?.data.accountList : [];}, [categoryAccountsExists,apiData])

  //console.log("🚀 ~ CategoryAccountList ~ categoryAccounts:", categoryAccounts)
  //=====================================
  //--functions
  //--build category summary info
const calculateCategorySummaryInfo=useCallback( (
  accounts :typeof categoryAccounts,
  categoryName:string,
  currency_code:CurrencyType = 'usd'
  )=>{
    const summary:CategorySummaryInfoType ={
    category_name:categoryName,currency_code:'usd',
    total_balance:0,
    total_budget:0,
    total_remaining:0,
    statusAlert:false,
    remain:0,
  };

  for (let i=0;i<accounts.length;i++){
    summary.total_balance +=Number(accounts[i].account_balance);
    summary.total_budget += +(accounts[i].budget);
    }    
  
    summary.remain=Math.round(-summary.total_balance + summary.total_budget);

    summary.statusAlert=summary.remain<=0;
    summary.currency_code=accounts[0].currency_code??currency_code as CurrencyType;
    summary.category_name = categoryName;

    return summary
  },[])

  // const previousRoute = budgetPageAddress??`/fintrack/budget/${categoryName}`

  //--if summary info of category is not coming from location.state, then it is built
  
  useEffect(() => {
    if(!categorySummaryDetailed && categoryAccountsExists){
      const summary = calculateCategorySummaryInfo(categoryAccounts,categoryName!,
 //here currency code is assumed to be the same for every account, not multicurrencies
    categoryAccounts[0].currency_code);
    setCategorySummaryInfo(summary);
    }
    }, [categorySummaryDetailed,categoryAccounts,categoryName,categoryAccountsExists,calculateCategorySummaryInfo] )

//summary data
  const summaryData =categorySummaryInfo? {
    title: 'Budget',
    amount: Number(categorySummaryInfo.total_budget),
    subtitle1: 'Spent',
    amount1:+categorySummaryInfo.total_balance,
    status: categorySummaryInfo.statusAlert as boolean,
    amount2:(+categorySummaryInfo.remain),
    currency_code: categorySummaryInfo.currency_code,
     }
     :{
    title: 'Budget',
    amount: 0,
    subtitle1: 'Spent',
    amount1:0,
    status: false,
    amount2:0,
    currency_code:'usd' as CurrencyType
     }
     ;
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

            <Link to='edit' className='flx-col-center icon3dots'>
              <Dots3LightSvg />
            </Link>
          </div>
        </div>

        <SummaryDetailBox bubleInfo={summaryData}></SummaryDetailBox>
  
        <CardTitle>{`${capitalize(categoryName!)} Accounts`}</CardTitle>  

        <ListAccountOfCategory previousRoute={`${budgetPageAddress}/category/${categoryName}`}
        accounts={categoryAccounts}
        //categoryName={categoryName}
  /> 
        {isLoading && <p>Loading...</p>}
        {error && <p>Error loading data: {error}</p>}
      </section>
    </>
  );
}

export default CategoryAccountList;
