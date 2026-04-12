import { Link } from 'react-router-dom';
import LeftArrowDarkSvg from '../../../assets/LeftArrowDarkSvg.svg';

type ChildrenPropType = { children?: React.ReactNode; previousRoute: string };
//-----------------------------------
export function SeeMore({ children, 
  // previousRoute

 }: ChildrenPropType) {
  function onClickHandler() {
    console.log(
      'Message:',
      'See More is a wraping component to render its children'
    );
  }

  const currentRoute = location.pathname;
  console.log('cur', currentRoute);
  const previousPage = currentRoute.split('/').slice(1, 3).join('/');
  console.log('🚀 ~ SeeMore ~ previousPage:', previousPage);

  return (
    <div className='see_more'>
      <button
        onClick={onClickHandler}
        style={{ backgroundColor: 'white', color: 'brown', padding: '0.5rem' }}
      >
        <Link
          to='/fintrack/overview'
          relative='path'
          className='iconArrowLeftDark'
        >
          <LeftArrowDarkSvg />
        </Link>
        {children}
      </button>
    </div>
  );
}
