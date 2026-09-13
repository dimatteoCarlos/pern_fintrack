// frontend/src/fintrack/pages/overview/domains/PocketDomain.tsx
//
// Pockets on level 2: the committed total at each month close. Progress per
// pocket and committed against free are later commits.

import DomainSeries from './DomainSeries';
import { DomainCompositionProps } from './domainScreen';

function PocketDomain({
 card,
 analysis,
 isLoading,
 onRetry,
}: DomainCompositionProps<'pocket'>) {
 return (
  <DomainSeries
   // The level-1 trend's words: a pocket is a plan, so nothing is "saved".
   label='Committed to pockets'
   nature='position'
   points={analysis?.series ?? null}
   currency={card.currency}
   isLoading={isLoading}
   onRetry={onRetry}
  />
 );
}

export default PocketDomain;
