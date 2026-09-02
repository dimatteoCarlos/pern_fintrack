//frontend/src/fintrack/general_components/trackerNavbar/trackerStateButtons/TrackerDebtsButton.tsx

import DebtsSvg from '../../../../assets/trackerNavbarSvg/DebtsSvg.svg';
import { NavLink } from 'react-router-dom';

function TrackerDebtsButton() {
  return (
    <>
      <div className='trackerStateButton__container'>
        {/* The icon carries no title, so without this the link announces
            unnamed. Pointed at the caption below rather than repeating the word
            in an aria-label: the accessible name is then the visible text. */}
        <NavLink
          to={'debts'}
          aria-labelledby='trackerTabLabel-debts'
          className={`flx-col-center trackerStateIconButton  ${(isActive: {
            isActive: boolean;
          }) => (isActive ? 'active' : '')}`}
        >
          <DebtsSvg />
        </NavLink>
        <div
          id='trackerTabLabel-debts'
          className='trackerStateButton__state--title'
        >
          {'Debts'}
        </div>
      </div>
    </>
  );
}

export default TrackerDebtsButton;
