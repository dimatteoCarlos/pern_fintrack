// frontend/src/fintrack/pages/forms/pocketDetail/deletePocketModal/DeletePocketModal.tsx
// 🗑️ DELETE POCKET: the confirmation, and what the deletion released.
//
// A modal and not a route, unlike the editor beside it. The editor needs an
// addressable slot because it is a screen the owner can come back to; this is
// one decision taken on the card the owner is already standing on, and a route
// would unmount that card to ask a yes-or-no question.
//
// Two panes rather than two screens: the question, then the answer. The answer
// is the server's own figures — what each account got back — and it is shown
// rather than assumed, because the confirmation made that promise and the
// result is what keeps it.
//
// Nothing here is destructive of money and the copy does not pretend otherwise.
// A pocket never held cash: an account committed cash to a goal, and deleting
// the goal stops that commitment. The account's balance does not move by a
// cent, and the deletion is never refused for a non-zero net.

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { deletePocket } from '../../../../api/pocketApi.ts';
import { usePocketBoardStore } from '../../../../stores/usePocketBoardStore.ts';
import { usePocketDetailStore } from '../../../../stores/usePocketDetailStore.ts';
import { normalizeError } from '../../../../helpers/normalizeError.ts';
import { numberFormatCurrency } from '../../../../helpers/functions.ts';
import { CurrencyType } from '../../../../types/types.ts';
import { DeletePocketResult } from '../../../../types/pocketTypes.ts';
import { useModalDialog } from '../../../../../hooks/useModalDialog.ts';

import './styles/deletePocketModal-styles.css';


// Where the owner lands once the pocket is gone. Not the card they came from:
// that card describes a pocket that no longer exists.
const BOARD_ROUTE = '/fintrack/pocket';

type DeletePocketModalPropType = {
 pocketId: number;
 pocketName: string;
 // The pocket's own accounting currency, which is the unit every freed figure
 // comes back in.
 currency: CurrencyType;
 // Dismisses the question. Not called once the deletion has run — from there
 // the only way out is the board.
 onClose: () => void;
};

function DeletePocketModal({
 pocketId,
 pocketName,
 currency,
 onClose,
}: DeletePocketModalPropType) {
 const navigateTo = useNavigate();
 const confirmRef = useRef<HTMLButtonElement>(null);

 const [isDeleting, setIsDeleting] = useState<boolean>(false);
 const [result, setResult] = useState<DeletePocketResult | null>(null);
 const [errorMessage, setErrorMessage] = useState<string | null>(null);

 // The behaviour this file used to carry itself, now stated once. No initial
 // focus is named, which leaves the hook holding the caret on the panel: a
 // destructive question whose dangerous answer is already focused is answered
 // by a stray Enter, and that is not an answer.
 //
 // canClose does what the Escape handler here did. Escape closes the question;
 // it does not close the result, because the pocket is gone by then and the
 // card behind describes something that no longer exists -- the only exit from
 // that pane is the one that navigates.
 //
 // The title id is generated rather than the module constant it replaces: that
 // string was shared by every instance, so two panels open at once would both
 // name the first heading.
 const { titleId, dialogProps } = useModalDialog({
  onClose,
  canClose: result === null && !isDeleting,
 });

 const asMoney = (value: number) => numberFormatCurrency(value, 2, currency);

 async function onConfirm() {
  setIsDeleting(true);
  setErrorMessage(null);

  try {
   const deleted = await deletePocket(pocketId);
   setResult(deleted);
  } catch (error) {
   console.error('🔥 Error deleting the pocket', error);
   const { message } = normalizeError(error);
   setErrorMessage(message);
  } finally {
   setIsDeleting(false);
  }
 }

 // The board is asked again rather than marked stale, because this is the one
 // write that lands the owner ON the board: marking it stale would leave the
 // deleted pocket on screen until something else triggered a fetch. Asking here
 // and navigating immediately still costs one request — the board's own mount
 // finds the request already in flight and does not issue a second.
 //
 // The detail store is emptied because what it holds is a pocket that no longer
 // exists, and the next pocket opened must not flash this one's figures.
 function onFinish() {
  usePocketDetailStore.getState().clear();
  void usePocketBoardStore.getState().refreshBoard();

  navigateTo(BOARD_ROUTE);
 }

 return createPortal(
  <div className='pocketDelete__overlay'>
   <div className='pocketDelete__panel' {...dialogProps}>
    {result === null ? (
     <>
      <h2 className='pocketDelete__title' id={titleId}>
       Delete {pocketName}?
      </h2>

      <p className='pocketDelete__body'>
       The goal goes away and every account funding it stops holding cash for
       it. No balance moves — the money was only ever committed, and it goes
       back to being unassigned.
      </p>

      {errorMessage && (
       <p className='pocketDelete__error' role='alert'>
        {errorMessage}
       </p>
      )}

      <div className='pocketDelete__actions'>
       <button
        type='button'
        className='pocketDelete__button pocketDelete__button--quiet'
        onClick={onClose}
        disabled={isDeleting}
       >
        Keep it
       </button>

       <button
        type='button'
        className='pocketDelete__button pocketDelete__button--confirm'
        onClick={() => void onConfirm()}
        disabled={isDeleting}
        ref={confirmRef}
       >
        {isDeleting ? 'Deleting…' : 'Delete pocket'}
       </button>
      </div>
     </>
    ) : (
     <>
      <h2 className='pocketDelete__title' id={titleId}>
       {result.name} is gone
      </h2>

      {result.freed.length === 0 ? (
       <p className='pocketDelete__body'>
        Nothing had been committed to it, so nothing came back.
       </p>
      ) : (
       <>
        <p className='pocketDelete__body'>
         This cash is unassigned again:
        </p>

        <ul className='pocketDelete__freed'>
         {result.freed.map((account) => (
          <li className='pocketDelete__freedRow' key={account.accountId}>
           <span className='pocketDelete__freedName'>
            {account.accountName}
           </span>
           <span className='pocketDelete__freedAmount'>
            {asMoney(account.freedCash)}
           </span>
          </li>
         ))}
        </ul>
       </>
      )}

      <div className='pocketDelete__actions'>
       <button
        type='button'
        className='pocketDelete__button pocketDelete__button--confirm'
        onClick={onFinish}
       >
        Back to pockets
       </button>
      </div>
     </>
    )}
   </div>
  </div>,
  document.body,
 );
}

export default DeletePocketModal;
