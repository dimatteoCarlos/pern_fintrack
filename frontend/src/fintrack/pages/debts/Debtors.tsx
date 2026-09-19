import { NavigateFunction, useLocation, useNavigate } from 'react-router-dom';
import { CardTitle } from '../../general_components/CardTitle';
import OpenAddEditBtn from '../../general_components/OpenAddEditBtn';
import ListOfDebtors from './components/ListOfDebtors';
import ExportMenu from '../../general_components/exportMenu/ExportMenu';
import { downloadDebtExport } from '../../api/exportApi';

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
      viewTransition: true,
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

          {/* The heading and the trigger share one line. The row is the
              wrapper's job and not CardTitle's: that component titles twelve
              screens, and a menu passed as its `legend` would render a <ul>
              inside the heading element.

              No month travels: this module has no month control and its list is
              not cut by one, so the server resolves the month it reports on. */}
          <div className='debtsSummaryBar'>
            <CardTitle>Summary</CardTitle>

            <ExportMenu
              subject='the debtor list'
              surface='dark'
              onExport={(format) => downloadDebtExport({ format })}
            />
          </div>

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
