//src/general_components/header/LogoMenuIcon.tsx
import { Link, useLocation } from 'react-router-dom';
import Logo from '../../assets/logo.svg';
import MenuIcon from '../../assets/MenuSvg.svg';
import SignOutIcon from '../../assets/SignOutSvg.svg';
import './logoMenuIcon.css';
import useAuth from '../../auth/hooks/useAuth';
import UserProfileBadge from '../../auth/components/userProfileBadge/UserProfileBadge';
// import UserSquareIcon from '../../assets/UserSquareIcon.svg';

function LogoMenuIcon() {
  const { pathname } = useLocation();

//--auth states-------------
const {handleSignOut, clearError,
clearSuccessMessage, isAuthenticated} = useAuth()  

//handler for sign out click function button
const handleSignOutClick = ()=>{
  clearError()
  clearSuccessMessage()
  handleSignOut()
  //re direct to /auth and signout
}

  return (
    <div className='header__logoAndIcon'>
      <Logo />

      <div className="menuBox bordered"
      style={{display:'flex', justifyContent:'space-around', width:'35%', alignSelf:'center' }}
      >
      <Link
        to='accounting'
        className=''
        state={{ originRoute: pathname }}
      >
         <div className="iconContainer bordered">
        <MenuIcon />
         </div>
      </Link>

      {isAuthenticated && 
      <div className="iconContainer bordered">
       <UserProfileBadge />
      </div>
      }

      <button
        onClick={handleSignOutClick}
        className=''
        style={{border:'none', }}
       >
        <div className="iconContainer bordered">
            <SignOutIcon />
      </div>
  
      </button>
      </div>

    </div>
  );
}

export default LogoMenuIcon;
