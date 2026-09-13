// frontend/src/fintrack/pages/overview/domains/PnlDomain.tsx
//
// Realised result on level 2: the signed series of the monthly total, then where
// the month's result landed - investment, bank and other accounts - from the
// first answer (derived). No level 3: no part is an entity to open.

import AnalysisPanel, { derivedSectionStatus } from './AnalysisPanel';
import DomainSeries from './DomainSeries';
import { DomainCompositionProps } from './domainScreen';
import { KpiTooltip } from '../../../general_components/kpiTooltip/KpiTooltip';
import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// The minus sign and not a hyphen, as the pocket statement prints it.
const MINUS = '−';

const NO_FIGURE = '—';

// The skeleton's rows: the two parts and the total.
const SPLIT_ROWS = 3;

function PnlDomain({
 card,
 analysis,
 isLoading,
 onRetry,
}: DomainCompositionProps<'pnl'>) {
 const split = analysis?.byAccountType;

 // Either part can be a loss, so the sign is printed on every non-zero figure.
 const signed = (value: number) => {
  // A server older than the field sends nothing: a dash, never NaN or 0.
  if (!Number.isFinite(value)) return NO_FIGURE;

  const amount = currencyFormat(card.currency, Math.abs(value), formatNumberCountry);

  if (value > 0) return `+${amount}`;

  return value < 0 ? `${MINUS}${amount}` : amount;
 };

 return (
  <>
   <DomainSeries
    label='Realised result'
    nature='flow'
    points={analysis?.series ?? null}
    currency={card.currency}
    isLoading={isLoading}
    onRetry={onRetry}
    // Unsigned, a losing month would be drawn at the height of an equal gain.
    isSigned
   />

   <AnalysisPanel
    title='Where the result landed'
    subject='Result by account type'
    status={derivedSectionStatus(analysis, isLoading)}
    isFull={false}
    // Derived: the retry re-asks the first request, which carries the analysis.
    onRequest={onRetry}
    skeletonRows={SPLIT_ROWS}
    // makePnlAnalysis.js always publishes both parts; absent is a gap, not a zero.
    isEmpty={split === undefined}
    emptyText='The result split is not available for this period.'
    notices={analysis?.meta.notices ?? []}
   >
    {split !== undefined && (
     <dl className='domainAnalysis__statement'>
      <dt className='domainAnalysis__term'>Investment accounts</dt>
      <dd className='domainAnalysis__value'>{signed(split.investment)}</dd>

      <dt className='domainAnalysis__term domainAnalysis__term--withTip'>
       Bank accounts
       {/* The panel is cream. */}
       <KpiTooltip
        label='Bank accounts'
        definition='Your bank and cash accounts.'
        surface='cream'
       />
      </dt>
      <dd className='domainAnalysis__value'>{signed(split.bank)}</dd>

      {/* The rest of the total, so it is never empty by definition: it holds any
          debtor or pocket account the result landed on. */}
      <dt className='domainAnalysis__term domainAnalysis__term--withTip'>
       Other accounts
       <KpiTooltip
        label='Other accounts'
        definition='Every account that is neither an investment nor a bank or cash account, such as a debtor or a pocket account a result was recorded on.'
        surface='cream'
       />
      </dt>
      <dd className='domainAnalysis__value'>{signed(split.other)}</dd>

      {/* The card's own total: the server partitions it, so the two parts sum
          to it and nothing is added here. */}
      <dt className='domainAnalysis__term domainAnalysis__term--total'>
       Realised result
      </dt>
      <dd className='domainAnalysis__value domainAnalysis__value--total'>
       {signed(card.totalAmount)}
      </dd>
     </dl>
    )}
   </AnalysisPanel>
  </>
 );
}

export default PnlDomain;
