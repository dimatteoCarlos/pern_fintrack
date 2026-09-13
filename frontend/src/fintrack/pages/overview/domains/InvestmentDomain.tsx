// frontend/src/fintrack/pages/overview/domains/InvestmentDomain.tsx
//
// Investment on level 2. No series: an accumulation only rises. The reconciliation
// comes with the first answer; the balance per account and the contribution history
// wait for the full answer (P5-6).

import { useLocation } from 'react-router-dom';

import AnalysisPanel, { derivedSectionStatus, fullSectionStatus } from './AnalysisPanel';
import LevelThreeRow from './LevelThreeRow';
import { DomainCompositionProps } from './domainScreen';
import { accountLink } from '../helpers/levelThreeLink';
import { NO_SHARE, percent } from '../helpers/rankedBreakdown';
import { KpiTooltip } from '../../../general_components/kpiTooltip/KpiTooltip';
import { currencyFormat } from '../../../helpers/functions';
import {
 CURRENCY_OPTIONS,
 DATE_TIME_FORMAT_DEFAULT,
 DEFAULT_CURRENCY,
} from '../../../helpers/constants';
import { OverviewReconciliation } from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// The minus sign and not a hyphen, as the pocket statement prints it.
const MINUS = '−';

const NO_FIGURE = '—';

// The same words the income rows and the shell's movement list use for it.
const CLOSED_ACCOUNT_LABEL = 'closed account';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const shareOf = (share: number | null) =>
 share === null ? NO_SHARE : percent(share);

// Rebuilt as a local date, as ListContent.tsx prints the movements below: new Date
// reads 'YYYY-MM-DD' as UTC midnight, the previous day west of Greenwich.
const dayLabel = (date: string) => {
 const parts = DATE_ONLY.exec(date);

 if (parts === null) return NO_FIGURE;

 return new Intl.DateTimeFormat(DATE_TIME_FORMAT_DEFAULT).format(
  new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])),
 );
};

type ReconciliationStatementProps = {
 // Null while pending: the terms are drawn at once and only the figures wait.
 figures: OverviewReconciliation | null;
 formatAmount: (value: number) => string;
};

// The three terms less the ledger balance is the difference, so the column adds up
// to the server's own figure and nothing is summed here.
function ReconciliationStatement({ figures, formatAmount }: ReconciliationStatementProps) {
 const figure = (value: (terms: OverviewReconciliation) => string) =>
  figures === null ? (
   <span className='domainAnalysis__skeleton domainAnalysis__skeleton--amount' />
  ) : (
   value(figures)
  );

 const bare = (value: number) =>
  Number.isFinite(value) ? formatAmount(value) : NO_FIGURE;

 // A result, an adjustment and a difference can each be negative; zero prints bare.
 const signed = (value: number) => {
  if (!Number.isFinite(value)) return NO_FIGURE;

  const amount = formatAmount(Math.abs(value));

  if (value > 0) return `+${amount}`;

  return value < 0 ? `${MINUS}${amount}` : amount;
 };

 // The balance is the side the terms are checked against, so it is subtracted.
 const subtracted = (value: number) =>
  Number.isFinite(value) && value > 0 ? `${MINUS}${formatAmount(value)}` : bare(value);

 return (
  <dl className='domainAnalysis__statement'>
   <dt className='domainAnalysis__term domainAnalysis__term--withTip'>
    Capital contributed
    {/* The panel is cream. */}
    <KpiTooltip
     label='Capital contributed'
     definition='Money transferred into your investment accounts, less what was transferred out, plus the balance each account opened with.'
     surface='cream'
    />
   </dt>
   <dd className='domainAnalysis__value'>
    {figure((terms) => bare(terms.capitalContributed))}
   </dd>

   <dt className='domainAnalysis__term domainAnalysis__term--withTip'>
    Realised result
    <KpiTooltip
     label='Realised result'
     definition='Gains and losses recorded on your investment accounts since they opened.'
     surface='cream'
    />
   </dt>
   <dd className='domainAnalysis__value'>
    {figure((terms) => signed(terms.realizedPnl))}
   </dd>

   {/* Printed at $0.00 too: it is a term of the identity, not a note to it. */}
   <dt className='domainAnalysis__term domainAnalysis__term--withTip'>
    Closure adjustment
    <KpiTooltip
     label='Closure adjustment'
     definition='What closing or annulling an investment account moved on it. Zero unless an account was closed or annulled.'
     surface='cream'
    />
   </dt>
   <dd className='domainAnalysis__value'>
    {figure((terms) => signed(terms.closureAdjustment))}
   </dd>

   <dt className='domainAnalysis__term domainAnalysis__term--withTip'>
    Ledger balance
    <KpiTooltip
     label='Ledger balance'
     definition='What your investment accounts hold at the close of the month, added up from every movement recorded on them. The three terms above should explain it.'
     surface='cream'
    />
   </dt>
   <dd className='domainAnalysis__value'>
    {figure((terms) => subtracted(terms.ledgerBalance))}
   </dd>

   <dt className='domainAnalysis__term domainAnalysis__term--total domainAnalysis__term--withTip'>
    Difference
    <KpiTooltip
     label='Difference'
     definition={`Capital contributed + realised result + closure adjustment − ledger balance. Zero means the three terms explain the whole balance${
      figures === null ? '' : `; anything under ${formatAmount(figures.tolerance)} counts as zero`
     }.`}
     surface='cream'
    />
   </dt>
   {/* The server's figure, never recomputed: only it knows its rounding. */}
   <dd className='domainAnalysis__value domainAnalysis__value--total'>
    {figure((terms) => signed(terms.difference))}
   </dd>
  </dl>
 );
}

