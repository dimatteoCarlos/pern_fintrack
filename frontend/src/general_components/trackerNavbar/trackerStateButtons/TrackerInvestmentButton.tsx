import InvestmentSvg from '../../../assets/trackerNavbarSvg/InvestmentSvg.svg';
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
        <NavLink to='/tracker/investment' className={classNavLink}>
          <InvestmentSvg />
        </NavLink>
        <div className='trackerStateButton__state--title'>{'Investment'}</div>
      </div>
    </>
  );
}

export default TrackerInvestmentButton;
