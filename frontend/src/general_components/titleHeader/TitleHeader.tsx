import { Link, useLocation } from 'react-router-dom';
import LeftArrowDarkSvg from '../../assets/LeftArrowDarkSvg.svg';
import './titleHeader-style.css';
import { PAGE_LOC_NUM } from '../../helpers/constants.ts';

// /------TitleHeader--------
//title matches with the main route name
export function TitleHeader() {
  const location = useLocation();
  const currentRoute = location.pathname.split('/')[PAGE_LOC_NUM-1];

  return (
    <>
    <div className='title__header__container'>
  
      <Link to={'..'} relative="path" className='iconArrowLeftDark'>
        <LeftArrowDarkSvg />
      </Link>

      <div className='title__header'>{currentRoute}</div>
    </div>
    </>
  );
}
