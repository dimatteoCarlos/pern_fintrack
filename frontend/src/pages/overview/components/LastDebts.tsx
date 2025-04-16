import ChevronRightSvg from '../../../assets/ChevronRightSvg.svg';
import { CardTitle } from '../../../general_components/CardTitle';
import { Link } from 'react-router-dom';
import ListMovementContent from '../../../general_components/listContent/ListContent';

function LastDebts() {
  //Last Debts
  const latestDebtsrecords = [
    {
      categoryName: 'Category Name',
      record: 'Record',
      description: 'Description',
      date: new Date(),
    },

    {
      categoryName: 'Category Name',
      record: 'Record',
      description: 'Description',
      date: new Date(),
    },
    {
      categoryName: 'Category Name',
      record: 'Record',
      description: 'Description',
      date: new Date(),
    },
    {
      categoryName: 'Category Name',
      record: 'Record',
      description: 'Description',
      date: new Date(),
    },
  ];

  return (
    <>
      {/*LAST DEBTS  */}
      <article className='goals__last__movements'>
        <div className='presentation__card__title__container flx-row-sb'>
          <CardTitle>Last Debts</CardTitle>
          {/* <CardTitle><div className='main__subtitle'>Last 30 days</div></CardTitle> */}
        </div>

        <div className='main__subtitle'>{'Latest records'}</div>

        <ListMovementContent listOfItems={latestDebtsrecords} />
      </article>

      <Link className='seeMore' to={'/overview/movements/debt'}>
        <div className='link'>{'See More'}</div> <ChevronRightSvg />{' '}
      </Link>
    </>
  );
}

export default LastDebts;
