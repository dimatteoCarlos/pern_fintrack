// frontend/src/general_components/listContent/ListContent.tsx
// ====================================
// 🎯 COMPONENT: ListContent
// ===================================

import {
  CURRENCY_OPTIONS,
  DATE_TIME_FORMAT_DEFAULT,
  DEFAULT_CURRENCY,
} from '../../fintrack/helpers/constants';

import {
  capitalize,
  currencyFormat,
  isDateValid,
} from '../../fintrack/helpers/functions';

import { LastMovementType } from '../../pages/overview/components/LastMovements';

import { BoxContainer, BoxRow } from '../boxComponents/BoxComponents';

import './styles/listContent-style.css';

// Default configuration
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

// ====================================
// MAIN COMPONENT
// ====================================
function ListContent({ listOfItems }: { listOfItems: LastMovementType[] }) {
  const formatDate = (dateInput: Date | string | number): string => {
    const date = new Date(dateInput);

    return new Intl.DateTimeFormat(DATE_TIME_FORMAT_DEFAULT).format(date);
  };

  return (
    <div className='listContent__container '>
      {listOfItems.map((item, index) => {
        const { accountName, record, description, date, currency } = item;

        return (
          <BoxContainer key={index} className='listContent__item '>
            {/* ----------------------------------
 📋 HEADER ROW: Account name and amount
 ---------------------------------- */}
            <BoxRow className='listContent__item-header'>
              <span className='listContent__account'>{accountName}</span>
              <span className='listContent__amount'>
                {currencyFormat(currency, record, formatNumberCountry)}
              </span>
            </BoxRow>
            {/* -----------------------------------
📝 DETAILS ROW: Description and date
----------------------------------- */}
            <div className='listContent__details-row'>
              <p className='listContent__description'>
                {capitalize(description)}
              </p>
              {date && isDateValid(date) && (
                <time className='listContent__date'>{formatDate(date)}</time>
              )}
            </div>
          </BoxContainer>
        );
      })}
    </div>
  );
}

export default ListContent;
