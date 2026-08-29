//frontend\src/fintrack/pages/pocket/Pocket.tsx
import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';

import { CardTitle } from '../../general_components/CardTitle';
import OpenAddEditBtn from '../../general_components/OpenAddEditBtn';
import ListPocket from './components/ListPocket';

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
          <CardTitle>Pockets</CardTitle>

          <ListPocket previousRoute={originRoute} />

          {/* One create control, and this is the one that stays. The second
              copy sat above the title, so its height came out of the list on a
              short screen; this one is outside the scroll, always in view, and
              the action belongs after the content the reader came to read. The
              budget board settled the same question the same way. */}
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
