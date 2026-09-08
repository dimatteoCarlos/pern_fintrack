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
//
// ORDER. PnL sits last and not third. The first five answer "where do I stand"
// in the order the owner reads them - what came in, what went out, what is
// owed, what is committed, what is held - and the realised result is a
// conclusion drawn over them rather than a sixth of the same kind.

import { currencyFormat } from '../../../helpers/functions';
import { CardTitle } from '../../../general_components/CardTitle';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents';
import {
 budgetRemainWord,
 budgetSquareState,
 budgetStatusLevel,
} from '../../../helpers/budgetStatus';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import {
 OverviewExpenseCard,
 OverviewPnlCard,
 OverviewPocketCard,
} from '../../../types/overviewTypes';

// The locale is the reader's, never the amount's. Taken from the amount's own
// currency, Intl leaves every currency unmarked and the dollar, the Colombian
// peso and the Mexican peso all narrow to '$'.
const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// Rendered when a FIGURE did not arrive - a cell in a row of figures, where a
// dash is read as "not this one" against its neighbours. Never a 0: a withheld
// delta is one the server refused to invent.
const NO_FIGURE = '—';

// Rendered when a whole CLAUSE is absent, which is a different thing. A dash
// alone at the head of a sentence reads as a stray character rather than as a
// missing value, and it has no neighbours to be read against - so the sentence
// says why instead.
const NO_PRIOR_MONTH = 'no prior month to compare';

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
 if (delta === null) return NO_PRIOR_MONTH;
 if (delta === 0) return `no change vs prior month`;

 return `${delta > 0 ? '▲' : '▼'} ${money(currency, Math.abs(delta))} vs prior month`;
};

// The same clause with the arrow PAINTED, and it is used on Income alone.
//
// The colour says direction and not health, which is the debts module's rule
// (ListOfDebtors.tsx:239): the words "vs prior month" already carry the
// reading, and the hue is the second carrier for the eye that scans the column.
// Income is the only card where a direction is unambiguous and the only card
// with no status square, and both halves of that matter - --color-amount-* and
// the square's palette are the same teal and the same rose, so a card wearing
// both would be asking the reader to tell two colour systems apart at 12px.
const coloredDeltaLine = (delta: number | null, currency: string) => {
 if (delta === null) return NO_PRIOR_MONTH;
 if (delta === 0) return `no change vs prior month`;

 const direction = delta > 0 ? 'up' : 'down';

 return (
  <>
   <span className={`domainCard__delta--${direction}`}>
    {delta > 0 ? '▲' : '▼'} {money(currency, Math.abs(delta))}
   </span>{' '}
   vs prior month
  </>
 );
};

// The class the shared StatusSquare appends, and it is the vocabulary the
// pocket module already spells in helpers/pocketStatus.ts rather than a set
// invented for this page. '' is the bare square, which paints the base teal and
// means the reading was taken and asks nothing of the owner.
//
// 'unknown' is the one addition, and it is NOT calm: no answer is not a good
// answer. It has no counterpart in the pocket scale because a served pocket
// always carries a level, while an overview card can be missing the figure its
// reading depends on.
//
// FOUR CARDS OF SIX GET ONE. Income, Debt and Investment are deliberately
// without. Nothing income publishes is a health statement - a smaller month is
// a smaller month - owing more than you are owed is the ordinary condition of
// having a mortgage, and investment carries no target to be measured against
// yet. A square on any of the three would be a rule invented in the browser,
// and an indicator nobody can justify is worse than an absent one.
type SquareClass = '' | 'neutral' | 'info' | 'warning' | 'alert' | 'unknown';

