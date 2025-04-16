import ExpenseSvg from '../../../assets/trackerNavbarSvg/ExpenseSvg.svg';
import { NavLink } from 'react-router-dom';

function TrackerExpenseButton() {
  return (
    <>
      <div className='trackerStateButton__container '>
        <NavLink
          to='/tracker/expense'
          className={`flx-col-center trackerStateIconButton  ${(isActive: {
            isActive: boolean;
          }) => (isActive ? 'active' : '')}`}
        >
          <ExpenseSvg />
        </NavLink>

        <div className='trackerStateButton__state--title'>{'Expense'}</div>
      </div>
    </>
  );
}

export default TrackerExpenseButton;
