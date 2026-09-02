// frontend/src/fintrack/general_components/trackerNavbar/trackerStateButtons/TrackerAdjustmentPnLButton.tsx

import AdjustSvg from '../../../../assets/trackerNavbarSvg/AdjustSvg.svg';
import { NavLink } from 'react-router-dom';

function TrackerInvestmentButton() {
  const classNavLink = `trackerStateIconButton flx-col-center ${({
    isActive,
  }: {
    isActive: boolean;
  }) => (isActive ? 'active' : '')}`;

  return (
    <>
      <div className='trackerStateButton__container'>
        {/* The icon carries no title, so without this the link announces
            unnamed. Pointed at the caption below rather than repeating the word
            in an aria-label: the accessible name is then the visible text. */}
        <NavLink
          to='pnl'
          aria-labelledby='trackerTabLabel-pnl'
          className={classNavLink}
        >
          <AdjustSvg />
        </NavLink>
        <div
          id='trackerTabLabel-pnl'
          className='trackerStateButton__state--title'
        >
          {'PnL'}
        </div>
      </div>
    </>
  );
}

export default TrackerInvestmentButton;
