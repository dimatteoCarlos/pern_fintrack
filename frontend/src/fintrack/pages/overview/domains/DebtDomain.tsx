// frontend/src/fintrack/pages/overview/domains/DebtDomain.tsx
//
// Debt on level 2: who the balance is with, then both legs at each month close,
// never netted. No series, and both sections wait for the full answer (P5-6).

import { useLocation } from 'react-router-dom';

import AnalysisPanel, {
 SKELETON_ROWS_WITHOUT_COUNT,
 fullSectionStatus,
} from './AnalysisPanel';
import DebtLegsChart from './DebtLegsChart';
import LevelThreeRow, { LevelThreeAmountTone } from './LevelThreeRow';
import { DomainCompositionProps } from './domainScreen';
import { debtorLink } from '../helpers/levelThreeLink';
import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { OverviewDebtDirection } from '../../../types/overviewTypes';

const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// The minus sign and not a hyphen, as the pocket statement prints it.
const MINUS = '−';

const NO_FIGURE = '—';

// The served direction in words beside the sign; the word carries it for a
// reader who cannot tell the colours apart.
const DIRECTION_WORD: Record<OverviewDebtDirection, string> = {
 receivable: 'owes you',
 payable: 'you owe',
 settled: 'settled',
};

// Carlos, 2026-09-13: debt amounts take the amount colours. Settled keeps the ink.
const DIRECTION_TONE: Record<OverviewDebtDirection, LevelThreeAmountTone | undefined> = {
 receivable: 'positive',
 payable: 'negative',
 settled: undefined,
};

function DebtDomain({
 card,
 analysis,
 fullStatus,
 onRequestFullAnalysis,
}: DomainCompositionProps<'debt'>) {
 const { pathname, search } = useLocation();
 // The search keeps the month, so the debtor's back arrow returns to it.
 const origin = `${pathname}${search}`;

 const counterparties = analysis?.byCounterparty;
 const legs = analysis?.legsOverTime;

 // One statement serves both sections, so they share one status and one request.
 const status = fullSectionStatus(analysis, fullStatus);

 // Settled counterparties are in neither count, so the list can land a row longer.
 const countedRows = card.payableCount + card.receivableCount;

 const signed = (value: number) => {
  if (!Number.isFinite(value)) return NO_FIGURE;

  const amount = currencyFormat(card.currency, Math.abs(value), formatNumberCountry);

  if (value > 0) return `+${amount}`;

  return value < 0 ? `${MINUS}${amount}` : amount;
 };

 return (
  <>
   <AnalysisPanel
    title='Who the balance is with'
    subject='Debts by counterparty'
    status={status}
    isFull
    onRequest={onRequestFullAnalysis}
    skeletonRows={countedRows > 0 ? countedRows : SKELETON_ROWS_WITHOUT_COUNT}
    // Absent at the full level means no debt in either direction; the notice says so.
    isEmpty={counterparties === undefined || counterparties.length === 0}
    emptyText='No debtors or lenders yet.'
    // makeDebtAnalysis.js's full-level notice names the counterparty breakdown.
    notices={analysis?.meta.notices ?? []}
   >
    {/* No share column: a share across mixed signs means nothing. */}
    <ul className='domainAnalysis__rows domainAnalysis__rows--debt'>
     {counterparties?.map((counterparty) => (
      <li className='domainAnalysis__item' key={counterparty.accountId}>
       {/* The statement joins live accounts only, so every row is named and
           links, the settled one included: it has a history to open. */}
       <LevelThreeRow
        name={counterparty.accountName}
        amount={signed(counterparty.balance)}
        amountTone={DIRECTION_TONE[counterparty.direction]}
        share={DIRECTION_WORD[counterparty.direction]}
        link={debtorLink(counterparty.accountId, origin)}
       />
      </li>
     ))}
    </ul>
   </AnalysisPanel>

   <AnalysisPanel
    title='Did both sides grow?'
    subject='Debt over time'
    status={status}
    isFull
    onRequest={onRequestFullAnalysis}
    skeleton={<DebtLegsChart legs={null} currency={card.currency} />}
    isEmpty={legs === undefined || legs.length === 0}
    emptyText='There is no debt in either direction over these months.'
    // The one notice is drawn above; repeating it here would say it twice.
    notices={[]}
   >
    {legs !== undefined && <DebtLegsChart legs={legs} currency={card.currency} />}
   </AnalysisPanel>
  </>
 );
}

export default DebtDomain;
