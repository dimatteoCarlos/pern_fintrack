import AddSvg from '../../assets/mainNavbarSvg/AddSvg.svg';
import { NavLink, useLocation } from 'react-router-dom';
import Tooltip from '../tooltip/Tooltip';
import { capitalize } from '../../helpers/functions';



const classNavLink = `mainNavbarButton ${({
  isActive,
}: {
  isActive: boolean;
}) => (isActive ? 'active' : '')}`;


function TrackerButton() {
  const btnName = 'tracker';
  const isBtnActive = useLocation().pathname.split('/')[1]==btnName?'active':'';

  return (
    <>
      <NavLink to='/tracker/expense' className={`${classNavLink} ${isBtnActive}`}>
        <Tooltip
        tipText={capitalize(btnName)}
        isActive={isBtnActive ? true : false}>
        <div className='iconContainer flx-col-center'>
          <AddSvg />
        </div>
          </Tooltip>

        <span className='button--label'>{`tracker`}</span>
      </NavLink>
    </>
  );
}

export default TrackerButton;
