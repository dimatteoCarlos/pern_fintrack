import { Link, useLocation } from 'react-router-dom';
import LeftArrowDarkSvg from '../../../assets/LeftArrowDarkSvg.svg';
import './titleHeader-style.css';
import { PAGE_LOC_NUM } from '../../helpers/constants.ts';

// /------TitleHeader--------
//title matches with the main route name
export function TitleHeader() {
  const location = useLocation();
  const currentRoute = location.pathname.split('/')[PAGE_LOC_NUM - 1];

  return (
    <>
      <div className='title__header__container'>
        {/* The link held nothing but a glyph, so it was announced as an unnamed
            link -- on four layouts, this being the header they share. */}
        <Link
          to={'..'}
          relative='path'
          className='iconArrowLeftDark'
          aria-label='Go back'
        >
          <LeftArrowDarkSvg aria-hidden='true' />
        </Link>

        {/* The screen's own name, and the only page-level title these four
            layouts have. As a div it was not a heading, so Budget, Pocket,
            Debts and Overview had no h1 at all and every CardTitle below hung
            off nothing. Each rule for this class selects the class, so the tag
            changes and the appearance does not. */}
        <h1 className='title__header'>{currentRoute}</h1>
      </div>
    </>
  );
}
