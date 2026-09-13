// frontend/src/fintrack/pages/overview/domains/LevelThreeRow.tsx
//
// One row of a level-2 breakdown: a link to the entity's level-3 screen, or a
// static row when it names no entity (OVERVIEW_DECISIONS.md, P5-6).

import { Link } from 'react-router-dom';

import { LevelThreeLink } from '../helpers/levelThreeLink';
import { NO_SHARE } from '../helpers/rankedBreakdown';

// A row read against its own goal rather than as a share of a whole: the pocket
// row, drawn on two lines (P5-6).
export type LevelThreeProgress = {
 // 0-100, above 100 when over-funded. The fill is clamped; the label is not.
 value: number;
 label: string;
 // Read aloud after the label and not drawn: the section title already says it.
 spokenSuffix: string;
 // The served status, named in words: the mark only reinforces the word, since
 // several levels share a hue under deuteranopia.
 status: {
  word: string;
  // The suffix of the mark's colour modifier, the square vocabulary's own.
  tone: string;
  isTick: boolean;
 };
};

type LevelThreeRowProps = {
 name: string;
 // Formatted by the caller, which knows the currency and the share's scale.
 amount: string;
 link: LevelThreeLink | null;
} & (
 | { share: string; progress?: never }
 | { progress: LevelThreeProgress; share?: never }
);

function LevelThreeRow({ name, amount, share, progress, link }: LevelThreeRowProps) {
 const variant = progress === undefined ? '' : ' levelThreeRow--progress';

 const cells =
  progress === undefined ? (
   <>
    <span className='levelThreeRow__swatch' aria-hidden='true' />
    <span className='levelThreeRow__name'>{name}</span>
    <span className='levelThreeRow__amount'>{amount}</span>
    <span className='levelThreeRow__share'>{share}</span>
   </>
  ) : (
   <>
    <span className='levelThreeRow__name'>{name}</span>
    <span className='levelThreeRow__amount'>{amount}</span>
    <span className='levelThreeRow__progress'>
     {/* Hidden: the label beside it states the same figure in words. */}
     <span className='levelThreeRow__track' aria-hidden='true'>
      <span
       className='levelThreeRow__fill'
       style={{ width: `${Math.min(Math.max(progress.value, 0), 100)}%` }}
      />
     </span>
     <span className='levelThreeRow__progressLabel'>
      <svg
       className={`levelThreeRow__mark levelThreeRow__mark--${progress.status.tone}`}
       viewBox='0 0 12 12'
       aria-hidden='true'
       focusable='false'
      >
       {progress.status.isTick ? (
        <polyline
         points='2 6.5 5 9.5 10 2.5'
         fill='none'
         stroke='currentColor'
         strokeWidth='2'
         strokeLinecap='round'
         strokeLinejoin='round'
        />
       ) : (
        <rect width='12' height='12' rx='2' fill='currentColor' />
       )}
      </svg>
      <span className='levelThreeRow__statusWord'>{progress.status.word}</span>{' '}
      {/* Hidden: the space around it already separates the two readings aloud. */}
      <span className='levelThreeRow__separator' aria-hidden='true'>
       ·
      </span>{' '}
      {progress.label}{' '}
      <span className='levelThreeRow__spoken'>{progress.spokenSuffix}</span>
     </span>
    </span>
   </>
  );

 if (link === null) {
  return (
   <div className={`levelThreeRow levelThreeRow--static${variant}`}>
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
   className={`levelThreeRow levelThreeRow--linked${variant}`}
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
