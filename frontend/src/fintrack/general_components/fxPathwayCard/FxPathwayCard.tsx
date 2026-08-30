// frontend/src/fintrack/general_components/fxPathwayCard/FxPathwayCard.tsx
// 💱 FX PATHWAY: the proof that a conversion ran, and the rate it ran at.
//
// Extracted from the account movement's detail modal so the pocket's allocation
// history can show the same block. It is presentational: it holds the reading
// rules and owns none of the data.
//
// It lives in general_components rather than beside either caller because both
// callers are pages in different trees, and a shared piece inside one of them
// would make the other import from a page that is not its own.
//
// **The rate is not an amount and is never printed through a money formatter.**
// A rate rounded to two — or four — decimals cannot be re-applied to the stored
// figure and checked against it, which is the only thing this block is for. It
// is printed exactly as it was stored.
//
// It renders nothing when no conversion happened. A figure typed in the
// accounting currency has no pathway, and a card announcing an exchange that
// did not occur is worse than no card.

import { numberFormatCurrency } from '../../helpers/functions';
import {
 CURRENCY_OPTIONS,
 DEFAULT_CURRENCY,
} from '../../helpers/currencyConstants';
import { DATE_TEXT_FORMAT } from '../../helpers/constants';

import './styles/fxPathwayCard-styles.css';

// The accounting currency's number format. Grouping and decimal separator come
// from here; the symbol comes from the code of the figure being rendered.
const AMOUNT_LOCALE = CURRENCY_OPTIONS[DEFAULT_CURRENCY];

// A field the API left null has no answer. Never 0, which would be a figure.
const MISSING_VALUE = '—';

// The moment the provider stamped the rate, rendered as a moment. This one IS
// an instant and not a calendar day: it is when the rate was locked, which
// happened at a point in time and not on anybody's calendar, so reading it
// through the browser's own clock is correct here and only here.
const formatInstantStamp = (value: string | Date) => {
 const instant = new Date(value);
 if (Number.isNaN(instant.getTime())) return MISSING_VALUE;

 const datePart = instant.toLocaleDateString(DATE_TEXT_FORMAT, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
 });
 const timePart = instant.toLocaleTimeString(DATE_TEXT_FORMAT, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
 });

 return `${datePart} · ${timePart}`;
};

type FxPathwayCardPropType = {
 // What the owner typed, in the unit they typed it in.
 originalAmount: number | null;
 originalCurrency: string | null;
 // What was stored, in the currency the record is kept in.
 storedAmount: number;
 accountingCurrency: string;
 // Kept at full precision on purpose — see the note above.
 exchangeRate: number | null;
 // When the rate was locked. An instant stamped by the provider, not a day on
 // anyone's calendar, so it is rendered as one. It arrives as a string from
 // the pocket contract and as a Date from the transaction one, and both are
 // the same moment.
 exchangeRateTimestamp?: string | Date | null;
 // Which provider answered. Absent on records written before the field
 // existed, and then simply not shown.
 exchangeRateSource?: string | null;
};

function FxPathwayCard({
 originalAmount,
 originalCurrency,
 storedAmount,
 accountingCurrency,
 exchangeRate,
 exchangeRateTimestamp,
 exchangeRateSource,
}: FxPathwayCardPropType) {
 // A conversion happened when the figure was entered in a currency other than
 // the one the record is kept in. Compared case-insensitively because the
 // server serves lowercase codes and older payloads carry upper.
 const hasConversion = Boolean(
  originalCurrency &&
   originalCurrency.toLowerCase() !== accountingCurrency.toLowerCase(),
 );

 if (!hasConversion) return null;

 const originCode = (originalCurrency ?? '').toUpperCase();
 const targetCode = accountingCurrency.toUpperCase();

 // Absolute on both ends: the pathway states that a conversion happened, and
 // its direction is carried by the arrow rather than by a sign printed twice.
 const from = `${numberFormatCurrency(
  Math.abs(originalAmount ?? 0),
  2,
  originalCurrency ?? undefined,
  AMOUNT_LOCALE,
 )} ${originCode}`;

 const to = `${numberFormatCurrency(
  Math.abs(storedAmount),
  2,
  accountingCurrency,
  AMOUNT_LOCALE,
 )} ${targetCode}`;

 // The rate as stored, with the direction it was stored in, at whatever
 // precision the column kept. Number.toString drops no significant digit and
 // adds none.
 const storedRateLabel =
  exchangeRate !== null && exchangeRate !== undefined
   ? `${exchangeRate} · ${originCode} → ${targetCode}`
   : MISSING_VALUE;

 // The reading a person expects, which is the inverse of how it is stored. Two
 // decimals is right HERE and only here: this line is for reading, and the line
 // above is the one that has to be re-applicable.
 const readableRateLabel =
  exchangeRate && exchangeRate > 0
   ? `1 ${targetCode} = ${numberFormatCurrency(
      1 / exchangeRate,
      2,
      undefined,
      AMOUNT_LOCALE,
     )} ${originCode}`
   : MISSING_VALUE;

 const lockLabel = exchangeRateTimestamp
  ? formatInstantStamp(exchangeRateTimestamp)
  : MISSING_VALUE;

 return (
  <section className='fxPathway'>
   <h3 className='fxPathway__title'>Foreign Exchange</h3>

   <div className='fxPathway__route'>
    <span>{from}</span>

    <svg
     className='fxPathway__arrow'
     aria-hidden='true'
     viewBox='0 0 24 24'
     fill='none'
     stroke='currentColor'
     strokeWidth='2'
     strokeLinecap='round'
     strokeLinejoin='round'
    >
     <line x1='5' y1='12' x2='19' y2='12' />
     <polyline points='12 5 19 12 12 19' />
    </svg>

    <span>{to}</span>
   </div>

   <div className='fxPathway__row'>
    <span className='fxPathway__label'>Exchange Rate</span>
    <span className='fxPathway__value'>{readableRateLabel}</span>
   </div>

   <div className='fxPathway__row'>
    <span className='fxPathway__label'>Rate Lock</span>
    <span className='fxPathway__value'>{lockLabel}</span>
   </div>

   <div className='fxPathway__row'>
    <span className='fxPathway__label'>Rate Clean</span>
    <span className='fxPathway__value fxPathway__value--mono'>
     {storedRateLabel}
    </span>
   </div>

   {exchangeRateSource && (
    <div className='fxPathway__row'>
     <span className='fxPathway__label'>Source</span>
     <span className='fxPathway__value'>{exchangeRateSource}</span>
    </div>
   )}
  </section>
 );
}

export default FxPathwayCard;
