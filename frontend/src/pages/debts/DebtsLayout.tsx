import DebtsBigBoxResult from './components/DebtsBigBoxResult.tsx';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';

import Debtors from './components/Debtors.tsx';
import './styles/debts-styles.css';

function DebtsLayout() {
  //temporary values------------
  //get the debtors info from, endpoint:
  //data: from debts movements, group the movements by debtor, consolidate the amounts (lend-borrow), also total lent and borrowed by debtor, and general total.
//qui tambien hacer el get promise.allSettled, y la funcion de actualizacion para pasarla a Debtors
  const bigScreenInfo = [{ title: "you're owed", amount: 0 }];

  return (
    <div className='debtsLayout'>
      <div className='layout__header'>
        <div className='headerContent__container'>
          <TitleHeader />
        </div>
      </div>
      <DebtsBigBoxResult bigScreenInfo={bigScreenInfo}></DebtsBigBoxResult>
      <Debtors />
    </div>
  );
}

export default DebtsLayout;
