import DebtsSvg from '../../../assets/trackerNavbarSvg/DebtsSvg.svg';
import { NavLink } from 'react-router-dom';

function TrackerDebtsButton() {
  return (
    <>
      <div className='trackerStateButton__container'>
        <NavLink
          to={'/tracker/debts'}
          className={`flx-col-center trackerStateIconButton  ${(isActive: {
            isActive: boolean;
          }) => (isActive ? 'active' : '')}`}
        >
          <DebtsSvg />
        </NavLink>
        <div className='trackerStateButton__state--title'>{'Debts'}</div>
      </div>
    </>
  );
}

export default TrackerDebtsButton;
