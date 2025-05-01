import WalletSvg from '../../assets/mainNavbarSvg/WalletSvg.svg';
import { NavLink, useLocation } from 'react-router-dom';
import Tooltip from '../tooltip/Tooltip';
import { capitalize } from '../../helpers/functions';

const classNavLink = `mainNavbarButton
${({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')}
`;

function BudgetButton() {
  const btnName = 'budget';
  const isBtnActive =
    useLocation().pathname.split('/')[2] == btnName ? 'active' : '';
  console.log(useLocation().pathname.split('/')[2], isBtnActive);

  return (
    <>
      <NavLink
        to='/fintrack/budget'
        className={`${classNavLink} ${isBtnActive} `}
      >
        <Tooltip
          tipText={capitalize(btnName)}
          isActive={isBtnActive ? true : false}
        >
          <div className='iconContainer flx-col-center'>
            <WalletSvg />
          </div>
        </Tooltip>

        <span className='button--label'>{`budget`}</span>
      </NavLink>
    </>
  );
}

export default BudgetButton;
