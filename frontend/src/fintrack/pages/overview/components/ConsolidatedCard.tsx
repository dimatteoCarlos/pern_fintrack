// frontend/src/fintrack/pages/overview/components/ConsolidatedCard.tsx
// The consolidated "all" card of level 1, variant A of
// plan-docs/design-refs/overview-all-card-preview.html: net worth leads, the four
// referenced figures under it, the month's movement count as the footer.
//
// It folds through CollapsibleBlock, the same shell the six domain cards use, and
// carries no drill link because no level-2 screen exists for "all".

import { currencyFormat } from '../../../helpers/functions';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { KpiTooltip } from '../../../general_components/kpiTooltip/KpiTooltip';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import CollapsibleBlock from './CollapsibleBlock';

// The reader's locale, the same choice DomainCards.tsx makes for its figures.
const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

const NO_FIGURE = '—';

// In the body and not beside the head's tag: a button inside summary would fold
// the card on every tap.
const NATURE_DEFINITIONS = {
 flow: 'Flow is what came in or went out during the month.',
 position: 'Position is what you hold or owe at the close of the month.',
} as const;

// A response is parsed, not checked: a field that did not arrive prints a dash
// rather than "NaN" or a 0 that would read as a real value.
const isFigure = (value: number | undefined): value is number =>
 Number.isFinite(value);

const money = (currency: string, value: number) =>
 currencyFormat(currency, value, formatNumberCountry);

// The sign carries the direction, so the label names it and the figure prints
// unsigned. Zero and a missing figure have no direction to name.
const netDebtLabel = (value: number | undefined) => {
 if (!isFigure(value) || value === 0) return 'Net debt';

 return value > 0 ? 'Net debt, owed to you' : 'Net debt, you owe';
};

const Skeleton = () => (
 <span className='consolidatedCard__skeleton' aria-hidden='true' />
);

type RowProps = {
 label: string;
 nature: 'flow' | 'position';
 figure: number | undefined;
 currency: string;
 isLoading: boolean;
 // Only the first row of each nature carries the tip, so the card shows two
 // buttons and not four with the same text.
 withDefinition?: boolean;
};

const Row = ({
 label,
 nature,
 figure,
 currency,
 isLoading,
 withDefinition = false,
}: RowProps) => {
 const isMissing = !isLoading && !isFigure(figure);

 return (
  <div className='consolidatedCard__listRow'>
   <dt className='consolidatedCard__listLabel'>
    <span>{label}</span>
    <span className='consolidatedCard__scope'>{nature}</span>
    {withDefinition && (
     <KpiTooltip label={nature} definition={NATURE_DEFINITIONS[nature]} />
    )}
   </dt>
   <dd
    className={`consolidatedCard__listAmount${isMissing ? ' consolidatedCard__listAmount--missing' : ''}`}
   >
    {isLoading ? (
     <Skeleton />
    ) : isFigure(figure) ? (
     money(currency, figure)
    ) : (
     NO_FIGURE
    )}
   </dd>
  </div>
 );
};

function ConsolidatedCard() {
 const all = useOverviewStore((state) => state.all);
 const isLoading = useOverviewStore((state) => state.isLoading);

 // Not loading and still nothing: the layout owns the error with its retry.
 if (!all && !isLoading) return null;

 // Figures kept from the previous month stay on screen during a month switch,
 // so the skeleton is drawn only while nothing has arrived yet.
 const isFirstLoad = !all;
 const currency = all?.currency ?? DEFAULT_CURRENCY;
 const netWorth = all?.netWorth;
 const netDebt = all?.netDebtPosition;
 const count = all?.transactionCountAll;

 return (
  <CollapsibleBlock
   variant='card'
   className='consolidatedCard'
   head={
    <div className='consolidatedCard__head'>
     <span className='consolidatedCard__label'>All</span>
     <span className='consolidatedCard__scope'>flow + position</span>
    </div>
   }
  >
   <div className='consolidatedCard__figures' aria-busy={isFirstLoad}>
    <span className='consolidatedCard__figureLabel'>Net worth</span>
    <div
     className={`consolidatedCard__figure${!isFirstLoad && !isFigure(netWorth) ? ' consolidatedCard__figure--missing' : ''}`}
    >
     {isFirstLoad ? (
      <Skeleton />
     ) : isFigure(netWorth) ? (
      money(currency, netWorth)
     ) : (
      NO_FIGURE
     )}
    </div>
   </div>

   <dl className='consolidatedCard__list' aria-busy={isFirstLoad}>
    <Row
     label='Income'
     nature='flow'
     figure={all?.totalIncomePeriod}
     currency={currency}
     isLoading={isFirstLoad}
     withDefinition
    />
    <Row
     label='Expense'
     nature='flow'
     figure={all?.totalExpensePeriod}
     currency={currency}
     isLoading={isFirstLoad}
    />
    <Row
     label={netDebtLabel(all?.netDebtPosition)}
     nature='position'
     figure={isFigure(netDebt) ? Math.abs(netDebt) : undefined}
     currency={currency}
     isLoading={isFirstLoad}
     withDefinition
    />
    <Row
     label='Pockets'
     nature='position'
     figure={all?.totalPocketBalance}
     currency={currency}
     isLoading={isFirstLoad}
    />
   </dl>

   <div className='consolidatedCard__sub'>
    <span>
     <span className='consolidatedCard__count'>
      {isFirstLoad ? <Skeleton /> : isFigure(count) ? count : NO_FIGURE}
     </span>{' '}
     {count === 1 ? 'movement' : 'movements'} this month across the domains
    </span>
    <span className='consolidatedCard__aside'>transfers are not counted</span>
   </div>
  </CollapsibleBlock>
 );
}

export default ConsolidatedCard;
