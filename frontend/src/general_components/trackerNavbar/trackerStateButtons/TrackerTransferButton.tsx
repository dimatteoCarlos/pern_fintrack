import InvestmentSvg from '../../../assets/trackerNavbarSvg/InvestmentSvg.svg';
import { NavLink } from 'react-router-dom';

function TrackerTransferButton() {
  const classNavLink = `trackerStateIconButton flx-col-center ${({
    isActive,
  }: {
    isActive: boolean;
  }) => (isActive ? 'active' : '')}`;

  return (
    <>
      <div className='trackerStateButton__container'>
        <NavLink to='transfer' className={classNavLink}>
          <InvestmentSvg />
        </NavLink>
        <div className='trackerStateButton__state--title'>{'Transfer'}</div>
      </div>
    </>
  );
}

export default TrackerTransferButton;
