// frontend/src/fintrack/general_components/trackerNavbar/trackerStateButtons/TrackerExpenseButton.tsx

import ExpenseSvg from '../../../../assets/trackerNavbarSvg/ExpenseSvg.svg';
import { NavLink } from 'react-router-dom';

function TrackerExpenseButton() {
  return (
    <>
      <div className='trackerStateButton__container '>
        {/* The icon carries no title, so without this the link announces
            unnamed. Pointed at the caption below rather than repeating the word
            in an aria-label: the accessible name is then the visible text. */}
        <NavLink
          to='/fintrack/tracker/expense'
          aria-labelledby='trackerTabLabel-expense'
          className={`flx-col-center trackerStateIconButton  ${(isActive: {
            isActive: boolean;
          }) => (isActive ? 'active' : '')}`}
        >
          <ExpenseSvg />
        </NavLink>

        <div
          id='trackerTabLabel-expense'
          className='trackerStateButton__state--title'
        >
          {'Expense'}
        </div>
      </div>
    </>
  );
}

export default TrackerExpenseButton;
