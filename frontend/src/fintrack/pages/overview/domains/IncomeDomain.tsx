// frontend/src/fintrack/pages/overview/domains/IncomeDomain.tsx
//
// Income on level 2: the thirteen-month series from the first answer, then where
// the month's income came from, which waits for the full answer (P5-6).

import { useLocation } from 'react-router-dom';

import AnalysisPanel, { fullSectionStatus } from './AnalysisPanel';
import DomainSeries from './DomainSeries';
import LevelThreeRow from './LevelThreeRow';
import { DomainCompositionProps } from './domainScreen';
import { accountLink } from '../helpers/levelThreeLink';
import { NO_SHARE, percent } from '../helpers/rankedBreakdown';
import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// The server labels the source no account is attributed to with an empty string;
// the word is the one its notice uses.
const UNATTRIBUTED_LABEL = 'Unattributed';

// A source account closed since: the id survives on the movement, the name does
// not. The same words the shell's movement list uses for it.
const CLOSED_ACCOUNT_LABEL = 'closed account';

const shareOf = (share: number | null) =>
 share === null ? NO_SHARE : percent(share);

function IncomeDomain({
 card,
 analysis,
 isLoading,
 onRetry,
 fullStatus,
 onRequestFullAnalysis,
}: DomainCompositionProps<'income'>) {
 const { pathname, search } = useLocation();
 // The search keeps the month, so the account's back arrow returns to it.
 const origin = `${pathname}${search}`;

 const sources = analysis?.bySource;
 const concentration = analysis?.concentration ?? null;

 return (
  <>
   <DomainSeries
    label='Income'
    nature='flow'
    points={analysis?.series ?? null}
    currency={card.currency}
    isLoading={isLoading}
    onRetry={onRetry}
   />

   <AnalysisPanel
    title='Where the income came from'
    subject='Income by source'
    status={fullSectionStatus(analysis, fullStatus)}
    isFull
    onRequest={onRequestFullAnalysis}
    figure={
     <p className='domainAnalysis__figure'>
      {/* A dash and never 0%: a share of nothing is not a small share. */}
      <span className='domainAnalysis__figureValue'>{shareOf(concentration)}</span>
      <span className='domainAnalysis__figureUnit'>from the largest source</span>
     </p>
    }
    // Absent or empty at the full level means the month received nothing.
    isEmpty={sources === undefined || sources.length === 0}
    emptyText='There is no income to break down for this period.'
    notices={analysis?.meta.notices ?? []}
   >
    <ul className='domainAnalysis__rows'>
     {sources?.map((source) => (
      // One unattributed part at most: the statement groups every null source into one.
      <li className='domainAnalysis__item' key={source.accountId ?? 'unattributed'}>
       <LevelThreeRow
        name={
         source.accountId === null
          ? UNATTRIBUTED_LABEL
          : (source.accountName ?? CLOSED_ACCOUNT_LABEL)
        }
        amount={currencyFormat(card.currency, source.amount, formatNumberCountry)}
        share={shareOf(source.share)}
        // No name means the account row is gone, and getAccountById answers 404
        // for it; a closed account keeps its row and its screen, so it links.
        link={
         source.accountName === null ? null : accountLink(source.accountId, origin)
        }
       />
      </li>
     ))}
    </ul>
   </AnalysisPanel>
  </>
 );
}

export default IncomeDomain;
