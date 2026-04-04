//src/general_components/header/LogoMenuIcon.tsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../../auth/hooks/useAuth';
import UserProfileMenu from '../../../auth/components/userProfileMenu/UserProfileMenu';

//icon images
import Logo from '../../../assets/logo.svg';
//edit icon alternatives
import { MdOutlineEditNote } from 'react-icons/md';
// import { FiEdit } from "react-icons/fi";
// import MenuIcon from '../../assets/MenuSvg.svg';

//exit icon alterantives: import { IoExitOutline } from 'react-icons/io5'; import { RxExit } from 'react-icons/rx';
// import SignOutIcon from '../../assets/SignOutSvg.svg';

import { BsArrowRight } from 'react-icons/bs';
import './logoMenuIcon.css';

// import UserSquareIcon from '../../assets/UserSquareIcon.svg';

import './logoMenuIcon.css';
import { AUTH_ROUTE } from '../../../auth/auth_constants/constants';

function LogoMenuIcon() {
  const { pathname } = useLocation();
  const navigateTo = useNavigate();
  //--auth states-------------
  const { handleSignOut, clearError, clearSuccessMessage, isAuthenticated } =
    useAuth();

  //handler for sign out click function button
  const handleSignOutClick = async() => {
    clearError();
    clearSuccessMessage();
    await handleSignOut();
  //re direct to /auth and signout
  // ✅ UI decides navigation + intent
    navigateTo(AUTH_ROUTE, {
      replace: true,
      state: { intent: 'user_logged_out' as const }
    });
  };

  return (
    <div className='header__logoAndIcon'>
      <Logo />

     <div
      className='menuBox '
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        width: '35%',
        alignSelf: 'center',
        gap: '0.5rem',
      }}
      >
     <Link to='accounting' className='' state={{ originRoute: pathname }}>
       <div className='iconContainer edit  '>
         {/* <MenuIcon /> */}
        <MdOutlineEditNote
          style={{
           color: 'black',
           fontSize: '32px',
           border: '3px solid black',
           borderRadius: '8px',
          }}
         />
       </div>
     </Link>

        {isAuthenticated && (
          <div className='iconContainer'>
            <UserProfileMenu />
          </div>
        )}

        <button
          onClick={handleSignOutClick}
          className=''
          style={{ border: 'none' }}
        >
          <div className='iconContainer exit '>
            <BsArrowRight
              style={{
                color: 'black',
                fontSize: '30px',
                fontWeight: 'bold',
                paddingLeft: '8px',

                border: '3px solid black',
                borderRight: '0px solid white',
                borderRadius: '8px',
              }}
            />
          </div>
        </button>
      </div>
    </div>
  );
}

export default LogoMenuIcon;
