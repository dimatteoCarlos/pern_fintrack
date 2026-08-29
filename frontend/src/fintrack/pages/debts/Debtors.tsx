import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';
import { CardTitle } from '../../general_components/CardTitle';
import OpenAddEditBtn from '../../general_components/OpenAddEditBtn';
import ListOfDebtors from './components/ListOfDebtors';

// The form has one declared route and the board no longer has two, so the
// destination is the route itself. Appending to the current pathname made the
// button produce a path that only existed from one of the two debts URLs.
const NEW_DEBTOR_ROUTE = '/fintrack/debts/debtors/new_profile';

function Debtors() {
  const originRoute = useLocation().pathname;
  const navigateTo: NavigateFunction = useNavigate();
  // console.log(originRoute);

  //functions
  // The origin still travels in the state: it is where the form returns to,
  // which is not the same question as where the form lives.
  const createNewProfile = (originRoute: string) => {
    navigateTo(NEW_DEBTOR_ROUTE, {
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
