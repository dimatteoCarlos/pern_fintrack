// frontend/src/fintrack/pages/budget/components/budgetEditModal/BudgetEditModal.tsx
// 💵 BUDGET EDIT MODAL: the form that writes one month of a budget
//
// The module has read and never written since it was built. This states an
// amount for the month on screen and how far forward it reaches: this month
// alone, up to a month the user names, or every month from here on.
//
// It owns no request. The amount travels to the caller through onSave, which
// resolves with the server's answer so this can word what next month goes back
// to without asking a second time.
//
// The payload states its own range: PUT /budget/accounts/:accountId/current
// takes a first month and a last one, so a save reaches as far as it was told
// to. The caller is what refuses to open this over a past month.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
 CURRENCY_OPTIONS,
 DEFAULT_CURRENCY,
} from '../../../../helpers/currencyConstants';
import CurrencyBadge from '../../../../general_components/currencyBadge/CurrencyBadge';
import RateTooltip from '../../../../general_components/rateTooltip/RateTooltip';
import { StatusSquare } from '../../../../general_components/boxComponents/BoxComponents';
// The one place the three readings of a budget are decided. Imported rather than
// re-derived: a panel that computes its own word is a fifth screen free to
// disagree with the four that call this.
import {
 budgetRemainWord,
 budgetSquareState,
 isUnbudgeted,
} from '../../../../helpers/budgetStatus';
// VARIANT_DEFAULT and not VARIANT_FORM: 'form' paints the badge cream, which is
// the variant for the app's dark forms and is invisible on this white dialog.
// 'tracker' is the one that names a light surface.
import {
 DATE_TEXT_FORMAT,
 VARIANT_DEFAULT,
} from '../../../../helpers/constants';
import { numberFormatCurrency } from '../../../../helpers/functions';
import { useCurrencyPreview } from '../../../../hooks/useCurrencyPreview';
import { CurrencyType } from '../../../../types/types';
import {
 OPEN_ENDED,
 BudgetErrorResponse,
 BudgetNature,
 BudgetWriteRequest,
 BudgetWriteResponse,
} from '../../../../types/budgetTypes';

import './styles/budgetEditModal-styles.css';

type BudgetEditModalPropsType = {
 accountName: string;
 // What the account is for, as the level-2 row already tags it. Nullable
 // because the column is: a row without one renders no tag rather than a blank.
 nature: BudgetNature | null;
 // The month the figures below are about, as 'YYYY-MM-01'.
 month: string;
 currency: CurrencyType;
 // The four figures the form reads. currentAmount is the row's budgetAmount;
 // an amount is decided against what was already spent, so the three that
 // qualify it travel with it rather than staying on the row behind the panel.
 currentAmount: number;
 nextMonthBudget: number;
 actualSpent: number;
 remainingBudget: number;
 // The server's own reading of those figures: what share of the budget the
 // spend is, and whether it was exceeded. Served rather than derived here, so
 // the panel lights the same square as the row it opened from. Both nullable
 // for the same reason the contract makes them so — a share has no denominator
 // over a budget of zero.
 executionPercentage: number | null;
 isOverBudget: boolean | null;
 isSaving: boolean;
 // The whole §7.5 envelope, not a sentence: its errors[] names the field each
 // issue belongs to, which is what lets the message sit beside that field. A
 // 400's own message is the constant 'Validation Error' and says nothing.
 error: BudgetErrorResponse | null;
 onClose: () => void;
 // Takes the whole payload and not an amount plus a flag: this form is what
 // decides the range, so the caller only has the accountId left to add.
 // Resolves with what the server wrote, or null when the caller has nothing
 // wired yet. The response is what states the month the exception expires on.
 onSave: (allocation: BudgetWriteRequest) => Promise<BudgetWriteResponse | null>;
};

const TITLE_ID = 'budgetEditTitle';

// How far the month selector reaches, counting the month on screen. An
// interface limit and not a server rule: the write path puts no ceiling on
// appliesUntil, so widening this is a change to this number and nothing else.
const MAX_RANGE_MONTHS = 12;

// The three shapes appliesUntil can take, named rather than derived from the
// value: 'thisMonth' and 'untilMonth' both send a month, and only the mode
// tells them apart before one is picked.
type RangeModeType = 'thisMonth' | 'untilMonth' | 'recurring';

