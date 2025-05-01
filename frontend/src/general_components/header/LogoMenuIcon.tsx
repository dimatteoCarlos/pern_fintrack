import { Link, useLocation } from 'react-router-dom';
import Logo from '../../assets/logo.svg';

import MenuIcon from '../../assets/MenuSvg.svg';
import './logoMenuIcon.css';
function LogoMenuIcon() {
  const { pathname } = useLocation();
  return (
    <div className='header__logoAndIcon'>
      <Logo />
      <Link
        to='accounting'
        className='iconContainer'
        state={{ originRoute: pathname }}
      >
        <MenuIcon />
      </Link>
    </div>
  );
}

export default LogoMenuIcon;
