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
import CollapsibleBlock from './CollapsibleBlock';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents';
import {
 budgetRemainWord,
 budgetSquareState,
 budgetStatusLevel,
 BudgetStatusLevel,
} from '../../../helpers/budgetStatus';
import { ProgressTone } from '../../../general_components/progressBar/ProgressBar';
import { CardMetricBlock, CardMetricRow } from './CardMetricBlock';
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
// Past this, the share is dropped and the amount stands alone. Carlos read
// "766533.1% ($100,032.57)" off the investment card on 2026-09-09: the baseline
// was $13.05 and the month closed at $100,044.62, so the percentage is arithmetic
// that is true and tells the reader nothing the amount does not tell them
// better. Ten times over is where a rate stops being a comparison and starts
// being a magnitude.
const SHARE_CEILING = 1000;

const deltaShare = (delta: number, priorTotalAmount: number | null) => {
 if (priorTotalAmount === null || priorTotalAmount === 0) return null;

 const share = (delta / Math.abs(priorTotalAmount)) * 100;

 return Math.abs(share) >= SHARE_CEILING ? null : share;
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

// The same clause with the arrow PAINTED. THREE CARDS, not one, since 2026-09-09.
//
// The colour says direction and not health, which is the debts module's rule
// (ListOfDebtors.tsx:239): the words "vs prior month" already carry the reading,
// and the hue is the second carrier for the eye that scans the column.
//
// TWO TESTS DECIDE IT, and Income was simply the first card to pass both.
//
//  - The card must carry no status square. --color-amount-* and the square's
//    palette are the same teal and the same rose, so a card wearing both asks
//    the reader to tell two colour systems apart at 12px.
//  - Up must mean one thing on that card's figure and only one.
//
// Income, Debt and Investment pass. Debt carries no square and its headline is
// the NET (receivable - payable), so up is unambiguously better - either more is
// owed to the owner or the owner owes less. Investment carries no square and its
// change is measured on ledgerBalance, so up is a larger position.
//
// Expense, Pocket and PnL fail: each carries a square, and on Expense up is also
// worse rather than better.
//
// CARLOS READ THE DEBT ARROW THE OTHER WAY on 2026-09-09 - "aumento deberia ser
// rojo" - and the reading is the natural one for a card called Debt. It is the
// SIGNED NET that rose, not what is owed, which is why the card names both legs
// under the headline. The colour follows the figure the arrow is on.
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
  <CardMetricBlock
   label='Budget'
   amount={money(card.currency, card.budgetAmount)}
   progress={execution}
   progressLabel='Share of this budget spent this month'
   tone={BAR_TONE[level]}
   square={budgetSquareState(execution, isOver)}
   remainder={`${money(
    card.currency,
    Math.abs(card.budgetVariance ?? 0),
   )} ${word}`}
   // The share is SPENT and it says so. The amount to its left is the
   // remainder, and a bare percentage beside a remainder reads as the share
   // LEFT, which is the opposite figure. Empty when there is no share, which
   // the block then does not draw.
   share={execution === null ? '' : `${execution.toFixed(SHARE_DECIMALS)}% spent`}
   shareLevel={level}
  />
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

// One leg of the month's realised result, named by where it landed, as the same
// two-column row the block above uses for its head and its foot: what it is on
// the left, how much of it on the right.
//
// A ROW AND NOT THE BLOCK, because there is no proportion here. The two legs are
// not required to sum to the headline - the card says so where it renders them -
// so a bar over them would state a share of a whole they do not make up.
//
// Signed, and the sign is printed: a leg can be a loss while the headline is a
// gain, and an absolute value under a positive total would hide exactly that.
const RealizedRow = ({
 currency,
 amount,
 where,
}: {
 currency: string;
 amount: number;
 where: string;
}) => (
 <CardMetricRow
  subject={<span className='domainCard__aside'>Realised on {where}</span>}
  figure={
   <span className='domainCard__aside'>
    {amount > 0 ? '+' : ''}
    {money(currency, amount)}
   </span>
  }
 />
);

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

// The bar takes the SAME reading the square takes, so the two marks on the
// pocket block cannot light differently for one card. Every class pocketSquare
// hands out is already a tone by name except 'unknown', which means no target
// was set on any pocket - and with no target there is no denominator, no bar and
// nothing for this to answer.
const pocketBarTone = (square: SquareClass): ProgressTone =>
 square === 'unknown' || square === '' ? 'neutral' : square;

// The pocket goals, in the shape the expense card states its budget in. Carlos,
// 2026-09-09: "se puede usar el mismo layout de la zona de Budget que usaste en
// Expense".
//
//   Target                          $3,500.00
//   ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░
//   ■ $465.40 still to allocate     63.4% committed
//
// EVERY WORD IS THE POCKET MODULE'S, measured off the screens that already print
// these figures. 'Target' is the label PocketCard.tsx:232 gives the whole, and it
// is NAMED rather than joined by "of". 'Still to allocate' is the phrase
// PocketCard.tsx:241 gives the remainder, and 'committed' is the verb
// PocketBigBoxResult.tsx:988 gives the share. A fourth wording of the same three
// figures is what this page had until today.
//
// NO OVER-TARGET BRANCH, and it is measured rather than assumed: the server
// clamps remaining per pocket before summing it and reports the excess apart, and
// progress is coverage that never exceeds 100 by construction
// (overviewPocketService.js:136-139). The aggregate therefore cannot be over its
// target the way one pocket can.
//
// Absent when no pocket carries a target: there is no whole to measure a part
// against, so there is no reading, no bar and no square. The card falls back to
// the sentence that says so.
const PocketBlock = ({ card }: { card: OverviewPocketCard }) => {
 if (!card.target) return null;

 const square = pocketSquare(card);

 return (
  <CardMetricBlock
   // 'of every pocket' and not a bare 'Target', because the card sits under a
   // heading that says September 2026 and Carlos read the figure as the month's
   // - "1885.27 es el target del mes o el total?". It is neither read at a month
   // nor summed over one: target_amount is a column on the pocket row
   // (pocketRepository.js:89) and has no time bound at all, and the two figures
   // measured against it are cumulative to the close of the reference month.
   label='Target of every pocket'
   amount={money(card.currency, card.target)}
   progress={card.progress}
   progressLabel='Share of the pocket targets committed'
   tone={pocketBarTone(square)}
   square={square}
   remainder={`${money(card.currency, card.remaining)} still to allocate`}
   // 'overall progress' and NOT 'committed', which is the word the headline
   // above already spends on a different figure. progress is coverage -
   // SUM(MIN(allocated, target)) / SUM(target) - so on this board it reads 9.4%
   // while the headline reports $304.27 of a $1,885.27 target, which is 16.1%.
   // Two numbers under one word is a card contradicting itself. The phrase is
   // the served field's own name, the way the board hero states it
   // (PocketBigBoxResult.tsx:681).
   share={`${card.progress.toFixed(SHARE_DECIMALS)}% overall progress`}
   shareLevel={square === '' ? 'ok' : square}
  />
 );
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
// FOLDING LIVES IN THE SHELL AND NOWHERE ELSE. Carlos asked for the six cards
// to fold one at a time; putting the control here rather than at each call site
// is what keeps that from becoming six copies of the same three lines - and it
// is why a seventh card would fold without anyone remembering to make it.
//
// The head is what stays visible when a card is closed, so the reader still has
// the domain's name and its nature. The figure and the reading fold away
// together: a headline with its own reading removed would be a figure nobody
// can qualify.
const DomainCard = ({ label, nature, square, children, sub }: CardProps) => (
 <CollapsibleBlock
  variant='card'
  className='domainCard'
  head={
   <div className='domainCard__head'>
    <span className='domainCard__label'>{label}</span>
    <span className='domainCard__scope'>{nature}</span>
   </div>
  }
 >
  <div className='domainCard__figures'>{children}</div>

  {/* The square sits ON the subordinate line and not beside the card's name.
      It qualifies a reading, so it belongs next to the sentence that states
      the reading - against the name it would look like part of the title and
      say nothing about which figure it grades. */}
  <div className='domainCard__sub'>
   {square !== undefined && <StatusSquare alert={square} />}
   <span>{sub}</span>
  </div>
 </CollapsibleBlock>
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
    sub={coloredDeltaLine(debt)}
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

   {/* No square prop when the block draws one. The mark grades the reading
       against the target, so it belongs on that reading's line and not in
       front of the whole subtitle - the same correction the expense card took
       on 2026-09-09. With no target there is no reading, and the square comes
       back to the subtitle as the 'unknown' it is: no answer, said once. */}
   {/* No square prop when the block draws one. The mark grades the reading
       against the target, so it belongs on that reading's line and not in
       front of the whole subtitle - the same correction the expense card took
       on 2026-09-09. With no target there is no reading, and the square comes
       back to the subtitle as the 'unknown' it is: no answer, said once. */}
   <DomainCard
    label='Pocket · committed'
    nature='position'
    square={pocket.target ? undefined : pocketSquare(pocket)}
    sub={
     pocket.target ? (
      /* THE MONTH FIRST AND THE POSITION UNDER IT. Every figure in the block is
         cumulative - allocated to date, the whole target, what is still to
         allocate against it - and the card carried none of the month's own
         movement, which is what left Carlos asking whether 1885.27 was the
         month's target or the total. delta is summary.totalMovedInMonth, the
         net committed inside the reference month, and it is the only September
         figure this card has. */
      <div className='domainCard__lines'>
       <span>{deltaLine(pocket)}</span>

       <PocketBlock card={pocket} />
      </div>
     ) : (
      'no target set on any pocket'
     )
    }
   >
    <div className='domainCard__figure'>
     {money(pocket.currency, pocket.totalAmount)}
    </div>

    {/* THE TERM THAT MAKES THE CARD ADD UP. Without it a reader sums the
        headline and the remainder below and gets a third total: remaining is
        clamped per pocket before the server sums it, so a goal funded past its
        target contributes 0 to the gap rather than a negative. The identity is
        allocated - excess + remaining = target.

        It hangs off the HEADLINE and not off the remainder, which is where the
        board puts it and for the same reason: it is a part of this figure -
        money committed, past the goal it was committed to - and not a
        correction applied to the gap (PocketBigBoxResult.tsx:363-365).

        Drawn only when there is one. A line reading "$0.00 of it above goal"
        would be a correction to arithmetic that needs none. */}
    {pocket.excess !== null && pocket.excess > 0 && (
     <span className='domainCard__aside'>
      {money(pocket.currency, pocket.excess)} of it committed above goal
     </span>
    )}
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
       {coloredDeltaLine({
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

      {/* THE MONTH WITH NO RESULT SAYS SO. Carlos, 2026-09-09: "no se que
          significa ese monto mostrado". A headline of $0.00 over two legs that
          are both absent is a card that looks broken, and the two legs below
          cannot say "there were none" by staying away.

          transactionCount and not the total: a month CAN net to zero over real
          rows, and that is a different statement from a month with no row at
          all. Measured on fintrack_dev for September 2026 - the only movements
          of type 9 that month are the two the account-deletion path writes,
          worth -$60.00, and R212 excludes them, so the count is 0 and the
          figure is not a netting. */}
      {pnl.transactionCount === 0 && (
       <span className='domainCard__aside'>
        no realised result was recorded this month
       </span>
      )}

      {/* Zero is omitted rather than printed: a leg at zero is a leg that
          received nothing this month, and a row of zeroes under a headline
          reads as a breakdown that failed rather than as an empty leg. */}
      {pnl.realizedFromInvestment !== 0 && (
       <RealizedRow
        currency={pnl.currency}
        amount={pnl.realizedFromInvestment}
        where='investment accounts'
       />
      )}

      {pnl.realizedFromBank !== 0 && (
       <RealizedRow
        currency={pnl.currency}
        amount={pnl.realizedFromBank}
        where='bank accounts'
       />
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
