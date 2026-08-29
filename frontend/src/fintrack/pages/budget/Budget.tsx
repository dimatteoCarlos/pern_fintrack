//frontend\src/fintrack/pages/budget/Budget.tsx
import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';

import { CardTitle } from '../../general_components/CardTitle';
import OpenAddEditBtn from '../../general_components/OpenAddEditBtn';
import ListCategory from './components/ListCategory';

function Budget() {
  const originRoute = useLocation().pathname;
  const navigateTo: NavigateFunction = useNavigate();
  // console.log('Budget');

  //functions
  const createNewCategory = (originRoute: string) => {
    navigateTo(originRoute + '/new_category', {
      state: { previousRoute: originRoute },
    });
  };

  //--------
  return (
    <>
      <section className='content__presentation'>
        <div className='cards__presentation '>
          {/* COMMENTED pending removal (D13). The same action twice, and this
              copy is the expensive one: it sits above the titles, so its height
              comes out of the list on a short screen. The one after the list
              stays — it is outside the scroll, always in view, and the action
              belongs after the content the reader came to read. */}
          {/* <OpenAddEditBtn
            btnFunction={createNewCategory}
            btnFunctionArg={originRoute}
            btnPreviousRoute={originRoute}
          >
            <div className='open__btn__label'>New Category</div>
          </OpenAddEditBtn> */}

          {/* Four labels for the four cells of a row: name and amounts on the
              first line, remainder and share on the second. */}
          <CardTitle
            legend='Spent / Budget'
            subtitle='Remaining over / left'
            subLegend='% of spent budget'
          >
            Category List
          </CardTitle>

          <ListCategory previousRoute={originRoute} />

          <OpenAddEditBtn
            btnFunction={createNewCategory}
            btnFunctionArg={originRoute}
            btnPreviousRoute={originRoute}
          >
            <div className='open__btn__label'>New Category</div>
          </OpenAddEditBtn>

        </div>
      </section>
    </>
  );
}

export default Budget;
