import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';
import { CardTitle } from '../../../general_components/CardTitle';
import OpenAddEditBtn from '../../../general_components/OpenAddEditBtn';
import ListOfDebtors from './ListOfDebtors';

//shares css styles from general styles and budget styles

function Debtors() {
  const originRoute = useLocation().pathname;
  const navigateTo: NavigateFunction = useNavigate();
  // console.log(originRoute);

  //functions
  const createNewProfile = (originRoute: string) => {
    navigateTo(originRoute + '/new_profile', {
      state: { previousRoute: originRoute },
    });
  };

  return (
    <>
      <section className='content__presentation'>
        <div className='cards__presentation'>
          <CardTitle>Summary</CardTitle>

          <ListOfDebtors></ListOfDebtors>

          <OpenAddEditBtn
            btnFunction={createNewProfile}
            btnFunctionArg={originRoute}
            btnPreviousRoute={originRoute}
          >
            <div className='open__btn__label'>New Debtor</div>
          </OpenAddEditBtn>
        </div>
      </section>
    </>
  );
}

export default Debtors;
