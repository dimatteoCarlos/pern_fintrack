// import { useNavigate, useLocation } from 'react-router-dom';
import TrackerDebtsButton from './trackerStateButtons/TrackerDebtsButton';
import TrackerExpenseButton from './trackerStateButtons/TrackerExpenseButton';
import TrackerIncomeButton from './trackerStateButtons/TrackerIncomeButton';
import TrackerTransferButton from './trackerStateButtons/TrackerTransferButton';
import './trackerStateButtons/trackerStateButton.css';
import TrackerAdjustmentPnLButton from './trackerStateButtons/TrackerAdjustmentPnLButton.tsx';

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