// How far into the budget the month is, as the rate helpers/budgetStatus.ts
// reads its threshold against. Derived here and not served: the overview
// expense card publishes budgetAmount and categorizedExpense and no share
// between them, and this is the one division over the two.
//
// null in the two cases the budget module also withholds it: no budget in force
// (budgetAmount null, which also covers a category set spanning currencies) and
// a budget of zero, which has no denominator to divide by. Neither is a reading
// of 0% - one is an absent decision and the other is unmeasurable.
const executionPercentage = (card: OverviewExpenseCard): number | null => {
 if (!card.budgetAmount) return null;

 return (card.categorizedExpense / card.budgetAmount) * 100;
};

// The three readings of a budget, on the app's own scale: at, near and over the
// limit. BUDGET_NEAR_LIMIT_PERCENT is 75 and is a business rule the developer
// fixed on 2026-08-17, not something derived from the model - which is exactly
// why this card reads it from that file instead of choosing a number.
//
// The amber level is what the card could not say before: it had two readings,
// inside and over, so a month at 96% of its budget looked the same as one at 3%.
//
// budgetVariance is budgetAmount minus what was spent inside a LIVE CATEGORY, so
// it is negative when the budget was exceeded. Null is a month with no budget in
// force anywhere, which is an absent decision and not a breach.
const expenseSquare = (card: OverviewExpenseCard): SquareClass => {
 if (card.budgetVariance === null) return 'unknown';

 const level = budgetSquareState(
  executionPercentage(card),
  card.budgetVariance < 0,
 ) as SquareClass;

 // Spending that lost its category is not counted against the budget, so the
 // card can be inside its budget and still not know where the month went. It
 // only raises a reading that is otherwise quiet: a budget already over or near
 // its limit keeps the louder of the two.
 if (level === '' && card.hasUncategorizedExpense) return 'warning';

 return level;
};

// The budget verdict in words, which is what the card was missing: it printed
// the budget as a bare figure beside the spend and left the comparison to the
// reader. budgetVariance is the comparison, already computed by the server.
// One decimal, which is the budget module's own precision for a share
// (ListCategory.tsx and BudgetBigBoxResult.tsx both print toFixed(1)).
const SHARE_DECIMALS = 1;

// The word is budgetRemainWord's, the same one the four budget screens print, so
// the two modules cannot describe the same remainder with different verbs. It
// carries the sign, which is why the amount beside it is an absolute value.
//
// The share is SPENT and it says so, because the amount in front of it is the
// remainder: bare, the same parenthesis reads as 3.0% left, which is the
// opposite figure. BudgetBigBoxResult solves it the other way round, by letting
// the word before the parenthesis qualify it; here there are two candidates on
// the line, so the parenthesis names itself.
//
// It is painted by budgetStatusLevel, from the same call the square at the head
// of the line makes, so the number and the square cannot light differently for
// one card. That is the rule ListCategory.tsx:320-329 already follows for its
// own row.
const budgetClause = (card: OverviewExpenseCard) => {
 const word = budgetRemainWord(
  card.budgetAmount,
  card.categorizedExpense,
  card.budgetVariance,
 );

 if (!word) return null;

 const execution = executionPercentage(card);

 const remainder = `budget: ${money(
  card.currency,
  Math.abs(card.budgetVariance ?? 0),
 )} ${word}`;

 // Withheld rather than printed as a dash: the amount beside it is a whole
 // answer on its own, and a dash inside a parenthesis after it would read as a
 // broken figure instead of an absent one.
 if (execution === null) return remainder;

 return (
  <>
   {remainder}{' '}
   <span
    className={`domainCard__share domainCard__share--${budgetStatusLevel(
     execution,
     card.budgetVariance !== null && card.budgetVariance < 0,
    )}`}
   >
    ({execution.toFixed(SHARE_DECIMALS)}% spent)
   </span>
  </>
 );
};

