// frontend/src/fintrack/general_components/panelTotal/PanelTotal.tsx
//
// One figure over a list: what the rows below add up to, said once, above them.
//
// IT NEVER ADDS ANYTHING. The amount arrives as a prop and the caller reads it
// off the payload. A total summed in the browser is a second answer to a
// question the server already answered, and the two disagree the moment the
// list is paged, filtered, or cut at a different date than the total was.
//
// It lives in general_components/ because the two account panels of Overview
// want it today and every paged list of level 2 wants it next: a list with a
// count under it and no total above it is the shape all of them share.

import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../../helpers/constants';
import { currencyFormat } from '../../helpers/functions';

import './styles/panelTotal-styles.css';

// The grouping and decimal marks, which are a locale and not a currency: the
// currency of the figure arrives with the figure.
const formatNumberCountry = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// A figure that has not arrived, or one the server declined to report. Never a
// zero, which is a real total and would state that the accounts hold nothing.
const NO_FIGURE = '—';

type PanelTotalProps = {
 // What the figure IS, in the reader's words. It carries the scope when the
 // scope is not obvious from the list underneath.
 label: string;
 amount: number | null;
 // From the payload, never from a constant: a component naming its own currency
 // can label a figure with a currency the figure is not in.
 currency: string;
 // When the figure was measured, or anything else the reader needs to reconcile
 // it with the rows. Omitted when there is nothing to say.
 note?: string | null;
 // 'stacked' is the block over the list: label and amount on one line, the note
 // spanning both columns under them.
 //
 // 'inline' is the same three values on ONE line, for a caller that puts the
 // total beside a heading instead of above a list. Carlos asked for the two
 // account panels to carry their sum next to the panel's name, 2026-09-10, and
 // the figure was already here - one row below where he wanted to read it.
 //
 // A VARIANT AND NOT A SECOND COMPONENT, because the rule that matters is the
 // one both forms share: the amount arrives as a prop and a null renders as a
 // dash. Copying the markup would copy the formatting and eventually lose that.
 variant?: 'stacked' | 'inline';
};

export const PanelTotal = ({
 label,
 amount,
 currency,
 note,
 variant = 'stacked',
}: PanelTotalProps) => (
 <div className={`panelTotal panelTotal--${variant}`}>
  <span className='panelTotal__label'>{label}</span>

  <span className='panelTotal__amount'>
   {amount === null ? NO_FIGURE : currencyFormat(currency, amount, formatNumberCountry)}
  </span>

  {note && <span className='panelTotal__note'>{note}</span>}
 </div>
);
