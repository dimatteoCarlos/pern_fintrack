import { currencyFormat } from '../../../helpers/functions';

import Dots3LightSvg from '../../../assets/Dots3LightSvg.svg';
import { Link } from 'react-router-dom';
import { CardTitle } from '../../../general_components/CardTitle';
import { StatusSquare } from '../../../general_components/boxComponents';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';

//temporary values------------
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

//Temporary Dummy data
//Saving Goals

const goal = {
  title: 'goal',
  amount: 0,
  status: 'status prediction',
};

const saved = {
  title: 'saved',
  concept: 'Current (w/return)',
  amount: 0,
  actual: 'Actual (no investment)',
};
const remaining = {
  title: 'remaining',
  concept: 'Current (w/return)',
  amount: 0,
  actual: 'Actual (no investment)',
};

//-------

function SavingGoals() {
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
            {currencyFormat(defaultCurrency, goal.amount, formatNumberCountry)}
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
          <div className='tile__title tile__title--goalInfo'>
            {saved.concept}
          </div>
          {/* dynamic */}
          <div className='tile__subtitle'>{saved.actual}</div>
        </div>

        <div className='tile__container tile__container__col tile__container__col--goalInfo'>
          <div className='tile__subtitle'>{remaining.title}</div>
          <div className='tile__title tile__title--goalInfo'>
            {remaining.concept} {/* dynamic */}
          </div>
          <div className='tile__subtitle'>{remaining.actual}</div>{' '}
          {/* dynamic */}
        </div>
      </div>

      {/*---------------- */}
    </article>
  );
}

export default SavingGoals;
