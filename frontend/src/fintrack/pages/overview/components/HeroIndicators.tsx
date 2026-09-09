// frontend/src/fintrack/pages/overview/components/HeroIndicators.tsx
//
// The four figures the hero grew, in a card of their own that opens and closes.
//
// WHY THEY ARE NOT IN THE HERO. BigBoxResult carries seven rows today and the
// first three are the ones a reader opens the page for: what is owned, what came
// in, what went out. The other four answer narrower questions - how much of what
// is owned is liquid, how much of that is cash, how much of that cash is
// unpromised, and whether the month moved forward - and a reader who is not
// asking one of them is reading past four rows to reach the list below. Closed
// by default for that reason: the page states its headline and offers the rest.
//
// THE ORDER IS THE NARROWING AND IT IS NOT DECORATIVE. Liquid net worth, cash
// position and free cash each take a term out of the one above, so a reader
// going down the column is answering a narrower question each time. Net monthly
// flow sits last because it is the only flow among them: the three above are
// positions at the close of the month and it is a movement across it.
//
// EVERY DEFINITION IS THE BUILDER'S. Each sentence below restates what
// makeHeroSection.js computes and why, so the tip cannot drift into a
// description of a figure the server does not publish.

import { useId, useState } from 'react';

import ChevronDownSvg from '../../../../assets/debtsSvg/ChevronDownSvg.svg?react';

import { KpiTooltip } from '../../../general_components/kpiTooltip/KpiTooltip';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import { monthLabel } from '../helpers/monthLabel';

import '../styles/heroIndicators-styles.css';

// The grouping and decimal marks, which are a locale and not a currency: the
// currency of the figures arrives with the payload.
const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// A figure the server declined to report, which is not a figure of zero. Only
// liquid net worth can reach it, and only when the debt card did not carry what
// is owed - the payload says so in its notices.
const NO_FIGURE = '—';

type IndicatorRow = {
 label: string;
 amount: number | null;
 definition: string;
};

function HeroIndicators() {
 const hero = useOverviewStore((state) => state.hero);
 const referenceMonth = useOverviewStore((state) => state.referenceMonth);

 const [isOpen, setIsOpen] = useState(false);
 const panelId = useId();

 // Nothing to open yet. The layout above owns the skeleton and the error with
 // its retry, so this renders nothing rather than an empty card that expands
 // onto four dashes.
 if (!hero) return null;

 const rows: IndicatorRow[] = [
  {
   label: 'Liquid Net Worth',
   amount: hero.liquidNetWorth,
   // bankBalance + investmentBalance - payable. The receivable leg is left out
   // deliberately: net worth counts money owed to you as wealth, which it is,
   // and as available, which it is not.
   definition:
    'What your bank, cash and investment accounts hold, less what you owe. Money owed to you is left out: whether it arrives is someone else’s decision.',
  },
  {
   label: 'Cash Position',
   amount: hero.cashPosition,
   // The bank and cash balance, whole. Pocket commitments are NOT subtracted:
   // a pocket constrains committing, never spending.
   definition:
    'What your bank and cash accounts hold. Spendable without selling an investment or collecting a debt, and pocket commitments are not taken out of it.',
  },
  {
   label: 'Free Cash',
   amount: hero.freeCash,
   // Floored per account inside the statement, which is why it is read and
   // never composed here from a total balance and a total commitment.
   definition:
    'The part of the cash position no pocket has been promised. Measured account by account, so a surplus in one never covers a shortfall in another.',
  },
  {
   label: 'Net Monthly Flow',
   amount: hero.netMonthlyFlow,
   definition:
    'The month’s income less its expenses. Negative is a real answer: it says the month went backwards.',
  },
 ];

 return (
  <section className='heroIndicators'>
   {/* aria-expanded and aria-controls, so the control says what it does and
       what it opens. The chevron turns rather than being swapped for a second
       glyph: one element, one state. */}
   <button
    type='button'
    className='heroIndicators__toggle'
    aria-expanded={isOpen}
    aria-controls={panelId}
    onClick={() => setIsOpen((open) => !open)}
   >
    <span className='heroIndicators__title'>More indicators</span>

    <span className='heroIndicators__period'>
     {monthLabel(referenceMonth, 'short')}
    </span>

    <ChevronDownSvg
     className={`heroIndicators__chevron${isOpen ? ' is-open' : ''}`}
    />
   </button>

   {/* hidden and not unmounted: aria-controls points at it either way, and a
       reader stepping through the page with a screen reader is told the panel
       exists before it is opened. */}
   <div className='heroIndicators__panel' id={panelId} hidden={!isOpen}>
    {rows.map(({ label, amount, definition }) => (
     <div className='heroIndicators__row' key={label}>
      <span className='heroIndicators__label'>
       {label}
       {/* The card is cream, like the hero box above it. */}
       <KpiTooltip label={label} definition={definition} surface='cream' />
      </span>

      <span className='heroIndicators__amount'>
       {amount === null
        ? NO_FIGURE
        : currencyFormat(hero.currency, amount, formatNumberCountry)}
      </span>
     </div>
    ))}
   </div>
  </section>
 );
}

export default HeroIndicators;
