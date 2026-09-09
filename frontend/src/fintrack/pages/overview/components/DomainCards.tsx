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
 BudgetStatusLevel,
} from '../../../helpers/budgetStatus';
import { ProgressBar, ProgressTone } from '../../../general_components/progressBar/ProgressBar';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { useOverviewStore } from '../../../stores/useOverviewStore';
import { monthLabel } from '../helpers/monthLabel';
import {
 OverviewDomainCardBase,
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
//
// Its only reader was this file's copy of monthLabel, which now lives in
// helpers/monthLabel.ts with its own dash. Kept commented rather than removed:
// the next figure this file withholds needs exactly this constant.
// const NO_FIGURE = '—';

// Rendered when a whole CLAUSE is absent, which is a different thing. A dash
// alone at the head of a sentence reads as a stray character rather than as a
// missing value, and it has no neighbours to be read against - so the sentence
// says why instead.
//
// It now says only what it means. Until 2026-09-09 this clause also stood in for
// a prior month that existed and was incomplete, which is the case Carlos read
// off the screen: September said "no prior month to compare" with August sitting
// there holding a figure. That case is the caveat below, not this sentence.
const NO_PRIOR_MONTH = 'no prior month to compare';

// The caveat that qualifies a delta measured against a month the owner did not
// hold an account for the whole of. The card shows the comparison anyway - a
// partial baseline is a weaker comparison, not an absent one - and this says how
// far to trust it.
//
// A span of its own and not a word inside the sentence, for two reasons:
// .domainCard__sub is a wrapping flex row, so as a sibling it drops to the next
// line intact instead of splitting "$120" away from "vs prior month"; and it
// carries the server's full explanation in title, which the parenthetical alone
// is too short to hold.
const PARTIAL_PRIOR_MONTH_TITLE =
 'The oldest account was opened during the prior month, so the change is measured against a partial month.';

const partialCaveat = (
 <span className='domainCard__caveat' title={PARTIAL_PRIOR_MONTH_TITLE}>
  (partial)
 </span>
);

// The four fields any card's change line reads. A Pick and not the whole card,
// so the two functions below serve five domains without one of them being able
// to reach for a field only one of those five has.
type DeltaFields = Pick<
 OverviewDomainCardBase,
 'delta' | 'priorTotalAmount' | 'priorPeriodCoverage' | 'currency'
>;

const money = (currency: string, value: number) =>
 currencyFormat(currency, value, formatNumberCountry);

// The change as a SHARE of the month it is measured against, which is what
// Carlos asked the card to lead with on 2026-09-09.
//
// The denominator is an absolute value and that is not cosmetic: pnl and debt
// totals are signed, so a move from -100 to -50 divided by -100 reads as -50% -
// a fall, printed beside an arrow pointing up. |denominator| keeps the sign of
// the share equal to the sign of the change.
//
// null when the prior month was 0, and the line then shows the amount alone:
// there is no share of nothing, and both 'Infinity%' and '100%' would be
// inventions. null also when the card published no baseline at all.
const deltaShare = (delta: number, priorTotalAmount: number | null) => {
 if (priorTotalAmount === null || priorTotalAmount === 0) return null;

 return (delta / Math.abs(priorTotalAmount)) * 100;
};

// The change, as the card states it: the share first because it is the reading,
// the amount after it in parentheses because it is the evidence. One function
// for the figures, so the plain and the coloured line below cannot format the
// same comparison two ways.
const deltaFigures = (delta: number, priorTotalAmount: number | null, currency: string) => {
 const share = deltaShare(delta, priorTotalAmount);
 const amount = money(currency, Math.abs(delta));

 if (share === null) return amount;

 return `${Math.abs(share).toFixed(SHARE_DECIMALS)}% (${amount})`;
};

// The delta is an AMOUNT and not a rate, because the prior month's own figure is
// not published: deriving a percentage here would mean inventing the
// denominator. The arrow carries the direction so the sign does not have to be
// read off the digits.
const deltaLine = ({ delta, priorTotalAmount, priorPeriodCoverage, currency }: DeltaFields) => {
 if (delta === null) return NO_PRIOR_MONTH;

 const caveat = priorPeriodCoverage === 'partial' ? <>{' '}{partialCaveat}</> : null;

 if (delta === 0) return <>no change vs prior month{caveat}</>;

 return (
  <>
   {delta > 0 ? '▲' : '▼'} {deltaFigures(delta, priorTotalAmount, currency)} vs prior month
   {caveat}
  </>
 );
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
const coloredDeltaLine = (
 { delta, priorTotalAmount, priorPeriodCoverage, currency }: DeltaFields,
) => {
 if (delta === null) return NO_PRIOR_MONTH;

 const caveat = priorPeriodCoverage === 'partial' ? <>{' '}{partialCaveat}</> : null;

 if (delta === 0) return <>no change vs prior month{caveat}</>;

 const direction = delta > 0 ? 'up' : 'down';

 return (
  <>
   <span className={`domainCard__delta--${direction}`}>
    {delta > 0 ? '▲' : '▼'} {deltaFigures(delta, priorTotalAmount, currency)}
   </span>{' '}
   vs prior month
   {caveat}
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

 // totalAmount and not categorizedExpense, the same universe budgetVariance is
 // measured over since 2026-09-08. The share and the remainder beside it are
 // two readings of one comparison, and reading them off different numerators
 // would let the card print "$5 left (140% spent)".
 return (card.totalAmount / card.budgetAmount) * 100;
};

// The three readings of a budget, on the app's own scale: at, near and over the
// limit. BUDGET_NEAR_LIMIT_PERCENT is 75 and is a business rule the developer
// fixed on 2026-08-17, not something derived from the model - which is exactly
// why this card reads it from that file instead of choosing a number.
//
// The amber level is what the card could not say before: it had two readings,
// inside and over, so a month at 96% of its budget looked the same as one at 3%.
//
// budgetVariance is budgetAmount minus the month's WHOLE spending, so it is
// negative when the budget was exceeded. Null is a month with no budget in force
// anywhere, which is an absent decision and not a breach.
// One decimal, which is the budget module's own precision for a share
// (ListCategory.tsx and BudgetBigBoxResult.tsx both print toFixed(1)). The
// change against the prior month prints at the same precision, so the two
// percentages on an Expense card are read on one scale.
const SHARE_DECIMALS = 1;

// The bar's tone, from the SAME call the square and the percentage make.
// budgetStatusLevel speaks in ok/near/over and the shared bar in the status
// vocabulary, so this is a rename and not a second decision - which is the
// point: three marks on one block lighting from three calls is how a row ends
// up contradicting itself.
const BAR_TONE: Record<BudgetStatusLevel, ProgressTone> = {
 ok: 'ok',
 near: 'warning',
 over: 'alert',
};

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
// The month's budget, named and given its own figure. Carlos, 2026-09-09:
// "Budget con el mismo style de Expense pero al lado el valor del budget del
// mes". Until now the card printed the REMAINDER and never the ceiling it was
// measured against, so a reader could see "$500 left" without knowing whether
// the month's budget was $600 or $6,000.
//
// The month's budget, as one block of three rows rather than a clause inside a
// sentence. Carlos, 2026-09-09: the card printed the REMAINDER and never the
// ceiling it was measured against, so a reader saw "$500 left" without knowing
// whether the month's budget was $600 or $6,000.
//
//   Budget                          $3,500.00
//   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░
//   ■ $465.40 left                  86.7% spent
//
// The bar is what a percentage cannot do: a budget is a part of a whole and a
// bar states the proportion at a glance. It does not replace the figure, which
// stays because the bar is approximate and the number is exact.
//
// THE SQUARE LIVES HERE and not at the head of the card's whole subtitle, which
// is where it was until 2026-09-09 - a 12px mark in front of the word Budget,
// grading a block it was not inside. It grades this reading, so it sits on this
// reading's line.
//
// The whole block is absent when no budget is in force, or when the category
// accounts span currencies and V1 will not add across them. Absent and not
// blanked: there is no reading to report, so there is no square either. Every
// mark this card makes comes from spending measured against the budget, and
// with no budget there is no measurement.
const BudgetBlock = ({ card }: { card: OverviewExpenseCard }) => {
 // The middle argument is what the variance was measured against, so it is
 // totalAmount: budgetRemainWord reads the pair to tell an unbudgeted card from
 // one at zero, and handing it the other figure would answer for a comparison
 // the card is no longer making.
 const word = budgetRemainWord(
  card.budgetAmount,
  card.totalAmount,
  card.budgetVariance,
 );

 if (card.budgetAmount === null || !word) return null;

 const execution = executionPercentage(card);
 const isOver = card.budgetVariance !== null && card.budgetVariance < 0;
 const level = budgetStatusLevel(execution, isOver);

 return (
  <div className='domainCard__budget'>
   <div className='domainCard__budgetHead'>
    <span className='domainCard__budgetLabel'>Budget</span>
    <span className='domainCard__budgetAmount'>
     {money(card.currency, card.budgetAmount)}
    </span>
   </div>

   {/* Withheld and not drawn empty when the share is unmeasurable, which is a
       zero budget: an empty track states that nothing has been spent, and the
       remainder beside it says otherwise. */}
   {execution !== null && (
    <ProgressBar
     value={execution}
     tone={BAR_TONE[level]}
     label='Share of this budget spent this month'
    />
   )}

   <div className='domainCard__budgetFoot'>
    <span className='domainCard__budgetRemainder'>
     <StatusSquare alert={budgetSquareState(execution, isOver)} />
     {money(card.currency, Math.abs(card.budgetVariance ?? 0))} {word}
    </span>

    {/* The share is SPENT and it says so. The amount to its left is the
        remainder, and a bare percentage beside a remainder reads as the share
        LEFT, which is the opposite figure. */}
    {execution !== null && (
     <span className={`domainCard__share domainCard__share--${level}`}>
      {execution.toFixed(SHARE_DECIMALS)}% spent
     </span>
    )}
   </div>
  </div>
 );
};

// How much of the month's spending resolves to no live category.
//
// A DATUM AND NOTHING ELSE. Carlos, 2026-09-09: "para mi es solo un dato, no se
// hace ninguna comparacion o alerta, nada (...) todos los alertas de expense es
// resultado de la comparacion de expense spent vs el budget". So it carries no
// square, no colour and no place in any verdict - it is shown when there is
// some and omitted when there is none. Until today it forced a red square onto
// the card ahead of the budget reading, which put an alert on the one figure
// that is not a comparison.
//
// The server publishes a FLAG and never this amount, deliberately: it is
// totalAmount minus categorizedExpense, a subtraction over two fields already
// on the card, and a third field would be a second place for the same number to
// be wrong. The flag is what decides whether the clause appears at all - the
// subtraction alone can land on a fraction of a cent of binary float error and
// would print a clause for spending that does not exist.
const uncategorizedClause = (card: OverviewExpenseCard) => {
 if (!card.hasUncategorizedExpense) return null;

 return `${money(
  card.currency,
  card.totalAmount - card.categorizedExpense,
 )} outside a category`;
};

// One leg of the month's realised result, named by where it landed. Signed, and
// the sign is printed: a leg can be a loss while the headline is a gain, and an
// absolute value under a positive total would hide exactly that.
const realizedLine = (currency: string, amount: number, where: string) =>
 `Realised on ${where}: ${amount > 0 ? '+' : ''}${money(currency, amount)}`;

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
//
// Number.isFinite and not `count <= 0`, because the comparison lets undefined
// through: `undefined <= 0` is false, so an absent field printed the word
// "undefined" beside the amount. The field is absent whenever the answering
// backend predates the two counts, which the type cannot catch - a response is
// parsed, not checked.
const counterparties = (
 count: number | undefined,
 singular: string,
 plural: string,
) => {
 if (!Number.isFinite(count) || (count as number) <= 0) return null;

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
    sub={coloredDeltaLine(income)}
   >
    <div className='domainCard__figure'>
     {money(income.currency, income.totalAmount)}
    </div>
   </DomainCard>

   {/* No square prop, and that is the change of 2026-09-09: the card's one
       mark belongs to the budget reading and now sits inside BudgetBlock, on
       the line it grades. Passed here it sat in front of the whole subtitle,
       which is why it read as a stray dash before the word Budget. */}
   <DomainCard
    label='Expense'
    nature='flow'
    sub={
     /* ROWS and not one wrapping sentence, which is the shape Carlos drew on
        2026-09-09: the change, then the budget, then what is left of it. The
        four clauses were competing for one line and the separators between
        them ( · ) were doing the work a line break does better.

        Expense is the only card with more than one clause, so the column lives
        here and .domainCard__sub stays the row that holds the square. */
     <div className='domainCard__lines'>
      {/* Closest to the figure above it, because it is a reading OF that
          figure rather than of the budget. */}
      <span>{deltaLine(expense)}</span>

      <BudgetBlock card={expense} />

      {/* Last, quietest, and unqualified. It is spending the budget reading
          above does not account for - worth knowing, and not a verdict. */}
      {uncategorized && (
       <span className='domainCard__aside'>{uncategorized}</span>
      )}
     </div>
    }
   >
    <div className='domainCard__figure'>
     {money(expense.currency, expense.totalAmount)}
    </div>
   </DomainCard>

   <DomainCard
    label='Debt'
    nature='position'
    sub={deltaLine(debt)}
   >
    {/* The net across every counterparty, in the headline the other five
        cards give totalAmount. It keeps its sign and takes no colour, the
        rule the debts board's hero already follows for the same figure
        (DebtsBigBoxResult.tsx:64-67): a net is a position and not a
        direction, and the two legs under it are what say which way it leans.

        The legs stay for that reason. A net of -$550 on its own does not
        distinguish "you owe 550" from "you are owed 1,750 and you owe 2,300",
        which are opposite situations - the decomposition below is what makes
        the headline readable rather than a second reading of it. */}
    <div className='domainCard__figure'>
     {money(debt.currency, debt.totalAmount)}
    </div>

    {/* The secondary readings: each leg's magnitude and how many
        counterparties it is made of. Both print unsigned - the direction is
        in the wording, so a negative would be a double negative.

        Coloured by direction, the debts module's rule and its two tokens
        (debts-styles.css:457-463). The colour is the SECOND carrier - the
        words beside each figure say the same thing, which is what keeps the
        rows readable in monochrome and to an eye that cannot separate the two
        hues. The counts take no colour: they are not amounts. */}
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
     /* Two rows, the change over the account count, which is the order the PnL
        card below uses: the comparison is what the reader came for and the
        count is the context it sits in.

        THE CARD IS THE ONE DOMAIN WITH NO delta FIELD, because §6 gives it no
        totalAmount to measure one on. The server publishes the comparison under
        the figure it is actually measured on - the ledger balance - and this
        maps those three fields onto the shape deltaLine reads, so the sentence
        the reader gets is word for word the one on the other five cards rather
        than a second wording of the same idea. */
     <div className='domainCard__lines'>
      <span>
       {deltaLine({
        delta: investment.ledgerBalanceDelta,
        priorTotalAmount: investment.priorLedgerBalance,
        priorPeriodCoverage: investment.priorPeriodCoverage,
        currency: investment.currency,
       })}
      </span>

      <span className='domainCard__aside'>
       {investment.accountCount === 1
        ? '1 account — the count is as of today'
        : `${investment.accountCount} accounts — the count is as of today`}
      </span>
     </div>
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
     /* Where the result came from, as two rows under the change. The card is
        cut by MOVEMENT TYPE and not by account type - the account set is every
        account the owner holds except the system counterparty - so a realised
        result can land on any of them, and these two say where it landed.

        BOTH ARE MEASURED. Until 2026-09-09 only the investment leg was served
        and the other was going to be stated as the remainder; the remainder is
        "every account that is not an investment account", which includes the
        owner's debtor and pocket accounts, so naming it "bank" would have put a
        label on a subtraction. The second filter costs one line of SQL and
        makes the figure auditable.

        They are not shown as parts of a sum and no total is drawn under them,
        because they are not required to add up to the headline. */
     <div className='domainCard__lines'>
      <span>{deltaLine(pnl)}</span>

      {/* Zero is omitted rather than printed: a leg at zero is a leg that
          received nothing this month, and a row of zeroes under a headline
          reads as a breakdown that failed rather than as an empty leg. */}
      {pnl.realizedFromInvestment !== 0 && (
       <span className='domainCard__aside'>
        {realizedLine(pnl.currency, pnl.realizedFromInvestment, 'investment accounts')}
       </span>
      )}

      {pnl.realizedFromBank !== 0 && (
       <span className='domainCard__aside'>
        {realizedLine(pnl.currency, pnl.realizedFromBank, 'bank accounts')}
       </span>
      )}
     </div>
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
