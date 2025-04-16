import OverviewSvg from '../../assets/mainNavbarSvg/OverviewSvg.svg';
import { NavLink, useLocation } from 'react-router-dom';
import Tooltip from '../tooltip/Tooltip';
import { capitalize } from '../../helpers/functions';

const classNavLink = `mainNavbarButton ${({
  isActive,
}: {
  isActive: boolean;
}) => (isActive ? 'active' : '')}`;

function OverviewButton() {
  const btnName = 'overview';
  const isBtnActive =
    useLocation().pathname.split('/')[1] == btnName ? 'active' : '';

  return (
    <>
      <NavLink
        to='/overview'
        className={`${classNavLink} ${isBtnActive}`}
      >
        <div className='iconContainer flx-col-center'>
          <Tooltip
            tipText={capitalize(btnName)}
            isActive={isBtnActive ? true : false}
          >
            <OverviewSvg />
          </Tooltip>
        </div>

        <span className='button--label'>{`overview`}</span>
      </NavLink>
    </>
  );
}

export default OverviewButton;