// Declared as data so the three tiles are one loop: written out, the middle one
// drifts from its neighbours every time the row is restyled.
// Digits and at most one dot. type='number' accepts '3200e90' and Number()
// reports it finite, so every guard downstream passed and the conversion
// preview printed a ninety-digit figure. No sign either: the field is
// nonnegative.
const PLAIN_DECIMAL = /^\d*\.?\d*$/;

// The limit NewPocket already puts on its Target Amount (:407). Taken from
// there rather than chosen here, so two money fields of the same app do not
// disagree about how long an amount may be.
const MAX_AMOUNT_LENGTH = 15;

const RANGE_MODES: { value: RangeModeType; label: string }[] = [
 { value: 'thisMonth', label: 'This month' },
 { value: 'untilMonth', label: 'Until…' },
 { value: 'recurring', label: 'Every month' },
];

// Built from the parts and never from new Date(month): that string parses as UTC
// midnight, so west of Greenwich it renders the previous month.
const formatMonth = (month: string) => {
 const [year, monthNumber] = month.split('-').map(Number);
 if (!year || !monthNumber) return month;

 return new Date(year, monthNumber - 1, 1).toLocaleDateString(DATE_TEXT_FORMAT, {
  month: 'long',
  year: 'numeric',
 });
};

// The `count` months that follow `month`, as 'YYYY-MM-01'. Reassembled from the
// parts for the same reason formatMonth is: a Date built from the string is UTC
// midnight, and adding to it west of Greenwich lands a month early.
const monthsAfter = (month: string, count: number) => {
 const [year, monthNumber] = month.split('-').map(Number);
 if (!year || !monthNumber) return [];

 return Array.from({ length: count }, (_, index) => {
  const offset = monthNumber + index;

  return `${year + Math.floor(offset / 12)}-${String((offset % 12) + 1).padStart(2, '0')}-01`;
 });
};

