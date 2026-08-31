//-------DebtsBigBoxResult---------
//Parent:DebtsLayout.tsx
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';
import { CurrencyType } from '../../../types/types';

// A figure the answer did not carry. Never 0: on a debts board a zero is a
// balance and a zero count is a statement about the owner's debtors, and
// neither of them means 'the server did not send this field'.
const DASH = '—';

type BigBoxResultPropType = {
  // Nullable per field, as the endpoint declares them. A field the answer
  // omitted used to be coalesced to 0 by the layout and printed as $0.00.
  bigScreenInfo: { title: string; amount: number | null }[];
  currency: CurrencyType | undefined;
};

// Rewritten 2026-08-31 against Carlos's decision on the panel's hierarchy: a
// net does not distinguish "owed 550" from "owed 1,750 and owing 2,300" —
// opposite positions behind the same −550 — so the net cannot be the figure
// that summarises the panel. The two directions are the primary indicators
// now; the net is a derived, visually subordinate third line beneath them.
// Data and query untouched: every figure here was already served and already
// rendered, this only changes which markup carries which weight.
export function DebtsBigBoxResult({
  bigScreenInfo,
  currency,
}: BigBoxResultPropType) {
  //temporary values------------
  const defaultCurrency = currency ?? DEFAULT_CURRENCY;
  const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];

  const formatAmount = (amount: number | null) =>
    amount === null
      ? DASH
      : currencyFormat(defaultCurrency, amount, formatNumberCountry);

  const netAmount = bigScreenInfo[0].amount;

  const owedLabel = bigScreenInfo[1].title;
  const owedAmount = bigScreenInfo[1].amount;

  const debtors = bigScreenInfo[2].title;
  const debtorCount = bigScreenInfo[2].amount;

  const oweLabel = bigScreenInfo[3].title;

  // The magnitude of what is owed, and only here. The server sums the negative
  // balances and serves the payable negative, which is the accounting truth and
  // does not move; the label beside this figure already carries the direction in
  // words, so printing the sign as well asks the reader to apply two conventions
  // at once. Presentation is not accounting representation.
  const oweAmount =
    bigScreenInfo[3].amount === null ? null : Math.abs(bigScreenInfo[3].amount);

  const lenders = bigScreenInfo[4].title;
  const creditorCount = bigScreenInfo[4].amount;

  return (
    <div className='bigBox__container flex-col-sb'>
      {/* Static, not the net's sign: with the two directions stated below in
          their own words, a title that also claimed a direction would be a
          second, redundant assertion — and the wrong one whenever the net's
          sign disagreed with the position the reader actually cares about. */}
      <div className='bigBox__mainInfo'>{'debts'.toUpperCase()}</div>

      {/* LEVEL 1 — the two primary indicators. Each carries its own
          direction unconditionally: owed-to-the-owner and owed-by-the-owner
          are not two readings of one sign, they are two different figures. */}
      <div className='debtsHero__primary'>
        <div className='debtInfo debtsHero__primaryRow'>
          <div className='displayScreen--concept light'>{owedLabel}</div>
          <div className='displayScreen--result light'>
            {formatAmount(owedAmount)}
          </div>

          <div className='displayScreen--concept light debtsHero__primaryMeta'>
            {debtors}:
          </div>
          <div className='displayScreen--result light debtsHero__primaryMeta'>
            {debtorCount ?? DASH}
          </div>
        </div>

        <div className='debtInfo debtsHero__primaryRow'>
          <div className='displayScreen--concept light'>{oweLabel}</div>
          <div className='displayScreen--result light'>
            {formatAmount(oweAmount)}
          </div>

          <div className='displayScreen--concept light debtsHero__primaryMeta'>
            {lenders}:
          </div>
          <div className='displayScreen--result light debtsHero__primaryMeta'>
            {creditorCount ?? DASH}
          </div>
        </div>
      </div>

      {/* LEVEL 2 — the net, derived from the two above and demoted beneath
          them: smaller, muted, and no longer the panel's headline. */}
      <div className='debtsHero__net'>
        <span className='debtsHero__netLabel'>Net</span>
        <span className='debtsHero__netValue'>{formatAmount(netAmount)}</span>
      </div>
    </div>
  );
}

export default DebtsBigBoxResult;
