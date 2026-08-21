// frontend/src/fintrack/general_components/accountActionsTrigger/AccountActionsTrigger.tsx
// ⋯ ACCOUNT ACTIONS TRIGGER: the control that opens AccountActionsMenu
//
// It replaces a <div className='icon3dots'> that six screens render. That div
// was not focusable, not operable by keyboard, and carried no state at all —
// .icon3dots is padding and nothing else, declared twice at that
// (forms-styles.css:327, accountingDashboard-styles.css:163), in hardcoded
// rems. A control that opens a menu has to be a button.
//
// Its own BEM block rather than the old class name: keeping `icon3dots` would
// make this component fight both page stylesheets for every declaration, and
// which one won would depend on the order the lazy routes loaded their CSS.
// The two old rules stay where they are until the cleanup block (D13).
//
// AccountingBox.tsx is its first caller. The developer opened the
// PLAN_EDIT_BLOCK.md §2 boundary on 2026-08-20.

// '?react' and not the bare form: only that door carries a React type, so the
// glyph can take a className (R34). The bare import is typed as a string.
import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg?react';
import './styles/accountActionsTrigger-styles.css';

type AccountActionsTriggerPropType = {
 // Carries the event: a caller whose whole card is clickable needs it to stop
 // the bubble, or the menu opens twice on one press.
 onClick: (event: React.MouseEvent) => void;
 // Names the account in the accessible label. A bare "Account actions" repeated
 // down a list says nothing about which row it belongs to.
 accountName: string;
 // The surface the button sits on, not the colour it paints. Every current
 // caller is on the dark app background; 'light' exists for the cream panels
 // and white headers the same control lands on elsewhere.
 surface?: 'dark' | 'light';
 // Whether the menu it opens is currently open. Announced, not styled.
 isOpen?: boolean;
 disabled?: boolean;
};

function AccountActionsTrigger({
 onClick,
 accountName,
 surface = 'dark',
 isOpen = false,
 disabled = false,
}: AccountActionsTriggerPropType) {
 return (
  <button
   type='button'
   className={`accountActionsTrigger accountActionsTrigger--${surface}`}
   onClick={onClick}
   disabled={disabled}
   aria-label={`Account actions for ${accountName}`}
   aria-haspopup='menu'
   aria-expanded={isOpen}
  >
   <Dots3LightSvg className='accountActionsTrigger__glyph' />
  </button>
 );
}

export default AccountActionsTrigger;
