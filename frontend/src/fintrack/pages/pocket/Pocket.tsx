//frontend\src/fintrack/pages/pocket/Pocket.tsx
import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';

import OpenAddEditBtn from '../../general_components/OpenAddEditBtn';
import ListPocket from './components/ListPocket';
import { PocketBoardReadings } from './components/PocketBigBoxResult';

function Pocket() {
 const originRoute = useLocation().pathname;
 const navigateTo: NavigateFunction = useNavigate();

 //functions
 const createNewPocket = (originRoute: string) => {
  navigateTo(originRoute + '/new_pocket', {
   state: { previousRoute: originRoute },
  });
 };
 //--------
 return (
  <>
   <section className='content__presentation'>
    <div className='cards__presentation '>
     {/* The page's one scroller, and it starts under the progress bar. The
         two reading cards, the toolbar and the pocket cards pass under the
         summary held above; the list's own overflow was removed rather than
         nested inside this one, because the inner scroller wins and the
         toolbar would never move. */}
     <div className='pocketBoard__scroller'>
      <PocketBoardReadings />

      <ListPocket previousRoute={originRoute} />
     </div>

     {/* One create control, and this is the one that stays. It sits OUTSIDE
         the scroller: it is the page's primary action, and scrolling it away
         costs the owner a scroll to reach the thing the screen exists to let
         them do. The budget board settled the same question the same way. */}
     <OpenAddEditBtn
      btnFunction={createNewPocket}
      btnFunctionArg={originRoute}
      btnPreviousRoute={originRoute}
     >
      <div className='open__btn__label'>New Pocket</div>
     </OpenAddEditBtn>
    </div>
   </section>
  </>
 );
}

export default Pocket;
