// import ChevronRightSvg from '../../../assets/ChevronRightSvg.svg';
// import { Link } from 'react-router-dom';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import ListContent from './ListContent.tsx';
import { CurrencyType } from '../../../types/types.ts';

export type LastMovementType = {
  accountName: string; //category of expense
  record: number; //data or title?
  description: string; //data
  // What the owner typed, split out of description by the server. Null when the
  // row carries none. description stays beside it: the modal shows the whole
  // sentence, the row shows only the note.
  note?: string | null;
  date: Date | string;
  currency: CurrencyType;
  transactionId: number;
};

type LastMovementsProps = {
  data: LastMovementType[] | null;
  title: string;
  // What bounds the list, in the reader's terms. It used to be the fixed
  // sentence "Last 30 days", which was true of the five per-domain lists this
  // component was written for and false of the activity teaser, whose rows are
  // the five most recent whenever they happened.
  subtitle?: string;
};

function LastMovements({
  data,
  title,
  subtitle = 'Last 30 days',
}: LastMovementsProps) {
  //Last Movements

  // An absent list is an empty list, and ListContent renders its own empty
  // state. The placeholder row that stood here published record: 0 and
  // transactionId: 0, so a missing figure read as zero and the row opened the
  // detail of a transaction that does not exist.
  const lastMovements = data ?? [];

  return (
    <>
      {/*LAST MOVEMENTS  */}
      <article className='goals__last__movements'>
        <div className='presentation__card__title__container'>
          <CardTitle>{title}</CardTitle>
        </div>

        <div className='main__subtitle'>{subtitle}</div>

        <ListContent listOfItems={lastMovements} />
      </article>

      {/* <Link className='seeMore' to={'/fintrack/overview/movements/expense'}>
        <div className='link' onClick={() => console.log('See More')}>
          {'See More'}
        </div>
        <ChevronRightSvg />{' '}
      </Link> */}
    </>
  );
}

export default LastMovements;
