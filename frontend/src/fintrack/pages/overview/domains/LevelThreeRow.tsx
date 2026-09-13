// frontend/src/fintrack/pages/overview/domains/LevelThreeRow.tsx
//
// One row of a level-2 breakdown: a link to the entity's level-3 screen, or a
// static row when it names no entity (OVERVIEW_DECISIONS.md, P5-6).

import { Link } from 'react-router-dom';

import { LevelThreeLink } from '../helpers/levelThreeLink';
import { NO_SHARE } from '../helpers/rankedBreakdown';

type LevelThreeRowProps = {
 name: string;
 // Formatted by the caller, which knows the currency and the share's scale.
 amount: string;
 share: string;
 link: LevelThreeLink | null;
};

function LevelThreeRow({ name, amount, share, link }: LevelThreeRowProps) {
 const cells = (
  <>
   <span className='levelThreeRow__swatch' aria-hidden='true' />
   <span className='levelThreeRow__name'>{name}</span>
   <span className='levelThreeRow__amount'>{amount}</span>
   <span className='levelThreeRow__share'>{share}</span>
  </>
 );

 if (link === null) {
  return (
   <div className='levelThreeRow levelThreeRow--static'>
    {cells}
    {/* A dash in the chevron's track: the columns stay aligned and the row
        does not pretend to lead anywhere. */}
    <span className='levelThreeRow__nogo' aria-hidden='true'>
     {NO_SHARE}
    </span>
   </div>
  );
 }

 return (
  <Link
   className='levelThreeRow levelThreeRow--linked'
   to={link.to}
   state={link.state}
  >
   {cells}
   <svg
    className='levelThreeRow__go'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
    focusable='false'
   >
    <polyline points='9 5 16 12 9 19' />
   </svg>
  </Link>
 );
}

export default LevelThreeRow;
