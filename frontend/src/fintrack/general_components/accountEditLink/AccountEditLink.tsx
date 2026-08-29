// frontend/src/fintrack/general_components/accountEditLink/AccountEditLink.tsx
// ✏️ ACCOUNT EDIT LINK: the control that opens the account editor from a
// detail card.
//
// It replaces a <div id='edit' className='icon3dots'> that four detail screens
// render above a commented-out <Link to='edit'>. That div was not focusable,
// answered no key and carried no state at all, so it could not declare the five
// interactive states the standing rule requires. A control is not a div with a
// handler.
//
// Sibling of AccountActionsTrigger, not a variant of it. That one opens a menu
// and says so — aria-haspopup and aria-expanded. This one navigates, and a
// navigating control that announced a popup would be lying to a screen reader.
//
// A Link and not a button: the destination is a route, so the browser's own
// affordances — focus, Enter, open in a new tab, the status bar preview — come
// for free and a button would have to reimplement them badly.
//
// The developer settled the scope on 2026-08-29: a detail card offers editing
// only. Deleting is reached from accounting alone, so this control never grew
// into the three-option menu — on a detail card that menu loses "view details",
// and without deletion a menu of one option is not a menu.

// '?react' and not the bare form: only that import carries a React type, so the
// glyph can take a className. The bare one is typed as a string.
import EditSvg from '../../../assets/userProfileMenuSvg/editSvg.svg?react';
import { Link } from 'react-router-dom';
import './styles/accountEditLink-styles.css';

type AccountEditLinkPropType = {
 // The account the editor opens. The route owns it; nothing else is needed,
 // because the editor fetches the account itself (EditAccount.tsx:116).
 accountId: string;
 // Where the editor returns after saving or cancelling. The caller states it
 // rather than the editor guessing, so a card returns to itself.
 returnRoute: string;
 // Names the account in the accessible label. A bare "Edit account" says
 // nothing about which one.
 accountName: string;
 // The surface the control sits on, not the colour it paints. Every detail
 // card is on the dark app background; 'light' exists for the cream panels and
 // white headers the same control lands on elsewhere.
 surface?: 'dark' | 'light';
 // Carried through by callers that pass a route the module came from, so a
 // deletion started later returns out of the module rather than to a card
 // whose account no longer exists.
 originRoute?: string;
};

function AccountEditLink({
 accountId,
 returnRoute,
 accountName,
 surface = 'dark',
 originRoute,
}: AccountEditLinkPropType) {
 return (
  <Link
   to={`/fintrack/account/${accountId}/edit`}
   state={{ previousRoute: returnRoute, originRoute }}
   className={`accountEditLink accountEditLink--${surface}`}
   aria-label={`Edit ${accountName}`}
  >
   <EditSvg className='accountEditLink__glyph' aria-hidden='true' />
  </Link>
 );
}

export default AccountEditLink;
