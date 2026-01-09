//frontend/src/auth/components/UserProfileBadge.tsx
//UserProfileBadge:shows user data profile in the header

import { useAuthStore } from "../../stores/useAuthStore"

import styles from './UserProfileBadge.module.css';

const UserProfileBadge = () => {
//Get user data from global store
const userData = useAuthStore((state)=>state.userData)
//Check if authenticated
const isAuthenticated = useAuthStore((state)=>state.isAuthenticated)
if(!isAuthenticated){return null;}
//Get the initial letter of user first name
const userLabel = userData?.user_firstname || userData?.user_lastname || userData?.username;
console.log({userLabel})

const initial = userLabel ? userLabel.charAt(0).toUpperCase() : 'P';//'👤';'📝';🖊️;➜]

  return (
    <>
    <div className={styles.badgeContainer}>
     <div className={styles.userAvatar}>{initial}
     </div>
     {/* <div className={styles.userInfo}>
      <span className={styles.userName}>{userLabel?.toUpperCase()}
     </span>
     
     <span className={styles.userEmail}>{userData?.email}</span>
     </div> */}
    </div>
     
    </>
  )
}

export default UserProfileBadge