//-------PocketBigBoxResult---------
//Parent: PocketLayout.tsx
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';
import { CurrencyType } from '../../../types/types';

// Named, not positional. The array this replaced was read by index, and its
// third entry — the saved amount — was built by the parent and never rendered
// at all, under the title 'expenses'.
//
// Every amount is nullable because the contract withholds them in three cases:
// the answer is still on the wire, the user owns no pocket, or the pockets are
// kept in more than one currency and the module refuses to add them at an
// implicit 1:1. None of those is an amount of zero.
type PocketHeroPropType = {
  totalTarget: number | null;
  totalRemaining: number | null;
  currency: CurrencyType | null | undefined;
  // Why the figures read as dashes, in the server's own words. null when there
  // is nothing to explain.
  notice: string | null;
};

const MISSING = '—';

function PocketBigBoxResult({
  totalTarget,
  totalRemaining,
  currency,
  notice,
}: PocketHeroPropType) {
  const currency_code = currency ?? DEFAULT_CURRENCY;
  const formatNumberCountry = CURRENCY_OPTIONS[currency_code];

  const amount = (value: number | null) =>
    value === null
      ? MISSING
      : currencyFormat(currency_code, value, formatNumberCountry);

  // The server withheld the totals and said why. The sentence is the answer, so
  // it stands where the figures would: printing dashes above it repeats in
  // symbols what the line below is about to say in words, and a dash cannot
  // tell the reader which of the absences it is. Same shape as the budget hero.
  if (notice) {
    return (
      <div className='total__container flex-col-sb'>
        <p className='displayScreen__notice'>{notice}</p>
      </div>
    );
  }

  // The headline is still the TARGET, which is what it has always been. The
  // saved amount and the relabelling that makes this readable are the next
  // commit; this one only changes where the number comes from.
  return (
    <div className='total__container flex-col-sb'>
      <div className='total__amount'>{amount(totalTarget)}</div>

      <div className={`flex-row-sb displayScreen ${'light'}`}>
        <div className={`displayScreen--concept ${'dark'}`}>Remaining</div>

        <div className={`displayScreen--result ${'dark'}`}>
          {amount(totalRemaining)}
        </div>
      </div>
    </div>
  );
}

export default PocketBigBoxResult;
