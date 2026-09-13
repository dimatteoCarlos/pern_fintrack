// frontend/src/fintrack/pages/overview/domains/DomainSeries.tsx
//
// The thirteen-month series of a level-2 screen, read from analysis.series. The
// same object for the four domains that publish one; investment and debt do not
// mount it (OVERVIEW_DECISIONS.md, P5-6).

import { CardTitle } from '../../../general_components/CardTitle';
import CollapsibleBlock from '../components/CollapsibleBlock';
import PanelState from '../components/PanelState';
import { TrendChart } from '../components/TrendCharts';
import { OverviewTrendPoint } from '../../../types/overviewTypes';

type DomainSeriesProps = {
 label: string;
 nature: 'flow' | 'position';
 // Null while the analysis has not arrived for this domain and month.
 points: OverviewTrendPoint[] | null;
 currency: string;
 isLoading: boolean;
 onRetry: () => void;
 // Only the profit-and-loss series: a loss has to sit under the zero line.
 isSigned?: boolean;
};

function DomainSeries({
 label,
 nature,
 points,
 currency,
 isLoading,
 onRetry,
 isSigned = false,
}: DomainSeriesProps) {
 // An answer that landed without its analysis is a failure of this block, not
 // an empty series, and the retry re-asks for the derived depth.
 if (points === null && !isLoading) {
  return (
   <PanelState
    title='Trend'
    subject={`The ${label.toLowerCase()} series`}
    isLoading={false}
    error='missing analysis'
    onRetry={onRetry}
   />
  );
 }

 return (
  <CollapsibleBlock head={<CardTitle>Trend</CardTitle>}>
   <section className='domainCards domainCards--single'>
    {points === null ? (
     // The chart's own box, head and axis, so the block does not change height
     // when the series lands.
     <article className='trendChart' aria-busy='true'>
      <div className='domainCard__head'>
       <span className='trendChart__label'>{label}</span>
       <span className='domainCard__scope'>{nature}</span>
      </div>
      <div className='trendChart__plot'>
       <span className='trendChart__pending' aria-hidden='true' />
      </div>
      <div className='trendChart__axis' aria-hidden='true'>
       {/* A no-break space, so the row keeps the height of one line of text. */}
       <span>{' '}</span>
      </div>
     </article>
    ) : points.length === 0 ? (
     <p className='overviewDomain__note'>No months to draw for this period.</p>
    ) : (
     <TrendChart
      label={label}
      nature={nature}
      points={points}
      currency={currency}
      isSigned={isSigned}
      axis='sparse'
     />
    )}
   </section>
  </CollapsibleBlock>
 );
}

export default DomainSeries;
