import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';
import { CardTitle } from '../../../general_components/CardTitle';
import OpenAddEditBtn from '../../../general_components/OpenAddEditBtn';
import ListOfDebtors from './ListOfDebtors';

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
        <div className='debts cards__presentation '>
          <OpenAddEditBtn
            btnFunction={createNewProfile}
            btnFunctionArg={originRoute}
            btnPreviousRoute={originRoute}
          >
            <div className='open__btn__label'>New Debtor</div>
          </OpenAddEditBtn>
          
          <CardTitle>Summary</CardTitle>

          <ListOfDebtors
            previousRoute={originRoute}
            accountType={'debtor'}
          
          ></ListOfDebtors>
        </div>
      </section>
    </>
  );
}

export default Debtors;
