//frontend\src\auth\components\userProfileBadge\UserProfileBadge.tsx

//UserProfileBadge:shows user data profile in the header

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../../stores/useAuthStore"

import styles from './UserProfileBadge.module.css';

const UserProfileBadge = () => {
//Get user data from global store
const userData = useAuthStore((state)=>state.userData)
//Check if authenticated
const isAuthenticated = useAuthStore((state)=>state.isAuthenticated);

//States for the menu and forms
const [showMenu,setShowMenu]=useState(false);
const [showTooltip,setShowTooltip]=useState(false);
const [showUpdateForm,setShowUpdateForm]=useState(false);
const [showChangePasswordForm,setShowChangePasswordForm]=useState(false);

//draggable menu
const [isDragging, setIsDragging] = useState(false);

const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [position, setPosition] = useState({ x: window.innerWidth/2+50, y:88 }); // Posición inicial

useEffect(() => {
  if (isDragging) {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
  
  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}, [isDragging, dragOffset]);

//-------------------------
//Refs to handle clicks outside the menu
const menuRef = useRef<HTMLDivElement>(null);
const avatarRef =useRef<HTMLDivElement>(null);

//Handler clicks outside the menu
useEffect(()=>{
 const handleClickOutside = (event:MouseEvent)=>{
  if(
   menuRef.current &&
   !menuRef.current.contains(event.target as Node)
    &&
   avatarRef.current &&
   !avatarRef.current.contains(event.target as Node)
  ){
   setShowMenu(false);
   setShowTooltip(false);
  };
 };

 //Handler for escape key
 const handleEscapeKey = (event:KeyboardEvent)=>{
  if(event.key==='Escape'){
   setShowMenu(false);
   setShowTooltip(false);
  }
 };

 if(showMenu){
  document.addEventListener('mousedown',handleClickOutside);
  document.addEventListener('keydown', handleEscapeKey)
 }

 return ()=>{
  document.removeEventListener('mousedown', handleClickOutside);
  document.removeEventListener('keydown', handleEscapeKey)
 }
}, [showMenu])

if(!isAuthenticated || !userData){return null;}

//Get the initial letter of user first name
const userLabel = userData?.user_firstname || userData?.user_lastname || userData?.username;
console.log({userLabel});
const initial = userLabel ? userLabel.charAt(0).toUpperCase() : 'U';//'👤';'📝';🖊️;➜]
// utils as tooltip, clickoutside , clickEscape, etc, can be obtained from other parts of this app, as mainNavbar, Tooltip and AcduntAccionsMenu, but here, will be repeated just to practice. 

//Email to tooltip
const userEmail = userData.email;

//Handler to open/close menu
const handleAvatarClick =()=>{
 setShowMenu(!showMenu);
 setShowTooltip(false);
};

//Handler to show/hide tooltip (hover in mobile: tap and hold)
const handleAvatarTouchStart=()=>{
 if(!showMenu){setShowTooltip(true)}
}

const handleAvatarTouchEnd = ()=>{
 setTimeout(()=>{setShowTooltip(true)}, 1000);
};

const handleAvatarMouseEnter =()=>{
 if(!showMenu){setShowTooltip(true)}
};

const  handleAvatarMouseLeave = ()=>{
 setShowTooltip(false);
};

//Handlers of menu options
const handleEditProfile = ()=>{
 setShowUpdateForm(true);
 setShowMenu(false);
};

const handleChangePassword = ()=>{
 setShowChangePasswordForm(true);
 setShowMenu(false);
};

const handleCloseForms = ()=>{
 setShowUpdateForm(false);
 setShowChangePasswordForm(false);
};
//---------
const handleMouseDown = (e: React.MouseEvent) => {
  if (e.button !== 0) return; // Solo botón izquierdo
  
  const rect = e.currentTarget.getBoundingClientRect();
  setDragOffset({
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  });
  setIsDragging(true);
  
  e.preventDefault();
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging) return;
  
  setPosition({
    x: e.clientX - dragOffset.x,
    y: e.clientY - dragOffset.y
  });
};

const handleMouseUp = () => {
  setIsDragging(false);
};
//---------------------
  return (
    <>
    <div className={styles.badgeContainer}>
     {/* Avatar con tooltip */}
    <div className={styles.userAvatar}
    onClick={handleAvatarClick}
    onTouchStart ={handleAvatarTouchStart}
    onTouchEnd ={handleAvatarTouchEnd}
    onMouseEnter={handleAvatarMouseEnter}
    onMouseLeave = {handleAvatarMouseLeave}
    role='button'
    aria-label='User profile menu'
    aria-expanded = {showMenu}
    tabIndex={0}
    onKeyDown={(e)=>{
     if(e.key==='Enter' || e.key === ' '){
      handleAvatarClick();
      e.preventDefault();
     }
    }}
   
    >{initial}
    
    {/* Tooltip with email (visible only on hover/tap) */}

    {
     showTooltip && !showMenu && (
      <div className={styles.emailTooltip}>{userEmail}
      <div className={styles.tooltipArrow}></div>
      </div>
     )
    }
    </div>

     {/* Dropdown Menu*/}
     {showMenu && (
      <div className={styles.profileMenu}
      style={{
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}

      ref={menuRef} role="menu" aria-label="User profile options">

     {/* Menu header with user info */} 
      <div className={styles.menuHeader}>
       <div className={styles.menuAvatar}>{initial}</div>
       <div className={styles.menuUserInfo}><span className={styles.menuUserName}>{userData.user_firstname} {userData.user_lastname}</span>
       <span className={styles.menuUserEmail}>{userEmail}</span>
       </div>
      </div>

      <div className={styles.menuDivider}></div>

      {/*Menu Options */}
      <button className={styles.menuItem}onClick={handleEditProfile} role="menuitem" tabIndex={0}
      >
       <span className={styles.menuItemIcon}>✏️</span>
       <span className={styles.menuItemText}>Edit Profile</span>
      </button>

      <button className={styles.menuItem} role="menuitem" onClick={handleChangePassword} tabIndex={0}>
       <span className={styles.menuItemIcon}>🔐</span>
       <span className={styles.menuitemText}>Change Password</span>
      </button>

      <div className={styles.menuDivider}></div>

      {/* Additional Information */}
      <div className={styles.menuFooter}><span className={styles.currencyBadge}>Currency: <strong>{userData.currency ||'usd'}</strong>
      </span>
      </div>
     </div>
     )}
     </div>

      {/* Formularios modales (se implementarán después) */}
      {/* 
      {showUpdateForm && (
        <UpdateProfileForm 
          userData={userData}
          onClose={handleCloseForms}
        />
      )}
      
      {showChangePasswordForm && (
        <ChangePasswordForm 
          onClose={handleCloseForms}
        />
      )}
      */}
     
    </>
  )
};

export default UserProfileBadge