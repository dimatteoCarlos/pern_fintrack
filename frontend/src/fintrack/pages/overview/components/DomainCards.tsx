// frontend/src/fintrack/pages/overview/components/DomainCards.tsx
// The six domain cards of level 1: one headline figure each, plus the minimum
// context. Income, Expense and PnL report a FLOW over the served month; Debt,
// Pocket and Investment report a POSITION at its close.
//
// Every figure is read from the /overview payload the layout already fetched,
// so this block costs no request of its own and cannot disagree with the hero
// above it: both are cut against the same resolved month.
//
// NO BARS AND NO SECOND FIGURE OF EQUAL WEIGHT. The cards publish far more than
// they draw - pocket alone carries seven figures - and level 1 shows the
// headline and one subordinate line. The rest belongs to level 2.

import { currencyFormat } from '../../../helpers/functions';
import { CardTitle } from '../../../general_components/CardTitle';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { useOverviewStore } from '../../../stores/useOverviewStore';

// The locale is the reader's, never the amount's. Taken from the amount's own
// currency, Intl leaves every currency unmarked and the dollar, the Colombian
// peso and the Mexican peso all narrow to '$'.
const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// Rendered when a figure did not arrive. Never a 0: a withheld delta is one the
// server refused to invent, because no complete prior month existed.
const NO_FIGURE = '—';

const money = (currency: string, value: number) =>
 currencyFormat(currency, value, formatNumberCountry);

// 'YYYY-MM-01' to 'September 2026'. Split and rebuilt rather than passed to the
// Date constructor: 'YYYY-MM-01' parses as UTC midnight, which is the previous
// month for every reader west of Greenwich.
const monthLabel = (month: string | null) => {
 if (!month) return NO_FIGURE;

 const [year, monthNumber] = month.split('-').map(Number);

 return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-US', {
  month: 'long',
  year: 'numeric',
 });
};

// The delta is an AMOUNT and not a rate, because the prior month's own figure is
// not published: deriving a percentage here would mean inventing the
// denominator. The arrow carries the direction so the sign does not have to be
// read off the digits.
const deltaLine = (delta: number | null, currency: string) => {
 if (delta === null) return NO_FIGURE;
 if (delta === 0) return `no change vs prior month`;

 return `${delta > 0 ? '▲' : '▼'} ${money(currency, Math.abs(delta))} vs prior month`;
};

type CardProps = {
 label: string;
 // 'flow' is measured across the month, 'position' is read at its close. The
 // distinction is carried by this word and not by a colour, because the two
 // natures have no token of their own and inventing one would put an
 // unreviewed value in the palette.
 nature: 'flow' | 'position';
 children: React.ReactNode;
 sub: React.ReactNode;
};

// The month is NOT repeated on the card. All six read the same one, so six
// copies of the same period were six lines competing with the figures for the
// width they needed, which is what forced every caption down to a size that
// could not be read. The month is stated once above the grid and the card keeps
// the half that differs between cards: the nature.
const DomainCard = ({ label, nature, children, sub }: CardProps) => (
 <article className='domainCard'>
  <div className='domainCard__head'>
   <span className='domainCard__label'>{label}</span>
   <span className='domainCard__scope'>{nature}</span>
  </div>

  <div className='domainCard__figures'>{children}</div>

  <div className='domainCard__sub'>{sub}</div>
 </article>
);

function DomainCards() {
 const domainCards = useOverviewStore((state) => state.domainCards);
 const referenceMonth = useOverviewStore((state) => state.referenceMonth);

 // Nothing has arrived yet. The layout above owns the skeleton and the error
 // with its retry, so an empty block here is the whole of this component's
 // loading state rather than a second spinner beside that one.
 if (!domainCards) return null;

 const { income, expense, pnl, debt, pocket, investment } = domainCards;

 return (
  <>
   <div className='presentation__card__title__container flx-row-sb'>
    {/* The period every card below is read for, said once. The second row is
        the rule that tells the two natures apart, which the cards used to
        spell out one by one. */}
    <CardTitle subtitle='Flow is measured across the month; position is read at its close'>
     {monthLabel(referenceMonth)}
    </CardTitle>
   </div>

   <section className='domainCards'>
   <DomainCard
    label='Income'
    nature='flow'
    sub={deltaLine(income.delta, income.currency)}
   >
    <div className='domainCard__figure'>
     {money(income.currency, income.totalAmount)}
    </div>
   </DomainCard>

   <DomainCard
    label='Expense'
    nature='flow'
    sub={
     <>
      {deltaLine(expense.delta, expense.currency)}
      {/* The budget is a separate clause and not a second figure: it answers
          what was decided, while the headline answers what was spent. Absent
          when no budget is in force or the categories span currencies, and the
          clause disappears with it rather than printing a zero budget. */}
      {expense.budgetAmount !== null &&
       ` · budget ${money(expense.currency, expense.budgetAmount)}`}
     </>
    }
   >
    <div className='domainCard__figure'>
     {money(expense.currency, expense.totalAmount)}
    </div>
   </DomainCard>

   <DomainCard
    label='PnL'
    nature='flow'
    sub={deltaLine(pnl.delta, pnl.currency)}
   >
    {/* Signed, and a negative is a real answer here in a way it is not on an
        expense card: a losing month is a loss, not an absent figure. */}
    <div className='domainCard__figure'>
     {pnl.totalAmount > 0 ? '+' : ''}
     {money(pnl.currency, pnl.totalAmount)}
    </div>
   </DomainCard>

   <DomainCard
    label='Debt'
    nature='position'
    sub={
     debt.settledCount === 1
      ? '1 debt settled at close'
      : `${debt.settledCount} debts settled at close`
    }
   >
    {/* Two legs and not one net. A net of −$550 does not distinguish "you owe
        550" from "you are owed 1,750 and you owe 2,300", which are opposite
        situations. Both print as positive magnitudes: the direction is in the
        wording, so a negative would be a double negative. */}
    <div className='domainCard__figure domainCard__figure--split'>
     <span className='domainCard__leg'>You owe</span>
     <b>{money(debt.currency, debt.payable)}</b>
    </div>
    <div className='domainCard__figure domainCard__figure--split'>
     <span className='domainCard__leg'>You&rsquo;re owed</span>
     <b>{money(debt.currency, debt.receivable)}</b>
    </div>
   </DomainCard>

   <DomainCard
    label='Pocket · committed'
    nature='position'
    sub={
     pocket.delta === null
      ? NO_FIGURE
      : `${pocket.delta >= 0 ? '▲' : '▼'} ${money(
         pocket.currency,
         Math.abs(pocket.delta),
        )} committed in the month`
    }
   >
    <div className='domainCard__figure'>
     {money(pocket.currency, pocket.totalAmount)}
    </div>
   </DomainCard>

   <DomainCard
    label='Investment'
    nature='position'
    sub={
     investment.accountCount === 1
      ? '1 account — the count is as of today'
      : `${investment.accountCount} accounts — the count is as of today`
    }
   >
    <div className='domainCard__figure'>
     {money(investment.currency, investment.ledgerBalance)}
    </div>
   </DomainCard>
   </section>
  </>
 );
}

export default DomainCards;