function InvestmentDomain({
 card,
 analysis,
 isLoading,
 onRetry,
 fullStatus,
 onRequestFullAnalysis,
}: DomainCompositionProps<'investment'>) {
 const { pathname, search } = useLocation();
 // The search keeps the month, so the account's back arrow returns to it.
 const origin = `${pathname}${search}`;

 const formatAmount = (value: number) =>
  currencyFormat(card.currency, value, formatNumberCountry);

 const reconciliation = analysis?.reconciliation;
 const accounts = analysis?.balanceByAccount;
 const history = analysis?.contributionHistory;

 // Compared against the published tolerance, which is what it is published for.
 const isUnexplained =
  reconciliation !== undefined &&
  Number.isFinite(reconciliation.difference) &&
  Math.abs(reconciliation.difference) >= reconciliation.tolerance;

 // One notice list for two sections. makeInvestmentAnalysis.js pushes the
 // no-portfolio notice first, and only when balanceByAccount is absent at full.
 const notices = analysis?.meta.notices ?? [];
 const portfolioNoticeCount =
  analysis?.level === 'full' && accounts === undefined ? Math.min(notices.length, 1) : 0;

 return (
  <>
   <AnalysisPanel
    title='Whether the balance is explained'
    subject='Balance reconciliation'
    status={derivedSectionStatus(analysis, isLoading)}
    isFull={false}
    // Derived: the retry re-asks the first request, which carries the analysis.
    onRequest={onRetry}
    skeleton={<ReconciliationStatement figures={null} formatAmount={formatAmount} />}
    // Always published with the analysis; absent is a gap, not a zero.
    isEmpty={reconciliation === undefined}
    emptyText='The reconciliation is not available for this period.'
    // Every notice of this analysis belongs to the two full sections.
    notices={[]}
   >
    {reconciliation !== undefined && (
     <>
      <ReconciliationStatement figures={reconciliation} formatAmount={formatAmount} />

      {isUnexplained && (
       <p className='domainAnalysis__foot'>
        The terms account for {formatAmount(Math.abs(reconciliation.difference))}{' '}
        {reconciliation.difference > 0 ? 'more' : 'less'} than the ledger balance
        holds. This usually means a movement the terms do not name, such as an
        expense, was recorded on an investment account.
       </p>
      )}
     </>
    )}
   </AnalysisPanel>

   <AnalysisPanel
    title='Where the portfolio is held'
    subject='Balance by account'
    status={fullSectionStatus(analysis, fullStatus)}
    isFull
    onRequest={onRequestFullAnalysis}
    // The card counts the accounts, so the skeleton has their number of rows.
    skeletonRows={Math.max(card.accountCount, 1)}
    // Absent at the full level means there is no investment account.
    isEmpty={accounts === undefined || accounts.length === 0}
    emptyText='There is no investment account to break down.'
    notices={notices.slice(0, portfolioNoticeCount)}
   >
    <ul className='domainAnalysis__rows'>
     {accounts?.map((account) => (
      <li className='domainAnalysis__item' key={account.accountId}>
       {/* The rows are read from the open accounts, so every one has a screen and
           links; a zero balance is an emptied account and stays a row. */}
       <LevelThreeRow
        name={account.accountName}
        amount={formatAmount(account.amount)}
        share={shareOf(account.share)}
        link={accountLink(account.accountId, origin)}
       />
      </li>
     ))}
    </ul>
   </AnalysisPanel>

   <AnalysisPanel
    title='When money went in'
    subject='Contribution history'
    status={fullSectionStatus(analysis, fullStatus)}
    isFull
    onRequest={onRequestFullAnalysis}
    // Absent at the full level means nothing beyond the openings was ever funded.
    isEmpty={history === undefined || history.rows.length === 0}
    emptyText='No contribution has been recorded yet.'
    notices={notices.slice(portfolioNoticeCount)}
   >
    {history !== undefined && (
     <>
      <ul className='domainAnalysis__rows domainAnalysis__rows--contributions'>
       {history.rows.map((event) => (
        <li className='domainAnalysis__item' key={event.transactionId}>
         {/* Static: an event is not an entity, and OVERVIEW_LEVEL3.md routes
             investment from the balance rows only. */}
         <div className='contributionRow'>
          <time className='contributionRow__date' dateTime={event.contributionDate}>
           {dayLabel(event.contributionDate)}
          </time>
          <span className='contributionRow__account'>
           {event.accountName ?? CLOSED_ACCOUNT_LABEL}
          </span>
          <span className='contributionRow__amount'>
           {Number.isFinite(event.amount) ? formatAmount(event.amount) : NO_FIGURE}
          </span>
         </div>
        </li>
       ))}
      </ul>

      {/* The rows are the newest page; without the count a page reads as the whole. */}
      {history.totalRows > history.rows.length && (
       <p className='domainAnalysis__foot'>
        Showing the newest {history.rows.length} of {history.totalRows} contributions.
       </p>
      )}
     </>
    )}
   </AnalysisPanel>
  </>
 );
}

export default InvestmentDomain;
