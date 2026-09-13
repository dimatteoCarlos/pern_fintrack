// frontend/src/fintrack/pages/overview/domains/IncomeDomain.tsx
//
// Income on level 2: the series. The breakdown by source is a later commit.

import DomainSeries from './DomainSeries';
import { DomainCompositionProps } from './domainScreen';

function IncomeDomain({
 card,
 analysis,
 isLoading,
 onRetry,
}: DomainCompositionProps<'income'>) {
 return (
  <DomainSeries
   label='Income'
   nature='flow'
   points={analysis?.series ?? null}
   currency={card.currency}
   isLoading={isLoading}
   onRetry={onRetry}
  />
 );
}

export default IncomeDomain;
