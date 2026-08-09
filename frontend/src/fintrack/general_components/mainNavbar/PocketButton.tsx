//frontend/src/fintrack/general_components/mainNavbar/BudgetButton.tsx

import PocketSvg from '../../../assets/mainNavbarSvg/PocketSvg.svg';
import { NavLink, useLocation } from 'react-router-dom';
import Tooltip from '../tooltip/Tooltip';
import { capitalize } from '../../helpers/functions';

type NavLinkRenderProps = {
  isActive: boolean;
};

const classNavLink = ({ isActive }: NavLinkRenderProps): string =>
  `mainNavbarButton ${isActive ? 'active' : ''}`;

function PocketButton() {
  const btnName = 'pocket';
  const location = useLocation();
  const isBtnActive = location.pathname.split('/')[2] === btnName;

  return (
    <NavLink
      to="/fintrack/pocket"
      className={classNavLink}
    >
      <Tooltip
        tipText={capitalize(btnName)}
        isActive={isBtnActive}
      >
        <div className="iconContainer flx-col-center">
          <PocketSvg />
        </div>
      </Tooltip>

      <span className="button--label">{`pocket`}</span>
    </NavLink>
  );
}

export default PocketButton;