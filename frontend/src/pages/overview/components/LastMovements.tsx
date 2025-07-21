// import ChevronRightSvg from '../../../assets/ChevronRightSvg.svg';
// import { Link } from 'react-router-dom';
import { CardTitle } from '../../../general_components/CardTitle.tsx';
import ListContent from '../../../general_components/listContent/ListContent.tsx';
import { CurrencyType } from '../../../types/types.ts';

export type LastMovementType = {
  accountName: string; //category of expense
  record: number; //data or title?
  description: string; //data
  date: Date | string;
  currency: CurrencyType;
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
      date: new Date(),
      currency: 'usd',
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
