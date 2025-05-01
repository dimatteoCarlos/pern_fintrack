import DebtsSvg from '../../assets/mainNavbarSvg/DebtsSvg.svg';
import { NavLink, useLocation } from 'react-router-dom';
import Tooltip from '../tooltip/Tooltip';
import { capitalize } from '../../helpers/functions';

const classNavLink = `mainNavbarButton ${({
  isActive,
}: {
  isActive: boolean;
}) => (isActive ? 'active' : '')}`;

function DebtsButton() {
  const btnName = 'debts';
  const isBtnActive =
    useLocation().pathname.split('/')[2] == btnName ? 'active' : '';
    console.log(useLocation().pathname, isBtnActive, )
  return (
    <>
      <NavLink to='/fintrack/debts/debtors' className={`${classNavLink} ${isBtnActive}`}>
        <Tooltip
          tipText={capitalize(btnName)}
          isActive={isBtnActive ? true : false}
        >
          <div className='iconContainer flx-col-center'>
            <DebtsSvg />
          </div>
        </Tooltip>

        <span className='button--label'>{`debts`}</span>
      </NavLink>
    </>
  );
}

export default DebtsButton;
