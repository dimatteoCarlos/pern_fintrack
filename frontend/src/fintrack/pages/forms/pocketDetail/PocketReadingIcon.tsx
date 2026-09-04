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
   {level === 'completed' && (
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
   {level === 'overdue' && (
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

   {/* In front of the plan's own line: a rising trend, which states a DIRECTION
       where the calendar below states a schedule kept. It is the one glyph here
       that is not a container — nothing bounds this reading, the pocket is
       simply further along than the line asked for.

       aboveTarget and behind still draw an empty svg. That gap predates the
       seventh level and is not closed here: this file is a switch, so a missing
       branch costs a blank glyph and never a crash. */}
   {level === 'ahead' && (
    <>
     <path
      d='M3.75 16.5 9.5 10.75l3.25 3.25 6.5-6.5'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
     />
     <path
      d='M14.75 7.5h4.5V12'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
     />
    </>
   )}

   {level === 'onTrack' && (
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