// How much of the month's spending the budget verdict above did NOT cover.
//
// The server publishes a FLAG and never this amount, deliberately: it is
// totalAmount minus categorizedExpense, a subtraction over two fields already
// on the card, and a third field would be a second place for the same number to
// be wrong. The flag is what decides whether the clause appears at all - the
// subtraction alone can land on a fraction of a cent of binary float error and
// would print a clause for spending that does not exist.
//
// Without it the amber square says the reading is incomplete and gives the
// reader no way to tell whether that means a cent or half the month.
const uncategorizedClause = (card: OverviewExpenseCard) => {
 if (!card.hasUncategorizedExpense) return null;

 return `${money(
  card.currency,
  card.totalAmount - card.categorizedExpense,
 )} outside a category`;
};

// A losing month is the one health statement this card can make out of what it
// publishes, and it is the only card where the sign of the figure and the
// reading are the same thing.
const pnlSquare = (card: OverviewPnlCard): SquareClass =>
 card.totalAmount < 0 ? 'alert' : '';

// The pocket reading, against the TARGET, on the scale helpers/pocketStatus.ts
// declares for one pocket. That scale inverts the budget's: approaching the
// target is the point, so a pocket at 63% is not warned for succeeding.
//
// Three of the seven levels are reachable from an aggregate and four are not.
// ahead, onTrack and behind need a pace ratio against one deadline, and a total
// over every pocket has no single deadline to compute one from - so the middle
// of the scale collapses to 'neutral', which is the class onTrack itself takes.
// completed is a TICK and not a square in that module; here the aggregate can
// only be at or past its target, which is 'info' - notable, not wrong.
//
// progress is a rate OVER 100, not a ratio in 0-1.
const POCKET_TARGET_REACHED = 100;

const pocketSquare = (card: OverviewPocketCard): SquareClass => {
 // A deadline that passed outranks every other reading, exactly as it does on
 // the pocket board.
 if (card.overdueCount > 0) return 'alert';
 if (!card.target) return 'unknown';
 if (card.progress >= POCKET_TARGET_REACHED) return 'info';

 // A pocket with nothing funding it is short of the plan without being late,
 // which is what the amber level says on the board.
 return card.uncoveredCount > 0 ? 'warning' : 'neutral';
};

// "(2 lenders)" beside the leg, which is what the card could not say: an amount
// alone does not distinguish one obligation from nine.
//
// The vocabulary is the debts module's and is taken from the SIGN, not from the
// leg's own name: a balance below zero is money the user owes, so its
// counterparty is a LENDER (ListOfDebtors.tsx:216). Rendered only when the
// count is above zero - "(0 lenders)" beside a zero amount says the same thing
// twice.
const counterparties = (count: number, singular: string, plural: string) => {
 if (count <= 0) return null;

 return ` (${count} ${count === 1 ? singular : plural})`;
};

type CardProps = {
 label: string;
 // 'flow' is measured across the month, 'position' is read at its close. The
 // distinction is carried by this word and not by a colour, because the two
 // natures have no token of their own and inventing one would put an
 // unreviewed value in the palette.
 nature: 'flow' | 'position';
 // Absent on the three cards that publish no health statement, and absent is
 // not 'unknown': one says the domain has no such reading, the other says this
 // month's could not be taken.
 square?: SquareClass;
 children: React.ReactNode;
 sub: React.ReactNode;
};

