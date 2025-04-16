import { BoxContainer, BoxRow } from './boxComponents';
import { currencyFormat } from '../../../helpers/functions';
import { useFetch } from '../../../hooks/useFetch';
import { DebtorType, DebtsType } from '../../../types/types';
import { url_debtors_debt } from '../../../endpoints';
import { StatusSquare } from '../../../general_components/boxComponents';
import { Link } from 'react-router-dom';

export type DebtsToRender = {
  type?: DebtorType;
  debtor_name: string;
  total_amount_borrowed: number;
  total_amount_lent: number;
  net_amount: number;
  currency?: string;
  transaction_count?: number;
  debtor_id?: number;
};

const typeOfDebtorfn = (borrowed: number, lent: number): DebtorType => {
  const diff = lent - borrowed;
  // const type = diff > 0 ? 'debtor' : diff < 0 ? 'lender' : 'none';
  const type = diff >= 0 ? 'debtor' : 'lender'; //debtor y lender usar constantes

  return type;
};

//Temporarily Dummy data
const defaultDebts: DebtsToRender[] = [
  {
    debtor_name: 'name',
    debtor_id: 2,

    total_amount_borrowed: 0,
    total_amount_lent: 0,
    net_amount: 0,
    type: 'debtor',
  },
  {
    debtor_name: 'name',
    debtor_id: 1,

    total_amount_borrowed: 0,
    total_amount_lent: 0,
    net_amount: 0,
    type: 'lender',
  },
  {
    debtor_name: 'name',
    debtor_id: 3,

    total_amount_borrowed: 0,
    total_amount_lent: 0,
    net_amount: 0,
    type: 'debtor',
  },
  {
    debtor_name: 'name',
    debtor_id: 11,

    total_amount_borrowed: 0,
    total_amount_lent: 0,
    net_amount: 0,
    type: 'debtor',
  },
  {
    debtor_name: 'name',
    debtor_id: 10,

    total_amount_borrowed: 0,
    total_amount_lent: 0,
    net_amount: 0,
    type: 'lender',
  },
];

function ListOfDebtors() {
   //DATA FETCHING
  const { data, isLoading, error } = useFetch<DebtsType>(url_debtors_debt);
  console.log('data:', data);

  const debtList: DebtsToRender[] =
    data && !isLoading && !error && data.result?.length
      ? data.result.map((debt) => {
          const {
            debtor_name,
            total_amount_borrowed,
            total_amount_lent,
            net_amount,
            debtor_id,
          } = debt;

          return {
            debtor_name,
            total_amount_borrowed,
            total_amount_lent,
            net_amount,
            type: typeOfDebtorfn(total_amount_borrowed, total_amount_lent),
            debtor_id,
          };
        })
      : defaultDebts;

  return (
    <>
      <article className='list__main__container'>
        {debtList.map((debtor, indx) => {
          const {
            debtor_name: name,
            total_amount_borrowed,
            total_amount_lent,
            net_amount,
            debtor_id,
          } = debtor;
          const transactionType =
            -total_amount_borrowed + total_amount_lent < 0
              ? 'lender'
              : 'debtor';
          return (
            <BoxContainer key={indx}>
              <BoxRow>
                <Link to={`/debts/debtors/:${debtor_id}`}>
                  <div className='debtor box__title hover'>{name}</div>
                </Link>
                <div className='box__title'>
                  {' '}
                  {currencyFormat('usd', net_amount, 'en-US')}
                </div>
              </BoxRow>

              <BoxRow>
                <BoxRow>
                  <div className='flx-row-sb'>
                    <StatusSquare
                      alert={transactionType == 'lender' ? 'alert' : ''}
                    />
                    <div className='box__subtitle'>
                      &nbsp; {transactionType}{' '}
                    </div>
                  </div>
                </BoxRow>
              </BoxRow>
            </BoxContainer>
          );
        })}
      </article>
    </>
  );
}

export default ListOfDebtors;
