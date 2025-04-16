import { DATE_TIME_FORMAT_DEFAULT } from '../../helpers/constants';
import { isDateValid } from '../../helpers/functions';
import { BoxContainer, BoxRow } from '../boxComponents';

export type ListContenPropType = {
  listOfItems: {
    categoryName: string;
    record: string;
    description: string;
    date: Date | string | number | undefined | null;
  }[];
  // listOfItems: { [key: string]: string | number | Date }[];
};

function ListContent({ listOfItems }: ListContenPropType) {
  const formatDate = (dateInput: Date | string | number): string => {
    const date = new Date(dateInput);
    return new Intl.DateTimeFormat(DATE_TIME_FORMAT_DEFAULT).format(date);
  };

  return (
    <>
      <div className='list__main__container'>
        {listOfItems.map((item, indx) => {
          const { categoryName, record, description, date } = item;

          return (
            <BoxContainer key={indx}>
              <BoxRow>
                <div className='box__title'>{`${categoryName}`} </div>
                <div className='box__title'>{`${record}`}</div>
              </BoxRow>
              <BoxRow>
                <BoxRow>
                  <div className='flx-row-sb'>
                    <div className='box__subtitle'> {`${description}`} </div>
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
