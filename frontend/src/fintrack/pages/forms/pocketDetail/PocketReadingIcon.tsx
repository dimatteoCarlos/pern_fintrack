// frontend/src/fintrack/pages/forms/pocketDetail/PocketReadingIcon.tsx
// The glyph beside a status reading on the pocket detail screen.
//
// Drawn here rather than imported as four .svg assets: each is a handful of
// paths on one 24-grid, they are consumed by one screen, and as assets they
// would need `?react` and four files to carry what one switch carries.
//
// Every stroke is currentColor, so the glyph takes the ink of the sentence it
// sits in and never introduces a colour of its own. aria-hidden because the
// reading beside it already says the state in words: announcing the glyph would
// read the state out twice.

import { PocketStatusLevel } from '../../../helpers/pocketStatus.ts';

type PocketReadingIconPropType = {
 level: PocketStatusLevel;
 className?: string;
};

function PocketReadingIcon({ level, className }: PocketReadingIconPropType) {
 return (
  <svg
   className={className}
   viewBox='0 0 24 24'
   fill='none'
   aria-hidden='true'
   focusable='false'
  >
   {level === 'funded' && (
    <>
     <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='1.75' />
     <path
      d='m7.75 12.25 2.75 2.75 5.75-6'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
     />
    </>
   )}

   {/* The account no longer covers what is committed, and the date reading in
       its failed state. A triangle, which is the one shape here that does not
       depend on colour to read as a warning. */}
   {level === 'offPlan' && (
    <>
     <path
      d='M12 3.75 2.75 20h18.5L12 3.75Z'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinejoin='round'
     />
     <path
      d='M12 10v4M12 17.25v.01'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinecap='round'
     />
    </>
   )}

   {/* Time running out: a clock, not a calendar. The calendar states which day,
       and this reading is about how little of it is left. */}
   {level === 'atRisk' && (
    <>
     <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='1.75' />
     <path
      d='M12 7.25V12l3 2'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
     />
    </>
   )}

   {level === 'onPlan' && (
    <>
     <rect
      x='3.5'
      y='5'
      width='17'
      height='15.5'
      rx='2.5'
      stroke='currentColor'
      strokeWidth='1.75'
     />
     <path
      d='M3.5 9.5h17M8 3v4M16 3v4'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinecap='round'
     />
    </>
   )}
  </svg>
 );
}

export default PocketReadingIcon;
