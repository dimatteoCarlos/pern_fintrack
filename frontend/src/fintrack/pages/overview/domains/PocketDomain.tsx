// frontend/src/fintrack/pages/overview/domains/PocketDomain.tsx
//
// Pockets on level 2: the committed total at each month close and how far each
// pocket is from its goal, from the first answer; then the free cash left once
// the commitments are taken, which waits for the full answer (P5-6).

import { useLocation } from 'react-router-dom';

import AnalysisPanel, {
 SKELETON_ROWS_WITHOUT_COUNT,
 derivedSectionStatus,
 fullSectionStatus,
} from './AnalysisPanel';
import DomainSeries from './DomainSeries';
import LevelThreeRow from './LevelThreeRow';
import { DomainCompositionProps } from './domainScreen';
import { pocketLink } from '../helpers/levelThreeLink';
import { currencyFormat } from '../../../helpers/functions';
import {
 POCKET_STATUS_WORD,
 pocketMarkIsTick,
 pocketSquareClass,
} from '../../../helpers/pocketStatus';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { OverviewPocketAnalysis } from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// The minus sign and not a hyphen: the statement subtracts the term.
const MINUS = '−';

type FreeCashFigures = NonNullable<OverviewPocketAnalysis['committedAgainstFree']>;

type FreeCashStatementProps = {
 // Null while pending: the terms are drawn at once and only the figures wait.
 figures: FreeCashFigures | null;
 formatAmount: (value: number) => string;
};

// Bank balance less what is committed, plus what the per-account floor absorbed,
// is the free cash. flooredShortfall is shown at $0.00 too: it is a term (P5-6).
function FreeCashStatement({ figures, formatAmount }: FreeCashStatementProps) {
 const figure = (value: (terms: FreeCashFigures) => string) =>
  figures === null ? (
   <span className='domainAnalysis__skeleton domainAnalysis__skeleton--amount' />
  ) : (
   value(figures)
  );

 // A sign only on a term that moves the total; a zero term prints bare.
 const signed = (sign: string, value: number) =>
  value > 0 ? `${sign}${formatAmount(value)}` : formatAmount(value);

 return (
  <dl className='domainAnalysis__statement'>
   <dt className='domainAnalysis__term'>Bank balance</dt>
   <dd className='domainAnalysis__value'>
    {figure((terms) => formatAmount(terms.bankBalance))}
   </dd>

   <dt className='domainAnalysis__term'>Committed to pockets</dt>
   <dd className='domainAnalysis__value'>
    {figure((terms) => signed(MINUS, terms.committed))}
   </dd>

   <dt className='domainAnalysis__term'>Floored shortfall</dt>
   <dd className='domainAnalysis__value'>
    {figure((terms) => signed('+', terms.flooredShortfall))}
   </dd>

   <dt className='domainAnalysis__term domainAnalysis__term--total'>Free cash</dt>
   <dd className='domainAnalysis__value domainAnalysis__value--total'>
    {figure((terms) => formatAmount(terms.freeCash))}
   </dd>
  </dl>
 );
}

function PocketDomain({
 card,
 analysis,
 isLoading,
 onRetry,
 fullStatus,
 onRequestFullAnalysis,
}: DomainCompositionProps<'pocket'>) {
 const { pathname, search } = useLocation();
 // The search keeps the month, so the pocket's back arrow returns to it.
 const origin = `${pathname}${search}`;

 const formatAmount = (value: number) =>
  currencyFormat(card.currency, value, formatNumberCountry);

 const pockets = analysis?.progressByPocket;
 const freeCash = analysis?.committedAgainstFree;

 // One notice list for two sections. makePocketAnalysis.js pushes the no-pocket
 // notice first, and only when progressByPocket is absent; the rest are free cash's.
 const notices = analysis?.meta.notices ?? [];
 const progressNoticeCount =
  analysis !== null && pockets === undefined ? Math.min(notices.length, 1) : 0;

 return (
  <>
   <DomainSeries
    // The level-1 trend's words: a pocket is a plan, so nothing is "saved".
    label='Committed to pockets'
    nature='position'
    points={analysis?.series ?? null}
    currency={card.currency}
    isLoading={isLoading}
    onRetry={onRetry}
   />

   <AnalysisPanel
    title='How far each pocket is from its goal'
    subject='Pocket progress'
    status={derivedSectionStatus(analysis, isLoading)}
    isFull={false}
    // Derived: the retry re-asks the first request, which carries the analysis.
    onRequest={onRetry}
    // The card publishes no pocket count, so the default three, two lines each.
    skeleton={[...Array(SKELETON_ROWS_WITHOUT_COUNT).keys()].map((index) => (
     <span
      className='domainAnalysis__skeleton domainAnalysis__skeleton--progressRow'
      key={`skeleton-${index}`}
     />
    ))}
    // Absent means no pocket is planned; the server's notice says so.
    isEmpty={pockets === undefined || pockets.length === 0}
    emptyText='No pockets yet.'
    notices={notices.slice(0, progressNoticeCount)}
   >
    <ul className='domainAnalysis__rows domainAnalysis__rows--progress'>
     {pockets?.map((pocket) => (
      <li className='domainAnalysis__item' key={pocket.pocketId}>
       {/* Every row is a pocket on the board, and pocketId is required there,
           so every row links. */}
       <LevelThreeRow
        name={pocket.name}
        amount={currencyFormat(pocket.currency, pocket.allocated, formatNumberCountry)}
        progress={{
         value: pocket.progress,
         // Rounded as the pocket board rounds it, so the two screens agree.
         label: `${Math.round(pocket.progress)}%`,
         spokenSuffix: 'of its goal',
         // The server's level, in the board's word and mark (pocketStatus.ts).
         status: {
          word: POCKET_STATUS_WORD[pocket.level],
          tone: pocketMarkIsTick(pocket.level) ? 'complete' : pocketSquareClass(pocket.level),
          isTick: pocketMarkIsTick(pocket.level),
         },
        }}
        link={pocketLink(pocket.pocketId, origin)}
       />
      </li>
     ))}
    </ul>
   </AnalysisPanel>

   <AnalysisPanel
    title='How much cash is still free'
    subject='Free cash'
    status={fullSectionStatus(analysis, fullStatus)}
    isFull
    onRequest={onRequestFullAnalysis}
    skeleton={<FreeCashStatement figures={null} formatAmount={formatAmount} />}
    // The full level always serves it; absent there is a gap, not a zero.
    isEmpty={freeCash === undefined}
    emptyText='Free cash is not available for this period.'
    notices={notices.slice(progressNoticeCount)}
   >
    {freeCash !== undefined && (
     <>
      <FreeCashStatement figures={freeCash} formatAmount={formatAmount} />

      {freeCash.flooredShortfall > 0 && (
       <p className='domainAnalysis__foot'>
        {formatAmount(freeCash.flooredShortfall)} is committed beyond the balance
        of the account holding it. Each account counts from zero, so that
        shortfall is not taken from the others.
       </p>
      )}
     </>
    )}
   </AnalysisPanel>
  </>
 );
}

export default PocketDomain;
