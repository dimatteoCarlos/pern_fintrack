import Overview from './Overview';
import { BigBoxResult } from './components/BigBoxResult';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader';
import './styles/overview-styles.css';
// import { Outlet } from 'react-router-dom';

//
function OverviewLayout() {
  //Temporary Dummy data
  //Saving Goals
  //to be fetched from data bases. Need ENDPOINT to get from backend.
  const bigScreenInfo = [
    { title: 'net worth', amount: 0 },
    { title: 'income', amount: 0 },
    { title: 'expenses', amount: 0 },
  ];

  return (
    <main className='overviewLayout'>
      <div className='layout__header'>
        <div className='headerContent__container'>
          <TitleHeader />{' '}
        </div>
      </div>

      <BigBoxResult bigScreenInfo={bigScreenInfo} />
      {/* <Outlet/> */}
      <Overview />
    </main>
  );
}

export default OverviewLayout;
