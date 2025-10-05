//src/general_components/header/LogoMenuIcon.tsx
import { Link, useLocation } from 'react-router-dom';
import Logo from '../../assets/logo.svg';
import MenuIcon from '../../assets/MenuSvg.svg';
import SignOutIcon from '../../assets/SignOutSvg.svg';
import './logoMenuIcon.css';
import useAuth from '../../auth/hooks/useAuth';
function LogoMenuIcon() {
  const { pathname } = useLocation();

//--auth states-------------
const {handleSignOut, clearError,
clearSuccessMessage} = useAuth()  

//handler for sign out click function button
const handleSignOutClick = ()=>{
  clearError()
  clearSuccessMessage()
  handleSignOut()
  //re direct to /auth and signout
}

  return (
    <div className='header__logoAndIcon '>
      <Logo />
      <div className="menuBox"
      style={{display:'flex', justifyContent:'space-around', width:'25%', }}
      >
      <Link
        to='accounting'
        className='iconContainer'
        state={{ originRoute: pathname }}
      >
        <MenuIcon />
      </Link>

      <button
        onClick={handleSignOutClick}
        className='iconContainer'
        style={{border:'none', }}
       >
        <SignOutIcon />
      </button>
      </div>

    </div>
  );
}

export default LogoMenuIcon;
