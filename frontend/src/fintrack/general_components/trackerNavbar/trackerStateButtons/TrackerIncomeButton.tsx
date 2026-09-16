//frontend/src/fintrack/general_components/trackerNavbar/trackerStateButtons/TrackerIncomeButton.tsx

import IncomeSvg from '../../../../assets/trackerNavbarSvg/IncomeSvg.svg';

import { NavLink } from 'react-router-dom';
function TrackerIncomeButton() {
  return (
    <>
      <div className='trackerStateButton__container'>
        <div className={`trackerStateButton`}>
          {/* The icon carries no title, so without this the link announces
              unnamed. Pointed at the caption below rather than repeating the
              word in an aria-label: the accessible name is the visible text. */}
          <NavLink
            to={'income'}
            aria-labelledby='trackerTabLabel-income'
            className={`trackerStateIconButton flx-col-center ${(isActive: {
              isActive: boolean;
            }) => (isActive ? 'active' : '')}`}
          >
            <IncomeSvg />
          </NavLink>
        </div>
        <div
          id='trackerTabLabel-income'
          className='trackerStateButton__state--title'
        >
          {'Income'}
        </div>
      </div>
    </>
  );
}

export default TrackerIncomeButton;
