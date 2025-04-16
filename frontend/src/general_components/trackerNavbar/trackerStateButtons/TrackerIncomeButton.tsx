import IncomeSvg from '../../../assets/trackerNavbarSvg/IncomeSvg.svg';

import { NavLink } from 'react-router-dom';
function TrackerIncomeButton() {
  return (
    <>
      <div className='trackerStateButton__container'>
        <div className={`trackerStateButton`}>
          <NavLink
            to={'/tracker/income'}
            className={`trackerStateIconButton flx-col-center ${(isActive: {
              isActive: boolean;
            }) => (isActive ? 'active' : '')}`}
          >
            <IncomeSvg />
          </NavLink>
        </div>
        <div className='trackerStateButton__state--title'>{'Income'}</div>
      </div>
    </>
  );
}

export default TrackerIncomeButton;
