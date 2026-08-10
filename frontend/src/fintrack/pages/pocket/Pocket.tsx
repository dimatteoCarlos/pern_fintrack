//frontend\src/fintrack/pages/pocket/Pocket.tsx
import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';

import { CardTitle } from '../../general_components/CardTitle';
import OpenAddEditBtn from '../../general_components/OpenAddEditBtn';
import ListPocket from './components/ListPocket';

function Pocket() {
  const originRoute = useLocation().pathname;
  const navigateTo: NavigateFunction = useNavigate();
  // console.log('Pocket');

  //functions
  // const createNewCategory = (originRoute: string) => {
  //   navigateTo(originRoute + '/new_category', {
  //     state: { previousRoute: originRoute },
  //   });
  // };

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

          {/* <OpenAddEditBtn
            btnFunction={createNewPocket}
            btnFunctionArg={originRoute}
            btnPreviousRoute={originRoute}
          >
            <div className='open__btn__label'>New Pocket</div>
          </OpenAddEditBtn> */}

          {/* <CardTitle legend='Spent / Pocket'>Category List</CardTitle> */}

          {/* <ListCategory previousRoute={originRoute} /> */}

          <OpenAddEditBtn
            btnFunction={createNewPocket}
            btnFunctionArg={originRoute}
            btnPreviousRoute={originRoute}
          >
            <div className='open__btn__label'>New Pocket</div>
          </OpenAddEditBtn>

          <CardTitle>Pockets</CardTitle>

          <ListPocket previousRoute={originRoute} />

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