function BudgetEditModal({
 accountName,
 nature,
 month,
 currency,
 currentAmount,
 nextMonthBudget,
 actualSpent,
 remainingBudget,
 executionPercentage,
 isOverBudget,
 isSaving,
 error,
 onClose,
 onSave,
}: BudgetEditModalPropsType) {
 const panelRef = useRef<HTMLDivElement>(null);
 const amountRef = useRef<HTMLInputElement>(null);

 // Empty rather than prefilled. The figure being replaced is already stated in
 // the strip above, so seeding the field with it only made the panel open
 // holding a decision nobody had taken yet: Save dark over a value the user did
 // not type, and a caret sitting on someone else's number.
 const [amount, setAmount] = useState('');

 // This month is already an exception when the next one does not inherit it.
 // Opening on 'recurring' over one would let a save turn it recurring unasked.
 //
 // 'untilMonth' is never the initial mode: the status payload carries this
 // month and the next one, so a terminator further out is invisible from here.
 const initialRangeMode: RangeModeType =
  nextMonthBudget !== currentAmount ? 'thisMonth' : 'recurring';
 const [rangeMode, setRangeMode] = useState<RangeModeType>(initialRangeMode);

 // One short of MAX_RANGE_MONTHS: the month on screen is the first radio, not
 // an option of this list.
 const rangeOptions = useMemo(
  () => monthsAfter(month, MAX_RANGE_MONTHS - 1),
  [month],
 );
 const [untilMonth, setUntilMonth] = useState(() => rangeOptions[0] ?? month);

 // The currency the user states the amount in. It travels: the write schema
 // requires it and the server converts against it, so moving the badge alone is
 // a different budget rather than a change the payload cannot express.
 const [originCurrency, setOriginCurrency] = useState<CurrencyType>(currency);

 // Removal is a two-step in place. The contract has reserved 0 for it since the
 // validator was written and no control ever sent it, so the only way to stop
 // budgeting was to type a zero — and nobody reads a zero as a decision.
 const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);

 useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
   if (event.key === 'Escape') onClose();
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => window.removeEventListener('keydown', handleKeyDown);
 }, [onClose]);

 // What makes the panel actually modal, and neither half works without the
 // other. role='dialog' and aria-modal announce a modal; they do not enforce
 // one. Until now the page behind stayed tabbable, so Tab walked out of the
 // panel into the rows and the navbar, and the wheel scrolled the list under
 // the overlay instead of the panel over it.
 //
 // inert on #root and not on a page section: the header and the bottom navbar
 // are rendered by Layout, outside whichever screen mounted this panel, so a
 // narrower target leaves them reachable. The panel escapes it by being
 // portalled to body, a sibling of #root rather than a descendant.
 //
 // The overflow is captured and restored rather than cleared: another overlay
 // may already hold the lock, and writing '' would hand the scroll back while
 // that one is still open.
 useEffect(() => {
  const root = document.getElementById('root');
  const previousOverflow = document.body.style.overflow;
  // The control that opened the panel, captured before inert blurs whatever it
  // covers. It rides in this effect and not one of its own because the restore
  // has to be sequenced against the removeAttribute below.
  const previouslyFocused = document.activeElement;

  root?.setAttribute('inert', '');
  document.body.style.overflow = 'hidden';

  return () => {
   root?.removeAttribute('inert');
   document.body.style.overflow = previousOverflow;
   // After removeAttribute and never before: focus() on a node still inside
   // inert content is a no-op.
   if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
  };
 }, []);

 // The caret lands on the amount, which is the one thing this panel writes:
 // a modal that opens with the focus on its own frame makes the reader hunt for
 // the field. select() rather than focus() so the prefilled figure is replaced
 // by typing instead of appended to.
 //
 // Runs once, not on every onClose identity: the caller rebuilds that callback
 // each render, and re-selecting on each one would fight the caret mid-edit.
 useEffect(() => {
  const input = amountRef.current;

  if (input) input.select();
  else panelRef.current?.focus();
 }, []);

 const locale = CURRENCY_OPTIONS[currency ?? DEFAULT_CURRENCY];
 const asMoney = (value: number) =>
  numberFormatCurrency(value, 2, currency, locale);

 // The word and the square the other four budget screens paint, from the helper
 // that owns the threshold. Derived by hand, this row stated the excess as a
 // plain figure and flagged nothing: the panel that decides the next amount was
 // the one place in the module where an exceeded budget did not look exceeded.
 //
 // The square is withheld on an unbudgeted account for the same reason level 3
 // withholds it: nothing budgeted and nothing spent is no reading, not a healthy
 // one.
 const unbudgeted = isUnbudgeted(currentAmount, actualSpent);
 const isOver =
  budgetRemainWord(currentAmount, actualSpent, remainingBudget) === 'over';

 // An empty field is not an incomplete form: it means the amount stays as it
 // is. That is what lets the range alone be changed and saved — retyping the
 // figure already on screen to move a boundary is work the panel invented.
 const isBlank = amount.trim() === '';
 const parsedAmount = isBlank ? currentAmount : Number(amount);
 const isNumber = isBlank || Number.isFinite(Number(amount));

 // Would store as 0.00 while not being a zero the user typed. The service
 // rejects it; saying so here costs no round trip.
 const isSubCent =
  isNumber && parsedAmount > 0 && Math.round(parsedAmount * 100) === 0;

 // What the three radios resolve to on the wire. 'thisMonth' sends the month
 // itself: a range whose last month is its first is the exception.
 const appliesUntil =
  rangeMode === 'thisMonth'
   ? month
   : rangeMode === 'untilMonth'
     ? untilMonth
     : OPEN_ENDED;

 // Compared on the resulting appliesUntil rather than on the mode, because the
 // mode plus the selected month is the same decision stated twice.
 const initialAppliesUntil =
  initialRangeMode === 'thisMonth' ? month : OPEN_ENDED;

 // The currency counts. Stating the same figure in another currency is a
 // different budget, and the server now stores the conversion — so a save that
 // only moved the badge writes a genuinely different amount.
 const isUnchanged =
  isNumber &&
  parsedAmount === currentAmount &&
  originCurrency === currency &&
  appliesUntil === initialAppliesUntil;

 // Compared against the empty field the panel now opens with, not against the
 // stored amount: an untouched form is one nothing has been typed into, and an
 // overlay click has to close that one.
 const isDirty =
  amount !== '' ||
  originCurrency !== currency ||
  appliesUntil !== initialAppliesUntil;

 const canSave = isNumber && !isSubCent && !isUnchanged && !isSaving;

 // Reads the rates already held in the store, so it issues no request. Returns
 // nulls when the typed currency is the accounting one, which is the common
 // case and renders nothing.
 //
 // The amount sent is the one typed, NOT the converted figure: that is what
 // NewCategory, NewPocket, NewAccount and NewProfile all do, and a fifth form
 // converting on its own would make the same input mean two different things.
 const { targetCurrencyPreview, rate, direction } = useCurrencyPreview(
  amount,
  originCurrency,
 );

 const rateTooltip =
  rate && direction
   ? `${direction}\nrate: ${numberFormatCurrency(rate, 2, undefined, 'es-ES')}`
   : '';

 // What Left becomes if this amount is saved, recomputed on every keystroke.
 // Spending is already known, so the figure needs no round trip — and deciding
 // a budget against what is left of it is the whole reason the strip is here.
 //
 // Withheld while a conversion is on screen: actualSpent arrives in the
 // accounting currency and the typed amount is not in it, so the subtraction
 // would be two units apart. The figures above stay as the server sent them.
 const previewRemaining =
  isNumber && !isUnchanged && !targetCurrencyPreview
   ? parsedAmount - actualSpent
   : null;

 // Kept rather than dropped: the server is the only party that knows what the
 // month after the range goes back to, and saying so is the point of writing a
 // bounded one. Cleared on any edit, so it never describes a form that moved.
 const [saved, setSaved] = useState<BudgetWriteResponse | null>(null);

 // The confirmation describes the write that produced it, so any edit to what
 // would be written next invalidates it.
 //
 // Called from the handlers and not from an effect on [amount, appliesUntil]:
 // the save empties the field itself, and an effect cannot tell that write from
 // a keystroke — it wiped the confirmation in the same frame it appeared.
 const clearSaved = () => setSaved(null);

 const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  if (!canSave) return;

  const response = await onSave({
   amount: parsedAmount,
   currency: originCurrency,
   month,
   appliesUntil,
  });
  setSaved(response);

  // Emptied on the way out, the same state the panel opens in: the figure just
  // written is now the one in the strip above, and a field still holding it
  // would offer to write it a second time.
  if (response) setAmount('');
 };

 // Open-ended on purpose, and the confirmation says so. Stopping is a standing
 // decision about the account, not a figure for one month: a zero bounded to
 // this month is still budgeting, and the amount field with the range selector
 // already expresses that.
 //
 // The same onSave the form uses, so this adds no endpoint and no prop on the
 // caller — and the confirmation the panel renders afterwards is the one the
 // write path already produces.
 const handleRemove = async () => {
  const response = await onSave({
   amount: 0,
   currency: originCurrency,
   month,
   appliesUntil: OPEN_ENDED,
  });

  setIsConfirmingRemoval(false);
  setSaved(response);

  if (response) setAmount('');
 };

 // Not offered when there is nothing to remove: an account whose budget is
 // already 0 is byte-identical to one that never had a budget, so the control
 // would write a change that changes nothing.
 const canRemove = currentAmount > 0 && !saved && !isSaving;

 // One issue per field, first wins. The server may name the same field twice;
 // stacking both under one input says the same thing louder, not clearer.
 const issueFor = (field: string) =>
  error?.errors?.find((issue) => issue.field === field)?.message ?? null;

 // What no field claims. A 422 from the service carries no errors[] at all, and
 // its message is the one sentence that explains the refusal.
 const unfieldedError =
  error && !error.errors?.length
   ? error.message
   : (error?.errors?.filter(
       (issue) =>
         !['amount', 'currency', 'month', 'appliesUntil'].includes(issue.field),
      ) ?? [])
       .map((issue) => issue.message)
       .join(' ') || null;

 // Reads the two fields the response exists for. restoresTo is a number on
 // every bounded write and null only on an open-ended one, which ends nothing.
 //
 // Split in two: the first line confirms, the second states what the write did
 // to the months after it. Run together they read as one long sentence and the
 // confirmation stops being one.
 const savedDetail = (() => {
  if (!saved) return null;

  // Said first when the two currencies differ: the figure in every sentence
  // below is the converted one, and without this line it reads as a number the
  // user never typed.
  const converted =
   saved.originalCurrency !== saved.currency
    ? `${numberFormatCurrency(saved.originalAmount, 2, saved.originalCurrency, CURRENCY_OPTIONS[saved.originalCurrency])} converted at ${saved.exchangeRate}. `
    : '';

  const replaced =
   saved.overwrittenMonths.length > 0
    ? ` ${saved.overwrittenMonths.length} later month${saved.overwrittenMonths.length > 1 ? 's' : ''} replaced.`
    : '';

  if (saved.restoresFrom === null) {
   return `${converted}${asMoney(saved.budgetAmount)} applies from ${formatMonth(saved.budgetMonth)} onwards.${replaced}`;
  }

  const back =
   saved.restoresTo === 0
    ? 'this account has no budget'
    : `the budget goes back to ${asMoney(saved.restoresTo ?? 0)}`;

  return `${converted}From ${formatMonth(saved.restoresFrom)} ${back}.${replaced}`;
 })();

 // One slot under the field, for what the typed amount itself says: it would
 // round to zero, or this is what it would leave. Never both — a block per
 // message made the panel grow and shrink under the pointer as it was typed,
 // which is what the reserved line exists to stop. Each sentence is kept short
 // enough for one line at --font-size-xs, since a second line moves everything
 // below it.
 const amountNote = isSubCent
  ? 'An amount under one cent would be stored as zero.'
  : previewRemaining !== null
    ? `${previewRemaining < 0 ? 'Over' : 'Left'} after saving ${asMoney(Math.abs(previewRemaining))}`
    : null;

 // One box above the buttons, for every answer to the same question: what did,
 // or did not, happen to this form. A confirmation, a refusal no field claimed,
 // and the reason Save is dark were three blocks that each appeared out of
 // nowhere; here they share the two lines the box already reserves, so none of
 // them adds height to the panel.
 //
 // Order is by how recent: a result the user just produced outranks a standing
 // explanation of why they cannot produce one.
 // The pending question outranks every one of them, and it lands in this box
 // rather than in a block of its own for the reason the box exists: a paragraph
 // that appears between the fields and the buttons moves the buttons out from
 // under the pointer that is about to press one.
 const [reportTone, reportTitle, reportDetail] = isConfirmingRemoval
  ? [
     'budgetEdit__report--warn',
     'Stop budgeting this account?',
     'It stays in the list from this month onwards, with no budget and no figures. Its transactions are untouched.',
    ]
  : saved
  ? ['budgetEdit__report--ok', 'Budget updated', savedDetail]
  : unfieldedError
    ? ['budgetEdit__report--error', 'Not saved', unfieldedError]
    : isUnchanged && !isSaving
      ? [
         'budgetEdit__report--idle',
         'Nothing to save',
         'Change the amount, or how far it applies.',
        ]
      : ['budgetEdit__report--empty', null, null];

 // A read-only modal can close on any outside click; one holding typed input
 // cannot, so the overlay only closes a form nothing has been done to.
 const handleOverlayClick = () => {
  if (!isDirty && !isSaving) onClose();
 };

 // Portalled to body so it lands outside #root, which the effect above marks
 // inert. The overlay is position: fixed with inset: 0, so it takes the same
 // box wherever it is mounted — and mounting it here also frees it from any
 // ancestor transform, which would have made `fixed` resolve against that
 // ancestor instead of the viewport.
 return createPortal(
  <div
   className='budgetEdit'
   role='dialog'
   aria-modal='true'
   aria-labelledby={TITLE_ID}
   onClick={handleOverlayClick}
  >
   <div
    className='budgetEdit__panel'
    ref={panelRef}
    tabIndex={-1}
    onClick={(event) => event.stopPropagation()}
   >
    {/* The close control shares its row with what the panel is for, instead of
        sitting alone over an empty line. */}
    <div className='budgetEdit__header'>
     <span className='budgetEdit__heading'>Edit budget</span>

     <button
      type='button'
      className='budgetEdit__close'
      onClick={onClose}
      aria-label='Close budget editor'
      disabled={isSaving}
     >
      ✕
     </button>
    </div>

    <h2 id={TITLE_ID} className='budgetEdit__title'>
     {/* The caption names the value under it, the way every field of the
         creation form does, and the month rides the same line rather than
         spending one of its own. 'Subcategory' and not 'Account': that is the
         column this row belongs to at level 2. */}
     <span className='budgetEdit__captionRow'>
      <span className='budgetEdit__caption'>Subcategory</span>
      <span className='budgetEdit__month'>{formatMonth(month)}</span>
     </span>

     <span className='budgetEdit__name'>
      {accountName}
      {nature && <span className='budgetEdit__nature'>{nature}</span>}
     </span>
    </h2>

    {/* What the amount is being decided against. Read-only: this form writes
        the budget and nothing else. */}
    <dl className='budgetEdit__context'>
     {/* 'Current budget' and not 'Current': level 3 already prints a Current
         Balance, and the two are different figures on the same screen. Paired
         with the New budget field below, which is what replaces it. */}
     <div className='budgetEdit__contextRow'>
      <dt
       className='budgetEdit__contextLabel'
       title='The amount in force this month. It carries forward from the last month it was set, so there need not be an entry for this one.'
      >
       Current budget
      </dt>
      <dd className='budgetEdit__contextValue'>{asMoney(currentAmount)}</dd>
     </div>

     <div className='budgetEdit__contextRow'>
      <dt className='budgetEdit__contextLabel'>Spent</dt>
      <dd className='budgetEdit__contextValue'>{asMoney(actualSpent)}</dd>
     </div>

     <div className='budgetEdit__contextRow'>
      <dt className='budgetEdit__contextLabel budgetEdit__contextLabel--status'>
       {!unbudgeted && (
        <StatusSquare
         alert={budgetSquareState(executionPercentage, isOverBudget)}
        />
       )}
       {isOver ? 'Over' : 'Left'}
      </dt>
      {/* The excess is the one figure in this strip that is a warning, and the
          square alone is 12px of colour beside a black number. */}
      <dd
       className={`budgetEdit__contextValue${isOver ? ' budgetEdit__contextValue--over' : ''}`}
      >
       {asMoney(Math.abs(remainingBudget))}
      </dd>
     </div>
    </dl>

    <form className='budgetEdit__form' onSubmit={handleSubmit}>
     {/* The approximation rides the label's line and not a row of its own, the
         way the tracker's top card carries it beside its own label. */}
     <div className='budgetEdit__labelRow'>
      <label className='budgetEdit__label' htmlFor='budgetEditAmount'>
       New budget
      </label>

      {targetCurrencyPreview && (
       <RateTooltip
        tipText={rateTooltip}
        surface='light'
        placement='anchor-left'
       >
        <span className='budgetEdit__rate'>{targetCurrencyPreview}</span>
       </RateTooltip>
      )}

      {/* Beside the label that owns the field, not at the foot of the form:
          a message far from its input makes the reader hunt for what to fix. */}
      {issueFor('amount') && (
       <span className='budgetEdit__error' role='alert'>
        {issueFor('amount')}
       </span>
      )}
     </div>

     {/* The badge shares the line rather than sitting under it: the amount and
         the currency it is stated in are one figure. */}
     <div className='budgetEdit__amountRow'>
      {/* min='0' and not 0.01: the schema is nonnegative and a zero is how
          "stop budgeting" is expressed, so the client must be able to send it. */}
      {/* type='text' and not 'number': the number input accepts '3200e90' and
          reports it a finite value, so every guard below passed it. The pattern
          is what defines a plain amount now, and inputMode still brings up the
          numeric keypad. */}
      <input
       id='budgetEditAmount'
       ref={amountRef}
       className='budgetEdit__input'
       type='text'
       inputMode='decimal'
       maxLength={MAX_AMOUNT_LENGTH}
       placeholder={String(currentAmount)}
       value={amount}
       onChange={(event) => {
        const next = event.target.value;
        if (!PLAIN_DECIMAL.test(next)) return;
        setAmount(next);
        clearSaved();
       }}
       disabled={isSaving}
       autoComplete='off'
      />

      {/* Cycles the currency the amount is stated in. What it picks is sent, so
          moving it alone already makes the form saveable. */}
      <CurrencyBadge
       variant={VARIANT_DEFAULT}
       currency={originCurrency}
       updateOutsideCurrencyData={(next: CurrencyType) => {
        setOriginCurrency(next);
        clearSaved();
       }}
       disabled={isSaving}
      />
     </div>

     {/* One line, always present, whatever it has to say. */}
     <p className='budgetEdit__note'>{amountNote ?? ' '}</p>


     {/* A fieldset because the three are one question, and because its
         disabled attribute covers every control inside it. */}
     <fieldset className='budgetEdit__range' disabled={isSaving}>
      <legend className='budgetEdit__label budgetEdit__legend'>
       Applies to
       {issueFor('appliesUntil') && (
        <span className='budgetEdit__error' role='alert'>
         {issueFor('appliesUntil')}
        </span>
       )}
      </legend>

      {/* Tiles rather than radio dots, which is how the app already asks a
          closed question — the Category Nature row of the creation form. The
          input stays a radio: the arrow-key behaviour and the group semantics
          are the reason, and no button can be made to imitate them. */}
      <div className='budgetEdit__tiles'>
       {RANGE_MODES.map(({ value, label }) => (
        <label className='budgetEdit__tile' key={value}>
         <input
          className='budgetEdit__tileInput'
          type='radio'
          name='budgetEditRange'
          checked={rangeMode === value}
          onChange={() => {
           setRangeMode(value);
           clearSaved();
          }}
         />
         {label}
        </label>
       ))}

       {/* Inside the grid so it can take the 'Until…' column, and beside the
           labels rather than inside one: a control nested in a label joins that
           label's accessible name.
           Always rendered and only hidden: mounting it on the tile made the row
           appear and disappear under the pointer, moving everything below it.
           visibility takes it out of the accessible tree as well, and disabled
           keeps it out of the tab order while it is not the answer. */}
       <select
        className={`budgetEdit__select${rangeMode === 'untilMonth' ? '' : ' budgetEdit__select--idle'}`}
        value={untilMonth}
        onChange={(event) => {
         setUntilMonth(event.target.value);
         clearSaved();
        }}
        disabled={rangeMode !== 'untilMonth'}
        aria-label='Last month the amount applies to'
       >
        {rangeOptions.map((option) => (
         <option key={option} value={option}>
          {formatMonth(option)}
         </option>
        ))}
       </select>
      </div>
     </fieldset>

     {/* One region for the outcome of the last attempt, in both directions: a
         confirmation and a refusal no field claimed are the same kind of fact,
         and as two blocks they each moved the panel when they appeared.
         Always mounted and only hidden, so it holds its own height, and a live
         region has to exist before its content changes or the announcement is
         missed.
         aria-live and not role='alert': a result the user asked for, and an
         assertive announcement would cut off whatever is being read. */}
     <div
      className={`budgetEdit__report ${reportTone}`}
      aria-live='polite'
     >
      <p className='budgetEdit__reportTitle'>{reportTitle ?? ' '}</p>
      <p className='budgetEdit__reportDetail'>{reportDetail ?? ' '}</p>
     </div>

     {/* One way out once the write landed, and it is the emphasised one. Two
         buttons with the filled half disabled points at a dead control and
         leaves the live path looking secondary — which is what made the panel
         read as stuck.
         The panel is not closed for the user: the confirmation states what the
         month after the range goes back to, and that is not on any screen
         behind it. Editing anything clears `saved` and the pair returns, so a
         correction costs nothing. */}
     <div className='budgetEdit__actions'>
      {saved ? (
       <button
        type='button'
        className='budgetEdit__button budgetEdit__button--primary'
        onClick={onClose}
       >
        Done
       </button>
      ) : isConfirmingRemoval ? (
       /* The trio is replaced, not extended. A question with three answers on
          screen is a question with an ambiguous default, and the way back has
          to be as reachable as the way through. */
       <>
        <button
         type='button'
         className='budgetEdit__button budgetEdit__button--secondary'
         onClick={() => setIsConfirmingRemoval(false)}
         disabled={isSaving}
        >
         Keep budget
        </button>

        <button
         type='button'
         className='budgetEdit__button budgetEdit__button--danger'
         onClick={handleRemove}
         disabled={isSaving}
        >
         {isSaving ? 'Removing…' : 'Remove budget'}
        </button>
       </>
      ) : (
       <>
        {/* First in the row and never beside Save: a destructive control
            against the emphasised one is a misclick waiting for a hurried
            hand. type='button' is load-bearing — inside a <form> the default
            is submit, and this one must not write anything by itself. */}
        {canRemove && (
         <button
          type='button'
          className='budgetEdit__button budgetEdit__button--danger'
          onClick={() => setIsConfirmingRemoval(true)}
         >
          Remove budget
         </button>
        )}

        <button
         type='button'
         className='budgetEdit__button budgetEdit__button--secondary'
         onClick={onClose}
         disabled={isSaving}
        >
         Cancel
        </button>

        <button
         type='submit'
         className='budgetEdit__button budgetEdit__button--primary'
         disabled={!canSave}
        >
         {isSaving ? 'Saving…' : 'Save'}
        </button>
       </>
      )}
     </div>
    </form>
   </div>
  </div>,
  document.body,
 );
}

export default BudgetEditModal;
