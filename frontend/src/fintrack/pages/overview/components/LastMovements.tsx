// import ChevronRightSvg from '../../../assets/ChevronRightSvg.svg';
// import { Link } from 'react-router-dom';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import ListContent from '../../../general_components/listContent/ListContent.tsx';
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
};

function LastMovements({ data, title }: LastMovementsProps) {
  //Last Movements

  const lastMovementDefault: LastMovementType[] = [
    {
      accountName: 'Account Name',
      record: 0,
      description: 'Description',
      // Null rather than a placeholder word: the row paints a dash, which is
      // what an absent note looks like everywhere else.
      note: null,
      date: new Date(),
      currency: 'usd', transactionId: 0, 
    },
  ];

  const lastMovements = data ? data : lastMovementDefault;

  return (
    <>
      {/*LAST MOVEMENTS  */}
      <article className='goals__last__movements'>
        <div className='presentation__card__title__container'>
          <CardTitle>{title}</CardTitle>
        </div>

        <div className='main__subtitle'>Last 30 days</div>

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
