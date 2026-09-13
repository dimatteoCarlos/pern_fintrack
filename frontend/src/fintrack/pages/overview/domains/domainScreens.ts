// frontend/src/fintrack/pages/overview/domains/domainScreens.ts
//
// The six level-2 screens. Each entry declares its reader-facing name, what its
// headline figure is, and the composition drawn between the heading and the list.
//
// The key order is the order the unknown-domain screen names them in.

import DebtDomain from './DebtDomain';
import ExpenseDomain from './ExpenseDomain';
import IncomeDomain from './IncomeDomain';
import InvestmentDomain from './InvestmentDomain';
import PnlDomain from './PnlDomain';
import PocketDomain from './PocketDomain';
import { DomainScreens } from './domainScreen';

const MOVEMENTS_LIST = { title: 'Movements', itemLabel: 'movements' };

export const DOMAIN_SCREENS: DomainScreens = {
 income: {
  label: 'Income',
  headline: { nature: 'this month', amountOf: (card) => card.totalAmount },
  list: MOVEMENTS_LIST,
  Composition: IncomeDomain,
 },
 expense: {
  label: 'Expense',
  headline: { nature: 'this month', amountOf: (card) => card.totalAmount },
  list: MOVEMENTS_LIST,
  Composition: ExpenseDomain,
 },
 investment: {
  label: 'Investment',
  // The card has no totalAmount: its figure is the ledger balance at the close.
  headline: { nature: 'at month end', amountOf: (card) => card.ledgerBalance },
  list: MOVEMENTS_LIST,
  Composition: InvestmentDomain,
 },
 debt: {
  label: 'Debt',
  // The net of the two legs, each measured at the month's close.
  headline: { nature: 'at month end', amountOf: (card) => card.totalAmount },
  list: MOVEMENTS_LIST,
  Composition: DebtDomain,
 },
 pocket: {
  label: 'Pockets',
  // The committed total at the close, cumulative rather than the month's own.
  headline: { nature: 'at month end', amountOf: (card) => card.totalAmount },
  // A pocket moves no money: its page is the month's allocations.
  list: { title: 'Allocations', itemLabel: 'allocations' },
  Composition: PocketDomain,
 },
 pnl: {
  // 'pnl' is a column name; nobody calls the domain that.
  label: 'Realised result',
  headline: { nature: 'this month', amountOf: (card) => card.totalAmount },
  list: MOVEMENTS_LIST,
  Composition: PnlDomain,
 },
};
