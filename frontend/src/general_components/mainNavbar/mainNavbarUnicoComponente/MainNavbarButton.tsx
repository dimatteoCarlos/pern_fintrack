// src/components/navbar/MainNavbarButton.tsx
import { NavLink, useLocation } from 'react-router-dom';
import Tooltip from '../../tooltip/Tooltip';
import { capitalize } from '../../../helpers/functions';
import './styles/mainNavbar.css';

type MainNavbarButtonProps = {
  btnName: string;
  path: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
};

function MainNavbarButton({ btnName, path, Icon }: MainNavbarButtonProps) {
  const location = useLocation();
  const isBtnActive =
    location.pathname.split('/')[1] === btnName ? 'active' : '';

  return (
    <NavLink to={path} className={`mainNavbarButton ${isBtnActive}`}>
      <Tooltip tipText={capitalize(btnName)} isActive={!!isBtnActive}>
        <div className='iconContainer flx-col-center'>
          <Icon />
        </div>
      </Tooltip>
      <span className='button--label'>{btnName}</span>
    </NavLink>
  );
}

export default MainNavbarButton;
