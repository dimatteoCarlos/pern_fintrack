import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';
import { CardTitle } from '../../general_components/CardTitle';
import OpenAddEditBtn from '../../general_components/OpenAddEditBtn';
import ListCategory from './components/ListCategory';
import ListPocket from './components/ListPocket';

function Budget() {
  const originRoute = useLocation().pathname;
  const navigateTo: NavigateFunction = useNavigate();

  console.log('Budget');

  //functions
  const createNewCategory = (originRoute: string) => {
    navigateTo(originRoute + '/new_category', {
      state: { previousRoute: originRoute },
    });
  };

  const createNewPocket = (originRoute: string) => {
    navigateTo(originRoute + '/new_pocket', {
      state: { previousRoute: originRoute },
    });
  };

  return (
    <>
      <section className='content__presentation'>
        <div className='cards__presentation '>
          <CardTitle>Category List</CardTitle>

          <ListCategory previousRoute={originRoute}/>

          <OpenAddEditBtn
            btnFunction={createNewCategory}
            btnFunctionArg={originRoute}
            btnPreviousRoute={originRoute}
          >
            <div className='open__btn__label'>New Category</div>
          </OpenAddEditBtn>

          <CardTitle>Pockets</CardTitle>

        <ListPocket previousRoute={originRoute}/>

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

export default Budget;
