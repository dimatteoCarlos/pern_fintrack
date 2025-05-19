// import { useNavigate, useLocation } from 'react-router-dom';
import TrackerDebtsButton from './trackerStateButtons/TrackerDebtsButton';
import TrackerExpenseButton from './trackerStateButtons/TrackerExpenseButton';
import TrackerIncomeButton from './trackerStateButtons/TrackerIncomeButton';
import TrackerTransferButton from './trackerStateButtons/TrackerTransferButton';
import './trackerStateButtons/trackerStateButton.css';
// import TrackerInvestmentButton from './trackerStateButtons/TrackerInvestmentButton';
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
      {/* <TrackerInvestmentButton /> */}
      <TrackerTransferButton />
      <TrackerDebtsButton />
    </nav>
  );
}

export default TrackerNavbar;
