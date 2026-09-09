// frontend/src/fintrack/pages/overview/components/CardMetricBlock.tsx
//
// The shape a domain card states a SECOND reading in, once the headline figure
// has been stated above it.
//
//   Budget                          $3,500.00
//   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░
//   ■ $465.40 left                  86.7% spent
//
// WHY IT LEFT DomainCards.tsx. Carlos, 2026-09-09: "se puede usar el mismo
// layout de la zona de Budget que usaste en Expense", of the Pocket and PnL
// cards. Three cards drawing the same rows from three copies of the same JSX is
// three places for one layout to drift, and the head and the foot have to land
// on the SAME two edges or the bar between them stops reading as spanning both.
//
// TWO EXPORTS AND NOT ONE, because the three cards do not need the same amount
// of it. Expense and Pocket each measure a part against a whole, so they take
// the whole block, bar included. PnL measures nothing against anything — its two
// legs are not required to sum to its headline, which that card says in as many
// words — so it takes the ROW alone. A bar drawn over two figures that need not
// add up would state a proportion the data does not have.

import { ReactNode } from 'react';

import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents';
import {
 ProgressBar,
 ProgressTone,
} from '../../../general_components/progressBar/ProgressBar';

type CardMetricRowProps = {
 // What the reading is. A node and not a string, because a foot line carries a
 // square inside its own subject and the mark has to wrap with the words it
 // grades rather than away from them.
 subject: ReactNode;
 figure: ReactNode;
 // 'head' names what the block measures and takes the heavier ink; the default
 // is the quieter row the card's subtitle is already set in.
 variant?: 'head' | 'foot';
};

// The two ends of one reading: what it is on the left, how much of it on the
// right. Every row of a block lands on the same two edges, which is what lets
// the bar between them read as spanning both.
export const CardMetricRow = ({
 subject,
 figure,
 variant = 'foot',
}: CardMetricRowProps) => (
 <div className={`domainCard__blockRow domainCard__blockRow--${variant}`}>
  {subject}
  {figure}
 </div>
);

type CardMetricBlockProps = {
 // The head: what is being measured, and the whole it is measured against.
 label: string;
 amount: string;
 // The share, as a rate OVER 100 and not a ratio in 0-1 — a month can spend
 // 142% of its budget and the bar is built for it.
 //
 // null when the proportion is unmeasurable, which is a whole of zero: there is
 // no denominator to divide by, and that is not a reading of 0%. The block then
 // draws its two rows with nothing between them, because an empty track states
 // that nothing has been spent and the remainder beside it says otherwise.
 progress: number | null;
 // What the bar is a share OF, in words. Required by ProgressBar and required
 // here for the same reason: a bar with no label announces a bare percentage,
 // which is a number without a subject.
 progressLabel: string;
 tone: ProgressTone;
 // The mark, on the line it grades. It sits inside the foot and not at the head
 // of the card's whole subtitle, which is where the expense card carried it
 // until 2026-09-09 — a 12px square in front of the word Budget, grading a
 // block it was not inside.
 //
 // Typed as StatusSquare types it. The page's own SquareClass would be the
 // narrower type and it would be the wrong one here: budgetSquareState returns
 // a plain string, and a block used by three cards cannot demand a vocabulary
 // only two of them speak.
 square: string;
 // What is left of the whole, in the calling module's own verb — "left" for a
 // budget, "still to allocate" for a pocket. The block never words it, because
 // the two modules deliberately do not word it the same way.
 remainder: string;
 // The share, named. A bare percentage beside a remainder reads as the share
 // LEFT, which is the opposite figure, so the caller passes the word with it.
 share: string;
 // The status class the share is painted in. Taken from the SAME call that
 // chose the square and the tone: three marks on one block lighting from three
 // calls is how a row ends up contradicting itself.
 shareLevel: string;
};

export const CardMetricBlock = ({
 label,
 amount,
 progress,
 progressLabel,
 tone,
 square,
 remainder,
 share,
 shareLevel,
}: CardMetricBlockProps) => (
 <div className='domainCard__block'>
  <CardMetricRow
   variant='head'
   subject={<span className='domainCard__blockLabel'>{label}</span>}
   figure={<span className='domainCard__blockAmount'>{amount}</span>}
  />

  {progress !== null && (
   <ProgressBar value={progress} tone={tone} label={progressLabel} />
  )}

  <CardMetricRow
   subject={
    <span className='domainCard__blockLead'>
     <StatusSquare alert={square} />
     {remainder}
    </span>
   }
   figure={
    // Withheld with the bar and for the same reason: with no denominator there
    // is no share to state, and the remainder on the left is the whole reading.
    progress === null ? null : (
     <span className={`domainCard__share domainCard__share--${shareLevel}`}>
      {share}
     </span>
    )
   }
  />
 </div>
);
