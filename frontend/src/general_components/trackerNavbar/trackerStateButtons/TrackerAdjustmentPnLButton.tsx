import AdjustSvg from '../../../assets/trackerNavbarSvg/AdjustSvg.svg';
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
        <NavLink to='pnl' className={classNavLink}>
          <AdjustSvg />
        </NavLink>
        <div className='trackerStateButton__state--title'>{'PnL'}</div>
      </div>
    </>
  );
}

export default TrackerInvestmentButton;
