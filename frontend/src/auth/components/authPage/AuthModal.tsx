// frontend/src/auth/components/authPage/AuthModal.tsx

// The auth panel as a real dialog.
//
// It exists as its own component because a hook cannot be called inside the
// `showModal &&` branch that used to hold this markup in AuthPage. Mounting and
// unmounting with that flag is also what makes the focus return fire at all:
// the caret goes back to whatever opened the modal when this unmounts.
//
// Portalled into document.body, like the four pocket modals. useModalDialog
// sets `inert` on #root, and a dialog left inside #root would go inert with it.

import { createPortal } from 'react-dom';

import AuthUI, { AuthUIPropsType } from './AuthUI';
import { useModalDialog } from '../../../hooks/useModalDialog';
import styles from './styles/authPage.module.css';

// onClose is optional on AuthUI, which has its own close button; here it is the
// dialog's only exit and Escape depends on it.
type AuthModalPropsType = Omit<AuthUIPropsType, 'titleId'> & {
 onClose: () => void;
};

function AuthModal({ onClose, isDarkTheme, ...authUIProps }: AuthModalPropsType) {
 const { titleId, dialogProps } = useModalDialog({
  onClose,
  // The first field and not the panel, which would otherwise put the header's
  // theme toggle one Tab away from the caret. Queried and not named because
  // AuthUI swaps sign-in for sign-up and the first field changes with it:
  // "Username or email" in one mode, "Username" in the other.
  onInitialFocus: (panel) => panel.querySelector('input')?.focus(),
 });

 return createPortal(
  // The backdrop closes on click, as it always did. The panel stops the
  // bubble so a click inside it is not read as a click on the backdrop.
  <div className={styles.modalOverlay} onClick={onClose}>
   <div
    className={`${styles.modalContent}${isDarkTheme ? ' theme-dark' : ''}`}
    onClick={(event) => event.stopPropagation()}
    {...dialogProps}
   >
    <AuthUI
     {...authUIProps}
     isDarkTheme={isDarkTheme}
     onClose={onClose}
     titleId={titleId}
    />
   </div>
  </div>,
  document.body
 );
}

export default AuthModal;
