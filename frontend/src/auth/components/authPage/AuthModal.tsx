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

import { useCallback, useRef } from 'react';
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
 // A ref and not state: the form reports on every change of its dirtiness, and
 // nothing here renders from it.
 const isDirtyRef = useRef(false);
 const handleDirtyChange = useCallback((isDirty: boolean) => {
  isDirtyRef.current = isDirty;
 }, []);

 const isSignInRef = useRef(authUIProps.isSignInInitial);
 const handleModeChange = useCallback((isSignIn: boolean) => {
  isSignInRef.current = isSignIn;
 }, []);

 // Where the backdrop and Escape land, the two exits a user takes by accident.
 // The Close button is deliberate and closes at once. An empty form asks too,
 // with its own message: there is nothing unsaved to name.
 const requestClose = useCallback(() => {
  const message = isDirtyRef.current
   ? 'You have unsaved changes. Are you sure you want to close?'
   : `Leave sign ${isSignInRef.current ? 'in' : 'up'}? You can come back to it anytime.`;
  if (!window.confirm(message)) return;
  onClose();
 }, [onClose]);

 // A press that starts inside the panel and is released on the backdrop (a text
 // selection dragged past the edge) fires its click on the backdrop; only a
 // press that also started there counts as a click outside.
 const pressStartedOnBackdropRef = useRef(false);

 const { titleId, dialogProps } = useModalDialog({
  onClose: requestClose,
  // The first field and not the panel, which would otherwise put the header's
  // theme toggle one Tab away from the caret. Queried and not named because
  // AuthUI swaps sign-in for sign-up and the first field changes with it:
  // "Username or email" in one mode, "Username" in the other.
  onInitialFocus: (panel) => panel.querySelector('input')?.focus(),
 });

 return createPortal(
  // The backdrop still closes on click, now through the unsaved-changes
  // confirm. The panel stops the bubble so a click inside it is not read as a
  // click on the backdrop.
  <div
   className={styles.modalOverlay}
   onMouseDown={(event) => {
    pressStartedOnBackdropRef.current = event.target === event.currentTarget;
   }}
   onClick={(event) => {
    if (event.target === event.currentTarget && pressStartedOnBackdropRef.current) {
     requestClose();
    }
   }}
  >
   <div
    className={`${styles.modalContent}${isDarkTheme ? ' theme-dark' : ''}`}
    onClick={(event) => event.stopPropagation()}
    {...dialogProps}
   >
    <AuthUI
     {...authUIProps}
     isDarkTheme={isDarkTheme}
     onClose={onClose}
     onDirtyChange={handleDirtyChange}
     onModeChange={handleModeChange}
     titleId={titleId}
    />
   </div>
  </div>,
  document.body
 );
}

export default AuthModal;
