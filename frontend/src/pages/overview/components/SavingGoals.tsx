import { numberFormatCurrency } from '../../../helpers/functions';

import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
import { Link } from 'react-router-dom';
import { CardTitle } from '../../../general_components/CardTitle';
import { StatusSquare } from '../../../general_components/boxComponents';
import { BalancePocketRespType } from '../../../types/responseApiTypes';
import { DEFAULT_CURRENCY } from '../../../helpers/constants';

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
// const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
//Temporary Dummy data
//Saving Goals
//-------

function SavingGoals({ data }: { data: BalancePocketRespType | null }) {
  console.log(data);

  const defaultValues = {
    total_balance: 0,
    total_target: 0,
    total_remaining: 0,
    currency_code: defaultCurrency,
  };

  const {
    total_balance = defaultValues.total_balance,
    total_target = defaultValues.total_target,
    total_remaining = defaultValues.total_remaining,
    currency_code = defaultValues.currency_code,
  } = data?.data || defaultValues;

  const goal = {
    title: 'goal',
    amount: numberFormatCurrency(total_target!, 2, currency_code), //REVISAR
    status: 'status prediction',
  };
  const saved = {
    title: 'saved',
    concept: 'Current (w/return)',
    amount: numberFormatCurrency(total_balance!, 2, currency_code),
    actual: 'Actual (no investment)',
  };
  const remaining = {
    title: 'remaining',
    concept: 'Current (w/return)',
    amount: numberFormatCurrency(total_remaining!, 2, currency_code),
    actual: 'Actual (no investment)',
  };

  return (
    <article className='goals__main__info'>
      <div className='presentation__card__title__container main flx-row-sb'>
        <CardTitle>Saving Goals</CardTitle>
        <div className='presentation__card--title'></div>
        <Link className='flx-col-center icon ' to={'edit'}>
          <Dots3LightSvg />{' '}
        </Link>
      </div>

      {/* SAVING GOALS component  */}

      {/* GOALS HEAD INFO  */}
      <div className='tile__container tile__container--goal'>
        <div className='tile__container__col'>
          <div className='tile__subtitle'>{goal.title}</div>
        </div>

        <div className='tile__container__col'>
          <div className='tile__title'>
            {/* 0,000.00 */}
            {goal.amount}
            {/* {currencyFormat(defaultCurrency, goal.amount, formatNumberCountry)} */}
          </div>
          <div className='tile__status__container flx-row-sb'>
            <StatusSquare
              alert={0.5 - Math.random() < 0 ? 'alert' : ''} //temporary values
            ></StatusSquare>

            <div className='tile__subtitle tile__status--goal'>
              {goal.status}
            </div>
          </div>
        </div>
      </div>

      {/* GOALS INDICATORS  */}
      {/* Goal info  row card  w first 2 cards */}

      <div className='tiles__container flx-row-sb '>
        <div className='tile__container tile__container__col tile__container__col--goalInfo'>
          <div className='tile__subtitle'>{saved.title}</div>
          <div
            className='tile__title tile__title--goalInfo'
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              width: '100%',
            }}
          >
            <div className=''>{saved.concept}</div>{' '}
            <div className=''>{saved.amount}</div>
          </div>

          <div className='tile__subtitle'>{saved.actual}</div>
        </div>

        <div className='tile__container tile__container__col tile__container__col--goalInfo'>
          <div className='tile__subtitle'>{remaining.title}</div>
          <div
            className='tile__title tile__title--goalInfo '
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              width: '100%',
            }}
          >
            <div className=''>{remaining.concept} </div>
            <div className=''>{remaining.amount}</div>
          </div>
          <div className='tile__subtitle'>{remaining.actual}</div>{' '}
        </div>
      </div>

      {/*---------------- */}
    </article>
  );
}

export default SavingGoals;
