//src/general_components/header/LogoMenuIcon.tsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../../../auth/hooks/useAuth';
import UserProfileMenu from '../../../auth/components/userProfileMenu/UserProfileMenu';

//icon images
import Logo from '../../../assets/logo.svg';
import { MdOutlineEditNote } from 'react-icons/md';
import { BsArrowRight } from 'react-icons/bs';
import './logoMenuIcon.css';
import { notifySuccess } from '../../../auth/auth_utils/notification';

import { AUTH_ROUTE } from '../../../auth/auth_constants/constants';

//MAIN COMPONENT: LogoMenuIcon.tsx
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

   // ✅ Redirect to home and show toast
    notifySuccess('Signed out successfully');
    navigateTo(AUTH_ROUTE, {
      replace: true,
      state: { authEvent: 'user_logged_out' as const }
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
