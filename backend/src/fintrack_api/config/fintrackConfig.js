// backend/src/fintrack_api/config/fintrackConfig.js

// 🌐 Accounting fintrack configuration

// Accounting currency (the currency used for ledger and balances)
export const ACCOUNTING_CURRENCY_CODE = process.env.ACCOUNTING_CURRENCY_CODE || 'usd';

// How far back an operative date may be placed, counted in whole calendar
// months that include the current one: 1 is the current month alone, 2 also
// opens the previous month. Both the movement date and the account opening day
// read this, so the two cannot drift into separate policies for one concept.
//
// A garbled or absent value falls back to the default rather than throwing:
// this decides what a form may offer, not whether the server can start.
const configuredBackdatingWindow = Number.parseInt(
 process.env.BACKDATING_WINDOW_MONTHS ?? '',
 10,
);

export const BACKDATING_WINDOW_MONTHS =
 Number.isInteger(configuredBackdatingWindow) && configuredBackdatingWindow >= 1
  ? configuredBackdatingWindow
  : 2;


