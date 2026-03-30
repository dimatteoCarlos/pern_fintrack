// import { useNavigate, useLocation } from 'react-router-dom';
import TrackerDebtsButton from './trackerStateButtons/TrackerDebtsButton.tsx';
import TrackerExpenseButton from './trackerStateButtons/TrackerExpenseButton.tsx';
import TrackerIncomeButton from './trackerStateButtons/TrackerIncomeButton.tsx';
import TrackerTransferButton from './trackerStateButtons/TrackerTransferButton.tsx';
import TrackerAdjustmentPnLButton from './trackerStateButtons/TrackerAdjustmentPnLButton.tsx';

import './trackerStateButtons/trackerStateButton.css';

function TrackerNavbar() {
  return (
    <nav className='trackerNavbar__container'>
      <TrackerExpenseButton />
      <TrackerIncomeButton />
      <TrackerTransferButton />
      <TrackerDebtsButton />
      {/* TrackerAdjustmentPnLButton: PnL Profit and Loss adjustment on Bank and Investment accounts */}
      <TrackerAdjustmentPnLButton />
    </nav>
  );
}

export default TrackerNavbar;
