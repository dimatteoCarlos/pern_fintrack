// 📁 frontend/src/auth/components/userProfileMenu/UserAvatar.tsx
//refs:UserProfileMenu.tsx
// 🎯 PRESENTATIONAL COMPONENT: User Avatar with Tooltip
// 🔧 Responsibility: Display user avatar and handle hover interactions
/* 🌟 =======================
📦 IMPORT DEPENDENCIES
========================🌟 */
import React, { useCallback, useRef, useState } from 'react';

// 🎨 CSS Modules
import styles from './styles/userAvatar.module.css';

/* 🌟 =======================
🏷️ TYPE DEFINITIONS
========================🌟 */
/**
 * 📝 UserAvatar component props
 */
type UserAvatarPropsType= {
/** 👤 User's display initial (single character) */
 initial: string;
 /** 📊 REQUIRED: Should tooltip be disabled? (e.g., when menu is open) */
 isTooltipDisabled: boolean;
  
/** 📧 User's email for tooltip display */
 userEmail?: string;

 /** 👤 User's username for tooltip display */
 userName?: string;

/** 🎯 Callback when avatar is clicked */
 onClickFn:  React.MouseEventHandler<HTMLElement>;
  
// /** 📊 Is the menu currently expanded? */
//  isMenuVisible: boolean;
/** 🆔 Optional HTML id for the avatar */
 id?: string;
  
/** 🎨 OPTIONAL: Additional CSS class names for custom styling  */
 className?: string;

/** 🔧 OPTIONAL: Disable the avatar interaction */
 isDisabled?: boolean;

/** 📏 OPTIONAL: Custom size for the avatar (in pixels) */
 size?: number;
}

/* 🌟 ===============================
🎭 COMPONENT: UserAvatar
========================= 🌟 */
/**
 * 🎯 PURE PRESENTATIONAL COMPONENT: User Avatar
 * 
 * 📌 ARCHITECTURAL PRINCIPLES:
 * 1. SINGLE RESPONSIBILITY: Only handles avatar display
 * 2. PRESENTATIONAL: No business logic, no state management
 * 3. REUSABLE: Can be used anywhere in the application
 * 4. ACCESSIBLE: Full keyboard and screen reader support
 * 
 * 🏷️ PATTERNS APPLIED:
 * - Presentational Component Pattern
 * - Props Interface Pattern
 * - Conditional Rendering Pattern
 * 
 * @param props - Component configuration via props
 * @returns A fully accessible user avatar component
 */
const UserAvatar: React.FC<UserAvatarPropsType> = React.memo(({
// 🔄 CORE PROPS 
  onClickFn,
  isTooltipDisabled,
  initial,

// 📊 DISPLAY PROPS
  userEmail,
  userName,

// ⚙️ CONFIGURATION PROPS
  isDisabled = false,
  size=32,
  id,
  className = ''

}) => {

// ====================
// 🎮 LOCAL UI STATE (Presentation Only)
// ====================
/**
* 💬 Tooltip visibility state
* - Pure UI state, no business logic
* - Managed internally for presentation
*/
const [isTooltipShown, setIsTooltipShown] = useState<boolean>(false);

// 🎯 DOM reference for focus management
const avatarRef = useRef<HTMLDivElement>(null);

// ====================
// 🎮 EVENT HANDLERS
// ====================
const handleInternalClick = useCallback((event:React.MouseEvent<HTMLElement>)=>{
if(isDisabled)return;
onClickFn(event);
},[isDisabled,onClickFn]);

// * 🖱️ Handle mouse enter for tooltip
const handleMouseEnter = ():void => {
if (!isTooltipDisabled && !isDisabled) {
setIsTooltipShown(true);
 }
};

/**
* 🖱️ Handle mouse leave for tooltip
*/
const handleMouseLeave = ():void => {
setIsTooltipShown(false);
};

/**
* ⌨️ ACCESSIBILITY: Keyboard interactions
* Manages Enter, Space, and Escape keys according to W3C ARIA standards
*/
/**
* ⌨️ Handle keyboard interactions (Enter/Space)
* ⌨️ Handle keyboard navigation
* - Supports Enter and Space for accessibility
*/
const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
if (isDisabled) return; 

if (event.key === 'Enter' || event.key === ' ') {
 event.preventDefault();
 handleInternalClick(event as unknown as React.MouseEvent<HTMLElement>);
 }

if (event.key === 'Escape') {
 // event.preventDefault();
 setIsTooltipShown(false);
 }
};
/**
* 📱 Handle touch events for mobile devices
*/
const handleTouchStart=():void=>{
// Show tooltip briefly on touch (mobile pattern)
if (!isTooltipDisabled && !isDisabled) {
 setIsTooltipShown(true);
 setTimeout(()=>setIsTooltipShown(false),2000)
 }
};

// ====================
// 🎨 COMPUTED VALUES
// ====================
/**
* 🎯 Determine what to show in tooltip*
*  📌 Priority Order:
* 1. Username (most user-friendly)
* 2. Email (fallback option)
* 3. Initial (last resort)
*/
const tooltipContent:string = userName || userEmail || initial;

// 🎨 Compute CSS classes dynamically
const avatarClasses: string = [
styles.avatar,
isDisabled ? styles.disabled : '',
className
]
.filter(Boolean)//elimina todos los valores "falsy" del array:
.join(' ');

//📏 Apply custom size if provided
const avatarStyle: React.CSSProperties = size
? {
 width: `${size}px`,
 height: `${size}px`,
 fontSize: `${Math.max(12, size / 2.5)}px`
}
: {};

// ♿ ACCESSIBILITY ATTRIBUTES
 const ariaAttributes = {
 'role': 'button',
 'aria-label': 'Open user profile menu',
 'aria-disabled': isDisabled,
 'tabIndex': isDisabled ? -1 : 0
  };

// ====================
// 🎨 RENDER - PURE PRESENTATION
// ====================
return (
<div className={`${styles.badgeContainer} ${className}`}>
{/* 🎯 AVATAR BUTTON */}
 <div
  ref={avatarRef}
  id={id}
  className={avatarClasses}
  style={avatarStyle}
  {...ariaAttributes}
  onClick={handleInternalClick}
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
  onTouchStart={handleTouchStart}
  onKeyDown={handleKeyDown}
  data-testid="user-avatar"
>
{/* 👤 AVATAR INITIAL */}
<span className={styles.avatarInitial} aria-hidden="true">
 {initial}
</span>

{/* 💬 TOOLTIP (Conditional) */}
{isTooltipShown && !isTooltipDisabled && !isDisabled &&(
 <div 
  className={styles.tooltip}
  role="tooltip"
  aria-hidden="true"
 >
  <span className={styles.tooltipContent}>
   {tooltipContent}
  </span>
 <div className={styles.tooltipArrow} />
</div>
  )}
 </div>
</div>
 );
});

// 🏷️ Display name for React DevTools
UserAvatar.displayName = 'UserAvatar';

export default UserAvatar;