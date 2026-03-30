//frontend/src/fintrack/general_components/trackerNavbar/trackerStateButtons/TrackerTransferButton.tsx

import TransferSvg from '../../../../assets/trackerNavbarSvg/TransferSvg.svg';

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
          <TransferSvg />
        </NavLink>
        <div className='trackerStateButton__state--title'>{'Transfer'}</div>
      </div>
    </>
  );
}

export default TrackerTransferButton;
