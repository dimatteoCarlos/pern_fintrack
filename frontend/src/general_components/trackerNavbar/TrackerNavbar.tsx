// import { useNavigate, useLocation } from 'react-router-dom';
import TrackerDebtsButton from './trackerStateButtons/TrackerDebtsButton';
import TrackerExpenseButton from './trackerStateButtons/TrackerExpenseButton';
import TrackerIncomeButton from './trackerStateButtons/TrackerIncomeButton';
import TrackerInvestmentButton from './trackerStateButtons/TrackerInvestmentButton';
import './trackerStateButtons/trackerStateButton.css';
// import { useEffect } from 'react';

function TrackerNavbar() {
  // const {pathname}=useLocation();
  // const isTracker = pathname.split('/')[1] === 'tracker'
  // const navigateTo=useNavigate()

  // useEffect(()=>{
  //   isTracker  ?   navigateTo('/tracker/expense'):''
  //  } ,[])

  return (
    <nav className='trackerNavbar__container'>
      <TrackerExpenseButton />
      <TrackerIncomeButton />
      <TrackerInvestmentButton />
      <TrackerDebtsButton />
    </nav>
  );
}

export default TrackerNavbar;
