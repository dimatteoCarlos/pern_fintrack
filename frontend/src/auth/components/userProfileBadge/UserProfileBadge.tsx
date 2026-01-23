//frontend\src\auth\components\userProfileBadge\UserProfileBadge.tsx

//UserProfileBadge:shows user data profile in the header

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../../stores/useAuthStore"

import styles from './UserProfileBadge.module.css';

import UpdateProfileContainer from "../updateProfileForm/UpdateProfileContainer";

// =====================
// MAIN COMPONENT
// =====================
const UserProfileBadge = () => {

// =================== 
// GLOBAL AUTH STATE
// =================== 
//Get user data from global store
const userData = useAuthStore((state)=>state.userData)
//GET if authenticated
const isAuthenticated = useAuthStore((state)=>state.isAuthenticated);

// ============
// UI STATES
// ============
//States for the menu and forms
const [showMenu,setShowMenu]=useState(false);
const [showTooltip,setShowTooltip]=useState(false);
const [showUpdateForm,setShowUpdateForm]=useState(false);

// const [showChangePasswordForm,setShowChangePasswordForm]=useState(false);
//-----------------------------------
// USER LABEL / INITIAL
// =====================
// Extract user information for display
//Get the initial letter of user first name
const userLabel = userData?.user_firstname || userData?.user_lastname ||
userData?.username;

console.log({userLabel});

// ❌ ELIMINADO console.log (debug leftover)
const initial = userLabel ? userLabel.charAt(0).toUpperCase() : 'U';//'👤';'📝';🖊️;➜]
// =============================
// DRAG STATE AND DRAG LOGIC 
// =============================
//DRAGGABLE MENU
//States for dragging menu
const [isDragging, setIsDragging] = useState(false);
const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
//save distance between mouse and menu corner
const [relPos, setRelPos] = useState({ x: 0, y: 0 });

// ========
// REFS
// Refs for DOM access
const menuRef = useRef<HTMLDivElement>(null);
const avatarRef =useRef<HTMLDivElement>(null);

//Email as tooltip
const userEmail = userData?.email;

// =============
// HANDLERS 
// =============
const closeAll = () => {
 setShowMenu(false);
 setShowUpdateForm(false);
 setShowTooltip(false);
 // setShowChangePasswordForm(false);
};

//Handler to open/close menu
const handleAvatarClick =()=>{
 setShowMenu(true); //always opens as modal
 setShowTooltip(false);
// ℹ️ Reset drag position
 setDragPosition({ x: 0, y: 0 });
};

// --- MENU DRAGGING LOGIC ---
// ============
// DRAG START
// ============
const handleDragStart =(e:React.MouseEvent<HTMLDivElement>| React.TouchEvent<HTMLDivElement>)=>{
// Drag only with left click
 if ('button' in e && e.button !== 0 ) return;

// Only allow dragging from the menu header for better UX
 const target = e.target as HTMLElement;
 const isHeader = target.closest(`.${styles.menuHeader}`) !== null;
 if (!isHeader || !menuRef.current) return;

 //use rect to calculate the exact offset(grabbing point)
 const rect = menuRef.current.getBoundingClientRect();
 const coords = 'touches' in e
  ? e.touches[0] 
  : e;

 setRelPos({
  x: coords.clientX - rect.left,
  y: coords.clientY - rect.top
 });

 setIsDragging(true);

// Nota: preventDefault en touchstart puede bloquear el scroll.
 //Avoid accidental scroll for mobiles while menu is being dragged
 if ('touches' in e) {
  e.preventDefault(); // Opcional, dependiendo de la configuración de listeners pasivos
   }
  };

//Explicit typing
const handleDragMove = useCallback((e: Event | MouseEvent | TouchEvent) => {
 if (!isDragging || !menuRef.current) return;
  
// Calculate new position based on mouse movement. New position = Mouse - Initial Offset
// Convertimos el evento genérico a MouseEvent o TouchEvent
   const mouseEv = e as MouseEvent;
   const touchEv = e as TouchEvent;

   const x = touchEv.touches
    ? touchEv.touches[0].clientX
    : mouseEv.clientX;

   const y = touchEv.touches ? touchEv.touches[0].clientY : mouseEv.clientY;

   let newX = x - relPos.x;
   let newY = y - relPos.y;
  
// Keep within viewport bounds
  newX = Math.max(0, Math.min(newX, window.innerWidth - (menuRef.current?.offsetWidth )));
  newY = Math.max(0, Math.min(newY, window.innerHeight - menuRef.current.offsetHeight));
  
  setDragPosition({ x: newX, y: newY });
 }, [isDragging, relPos]
);

//----
const handleDragEnd = useCallback(() => {
 setIsDragging(false);
 }, []);

//=============
// SIDE EFFECTS
//=============
// ESC key closes menu
useEffect(()=>{
const handleEscapeKey = (event:KeyboardEvent)=>{
 if(event.key==='Escape'){
  closeAll();
 }
};

if(showMenu)(
 document.addEventListener('keydown', handleEscapeKey)
);

return ()=>{
 document.removeEventListener('keydown', handleEscapeKey)
}
}, [showMenu]);

//-------------------
//Setup drag event listeners
useEffect(() => {
if (!isDragging) return;

//listeners for touche
document.addEventListener('touchmove', handleDragMove, { passive: false });
document.addEventListener('touchend', handleDragEnd);

////listeners for mouse moves
document.addEventListener('mousemove', handleDragMove);
document.addEventListener('mouseup', handleDragEnd);

return () => {
 document.removeEventListener('touchmove', handleDragMove);
 document.removeEventListener('touchend', handleDragEnd);

 document.removeEventListener('mousemove', handleDragMove);
 document.removeEventListener('mouseup', handleDragEnd);
};

}, [isDragging, handleDragMove,handleDragEnd]);

// GUARD
// =========
// Don't render if user is not authenticated
if(!isAuthenticated || !userData){return null;}

//============
// RENDER
// =============
return (
 <>
{/* ===========================
    AVATAR (TRIGGER)
============================ */}
  {/* {showMenu && (
   <div className={styles.menuOverlay}
   onClick={() => setShowMenu(false)} />
  )} */}

<div className={styles.badgeContainer}>
{/*USER AVATAR:  Avatar con tooltip */}
 <div className={styles.userAvatar}
  ref={avatarRef}
  role='button'
  aria-label='User profile actions'
  aria-expanded = {showMenu}
  tabIndex={0}

  onClick={handleAvatarClick}
  // onTouchStart ={handleAvatarTouchStart}
  onMouseEnter={() => !showMenu && setShowTooltip(true)}
  onMouseLeave={() => setShowTooltip(false)}
  
   >{initial}

{/* Tooltip with email (visible only on hover/tap) */}
 {
 showTooltip && !showMenu && (
  <div className={styles.emailTooltip}>
   {userEmail}
   <div className={styles.tooltipArrow}/>
  </div>
  ) }
  </div>
 </div>

{/* PROFILE MENU */}
{/* Dropdown Menu */}
{/* Draggable dropdown menu with proper positioning */}

{/* ============================
      MODAL OVERLAY
============================ */}
{showMenu && (
  <div className={styles.menuOverlay} onClick={closeAll}>
    <div className={styles.menuCenterWrapper} onClick={(e)=>e.stopPropagation()}>
     <div
     className={`${styles.profileMenu} ${isDragging ? styles.dragging : ""}`}
     ref={menuRef} 
     role="dialog"
     // aria-label="User profile options"
     //Dynamic drag position
     style={{
    // CSS centers it initially, then JS takes over for dragging
     left: dragPosition.x ? `${dragPosition.x}px` : undefined,
     top: dragPosition.y ? `${dragPosition.y}px` : undefined,
     transform: dragPosition.x !==0 ? 'none' : undefined,
    // cursor: isDragging ? 'grabbing' : 'default',
    //touch-action: none. Tells the browser not to scroll while dragging
    // touchAction:'none'
    }}
    onMouseDown={handleDragStart}
    onTouchStart={handleDragStart}
  >

  {/* MENU HEADER (DRAG AREA) */}
  {/* Menu header - this is the draggable area */}
  <div className={styles.menuHeader}
    tabIndex={0} 
    // onMouseDown={(e) => e.stopPropagation()} // Prevent event bubbling
   >
    <div className={styles.menuAvatar}>{initial}
    </div>

    <div className={styles.menuUserInfo}>
     <span className={styles.menuUserName}>{userData.username}
     </span> 
     <span className={styles.menuUserEmail}>{userEmail}
     </span>
    </div>

   {/* 🔄 ADD: Visual indicator for draggable area */}
   <div className={styles.dragHandle}> ⋮⋮
   </div>
  </div>

  <div className={styles.menuDivider} />

  {/* ACTIONS */}
  {/*Menu Options */}
  <button className={styles.menuItem}
   onClick={() => {
    setShowUpdateForm(true); setShowMenu(false); }}
   >
    <span className={styles.menuItemIcon}>✏️</span>
    <span className={styles.menuItemText}>Edit Profile</span>
   </button>

   <button className={styles.menuItem}>
     <span className={styles.menuItemIcon}>🔐</span>
     <span className={styles.menuItemText}>Change Password</span>
    </button>

    <div className={styles.menuDivider}></div>

  {/* Additional Information */}
    <div className={styles.menuFooter}>
     <span className={styles.currencyBadge}>Currency:{" "}
      <strong>{userData.currency ||'usd'}</strong>
      </span>
      </div>
     </div>
    </div>
  </div>
  )
 }

{/* ============================
   UPDATE PROFILE MODAL 
============================ */}
{showUpdateForm && (
 <div className={styles.modalOverlay} onClick={closeAll}>
  <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}
   >
   <UpdateProfileContainer onClose={closeAll}/>
  </div>
 </div>
 )}

  {/*     
  {showChangePasswordForm && (
  <ChangePasswordForm 
  onClose={handleCloseForms}
  />
  )}
  */}
     
 </>
 )
};

export default UserProfileBadge;