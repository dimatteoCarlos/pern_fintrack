// frontend/src/fintrack/pages/forms/pocketDetail/PocketEditLink.tsx
// ✏️ POCKET EDIT LINK: the control that opens the pocket editor from the
// pocket's detail card.
//
// A sibling of the account edit link rather than a use of it. That one
// navigates to a hardcoded `/fintrack/account/${accountId}/edit`, and handing
// it a pocket id would resolve that id as an ACCOUNT id — the exact id-space
// substitution the detail screen was rewritten to remove. Pocket ids and
// account ids are separate sequences that both start at 1, so the mistake would
// have no symptom to catch it.
//
// It borrows that control's stylesheet instead of copying it. The two are one
// visual object with one set of interactive states, and a second copy of those
// five states is a copy that drifts; extracting the shared primitive is its own
// scheduled piece of work.
//
// A Link and not a button: the destination is a route, so focus, Enter, open in
// a new tab and the status-bar preview come from the browser, and a button
// would have to reimplement all four badly.

// '?react' and not the bare form: only that import carries a React type, so the
// glyph can take a className. The bare one is typed as a string.
import EditSvg from '../../../../assets/userProfileMenuSvg/editSvg.svg?react';
import { Link } from 'react-router-dom';
import '../../../general_components/accountEditLink/styles/accountEditLink-styles.css';

type PocketEditLinkPropType = {
 // The pocket the editor opens. A pocket id, never an account id.
 pocketId: number;
 // Where the editor returns after saving or cancelling. The caller states it
 // rather than the editor guessing, so the card returns to itself.
 returnRoute: string;
 // Names the pocket in the accessible label. A bare "Edit pocket" says nothing
 // about which one.
 pocketName: string;
};

function PocketEditLink({
 pocketId,
 returnRoute,
 pocketName,
}: PocketEditLinkPropType) {
 return (
  <Link
   to={`/fintrack/pocket/pockets/${pocketId}/edit`}
   state={{ previousRoute: returnRoute }}
   className='accountEditLink accountEditLink--dark'
   aria-label={`Edit ${pocketName}`}
  >
   <EditSvg className='accountEditLink__glyph' aria-hidden='true' />
  </Link>
 );
}

export default PocketEditLink;
