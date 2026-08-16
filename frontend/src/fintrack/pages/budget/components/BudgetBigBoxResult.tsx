//-------BudgetBigBoxResult---------
//Parent:BudgetLayout.tsx
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../../helpers/constants';
import { currencyFormat } from '../../../helpers/functions';
import { CurrencyType } from '../../../types/types';
import { StatusSquare } from '../../../general_components/boxComponents/BoxComponents';

// Named, not positional. The array this replaced was read by index, and its
// third entry — the spending — was built by the parent and never rendered.
//
// Every amount is nullable because the contract withholds them in two cases:
// the answer is still on the wire, or the accounts hold more than one currency
// and V1 refuses to add them. Neither of those is an amount of zero.
type BudgetHeroPropType = {
  budgetAmount: number | null;
  actualSpent: number | null;
  remainingBudget: number | null;
  // Served by the module, never recomputed here. null when the budget is 0:
  // there is no percentage of zero, and its absence is the fact.
  executionPercentage: number | null;
  currency: CurrencyType | null | undefined;
  // Resolved by the parent, so the two squares below cannot disagree. null
  // while the answer is on the wire and in the mixed-currency case.
  isOverBudget: boolean | null;
  // Why the figures read as dashes, in the server's own words. null when there
  // is nothing to explain.
  notice: string | null;
};

const MISSING = '—';

function BudgetBigBoxResult({
  budgetAmount,
  actualSpent,
  remainingBudget,
  executionPercentage,
  currency,
  isOverBudget,
  notice,
}: BudgetHeroPropType) {
  const currency_code = currency ?? DEFAULT_CURRENCY;
  const formatNumberCountry = CURRENCY_OPTIONS[currency_code];

  const amount = (value: number | null) =>
    value === null
      ? MISSING
      : currencyFormat(currency_code, value, formatNumberCountry);

  // The remaining share is derived from the served percentage rather than
  // recomputed over the amounts: |100 - execution| is the same figure and it
  // inherits the server's rounding instead of introducing a second one.
  const share = (value: number | null) =>
    value === null ? MISSING : `${Math.abs(value).toFixed(1)}%`;

  const spentShare = share(executionPercentage);
  const remainingShare = share(
    executionPercentage === null ? null : 100 - executionPercentage,
  );

  return (
    <div className='total__container flex-col-sb'>
      <div className='total__amount'>{amount(budgetAmount)}</div>

      <div className='displayScreen__rows'>
        <div className={`flex-row-sb displayScreen ${'light'}`}>
          <div className={`displayScreen--concept ${'dark'}`}>Spent</div>

          <div className={`displayScreen--result ${'dark'}`}>
            {amount(actualSpent)}
            <span className='displayScreen__percentage'>{spentShare}</span>
          </div>
        </div>

        <div className={`flex-row-sb displayScreen ${'light'}`}>
          <div className={`displayScreen--concept ${'dark'}`}>
            Remaining
            {isOverBudget !== null && (
              <StatusSquare alert={isOverBudget ? 'alert' : ''} />
            )}
          </div>

          <div className={`displayScreen--result ${'dark'}`}>
            {amount(remainingBudget)}
            <span className='displayScreen__percentage'>{remainingShare}</span>
          </div>
        </div>
      </div>

      {notice && <p className='displayScreen__notice'>{notice}</p>}
    </div>
  );
}

export default BudgetBigBoxResult;