// The month is NOT repeated on the card. All six read the same one, so six
// copies of the same period were six lines competing with the figures for the
// width they needed, which is what forced every caption down to a size that
// could not be read. The month is stated once above the grid and the card keeps
// the half that differs between cards: the nature.
const DomainCard = ({ label, nature, square, children, sub }: CardProps) => (
 <article className='domainCard'>
  <div className='domainCard__head'>
   <span className='domainCard__label'>{label}</span>
   <span className='domainCard__scope'>{nature}</span>
  </div>

  <div className='domainCard__figures'>{children}</div>

  {/* The square sits ON the subordinate line and not beside the card's name.
      It qualifies a reading, so it belongs next to the sentence that states
      the reading - against the name it would look like part of the title and
      say nothing about which figure it grades. */}
  <div className='domainCard__sub'>
   {square !== undefined && <StatusSquare alert={square} />}
   <span>{sub}</span>
  </div>
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

 const budget = budgetClause(expense);
 const uncategorized = uncategorizedClause(expense);

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
    sub={coloredDeltaLine(income.delta, income.currency)}
   >
    <div className='domainCard__figure'>
     {money(income.currency, income.totalAmount)}
    </div>
   </DomainCard>

   <DomainCard
    label='Expense'
    nature='flow'
    square={expenseSquare(expense)}
    sub={
     <>
      {/* The budget verdict leads, because it is the clause the square
          grades. Absent when no budget is in force or the categories span
          currencies, and the clause disappears with it rather than printing a
          zero budget. */}
      {budget}
      {budget && ' · '}
      {/* The reason the verdict above can be incomplete, and the clause the
          amber square is pointing at. Spending that lost its category is not
          counted against the budget, so the card can be inside its budget and
          still not know where the month went. */}
      {uncategorized}
      {uncategorized && ' · '}
      {deltaLine(expense.delta, expense.currency)}
     </>
    }
   >
    <div className='domainCard__figure'>
     {money(expense.currency, expense.totalAmount)}
    </div>
   </DomainCard>

   <DomainCard
    label='Debt'
    nature='position'
    sub={deltaLine(debt.delta, debt.currency)}
   >
    {/* Two legs and not one net. A net of −$550 does not distinguish "you owe
        550" from "you are owed 1,750 and you owe 2,300", which are opposite
        situations. Both print as positive magnitudes: the direction is in the
        wording, so a negative would be a double negative.

        Coloured by direction, the debts module's rule and its two tokens
        (debts-styles.css:457-463). The colour is the SECOND carrier - the
        words beside each figure say the same thing, which is what keeps the
        rows readable in monochrome and to an eye that cannot separate the two
        hues. */}
    <div className='domainCard__figure domainCard__figure--split'>
     <span className='domainCard__leg'>
      You owe{counterparties(debt.payableCount, 'lender', 'lenders')}
     </span>
     <b className='domainCard__amount--owing'>
      {money(debt.currency, debt.payable)}
     </b>
    </div>
    <div className='domainCard__figure domainCard__figure--split'>
     <span className='domainCard__leg'>
      You&rsquo;re owed
      {counterparties(debt.receivableCount, 'debtor', 'debtors')}
     </span>
     <b className='domainCard__amount--owed'>
      {money(debt.currency, debt.receivable)}
     </b>
    </div>
   </DomainCard>

   <DomainCard
    label='Pocket · committed'
    nature='position'
    square={pocketSquare(pocket)}
    sub={
     pocket.target
      ? `${money(pocket.currency, pocket.target)} target · ${money(
         pocket.currency,
         pocket.remaining,
        )} remaining`
      : 'no target set on any pocket'
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

   <DomainCard
    label='PnL'
    nature='flow'
    square={pnlSquare(pnl)}
    sub={
     <>
      {deltaLine(pnl.delta, pnl.currency)}
      {/* Where the result came from. The card is cut by MOVEMENT TYPE and not
          by account type - the account set is every account the owner holds
          except the system counterparty - so a realised result can land on any
          of them, and the split says how much of it was investment. It is a
          subordinate clause and never a second figure of equal weight. */}
      {pnl.realizedFromInvestment !== 0 &&
       ` · ${money(pnl.currency, pnl.realizedFromInvestment)} from investment`}
     </>
    }
   >
    {/* Signed, and a negative is a real answer here in a way it is not on an
        expense card: a losing month is a loss, not an absent figure. */}
    <div className='domainCard__figure'>
     {pnl.totalAmount > 0 ? '+' : ''}
     {money(pnl.currency, pnl.totalAmount)}
    </div>
   </DomainCard>
   </section>
  </>
 );
}

export default DomainCards;
