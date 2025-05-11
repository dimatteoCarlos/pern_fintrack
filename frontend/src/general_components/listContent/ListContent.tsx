import {
  CURRENCY_OPTIONS,
  DATE_TIME_FORMAT_DEFAULT,
  DEFAULT_CURRENCY,
} from '../../helpers/constants';
import {
  capitalize,
  currencyFormat,
  isDateValid,
  truncateText,
} from '../../helpers/functions';
import { LastMovementType } from '../../pages/overview/components/LastMovements';
import { BoxContainer, BoxRow } from '../boxComponents';

// Configuración por defecto
const defaultCurrency = DEFAULT_CURRENCY;
const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

//-----------------
function ListContent({ listOfItems }: { listOfItems: LastMovementType[] }) {
  const formatDate = (dateInput: Date | string | number): string => {
    const date = new Date(dateInput);
    return new Intl.DateTimeFormat(DATE_TIME_FORMAT_DEFAULT).format(date);
  };

  return (
    <>
      <div className='list__main__container'>
        {listOfItems.map((item, indx) => {
          const { accountName, record, description, date, currency } = item;

          return (
            <BoxContainer key={indx}>
              <BoxRow>
                <div className='box__title'>{`${accountName}`} </div>
                <div className='box__title'>
                  {currencyFormat(currency, record, formatNumberCountry)}
                </div>
              </BoxRow>
              <BoxRow>
                <BoxRow>
                  <div className='flx-row-sb'>
                    <div
                      className='box__subtitle'
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: '200',
                        lineHeight: '1rem',
                        letterSpacing: '1px',
                        textTransform: 'none',
                      }}
                    >
                      {' '}
                      {truncateText(capitalize(description), 150)}
                    </div>
                  </div>
                </BoxRow>

                {date && isDateValid(date) && (
                  <div className='box__subtitle'>{formatDate(date)}</div>
                )}
              </BoxRow>
            </BoxContainer>
          );
        })}
      </div>
    </>
  );
}

export default ListContent;
