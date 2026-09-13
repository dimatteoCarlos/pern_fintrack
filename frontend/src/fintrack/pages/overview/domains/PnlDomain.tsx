// frontend/src/fintrack/pages/overview/domains/PnlDomain.tsx
//
// Realised result on level 2: the signed series. The split by account type is a
// later commit.

import DomainSeries from './DomainSeries';
import { DomainCompositionProps } from './domainScreen';

function PnlDomain({
 card,
 analysis,
 isLoading,
 onRetry,
}: DomainCompositionProps<'pnl'>) {
 return (
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
 );
}

export default PnlDomain;
