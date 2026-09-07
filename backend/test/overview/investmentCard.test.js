// Contract tests for the investment card.
//
// The three-term comparison this holds is a CHECK and not an identity: the left
// side enumerates movement types and the right side is the whole derived
// balance, so a row of any other type sits in one and not the other. These
// tests hold both outcomes — that it closes on the terms it claims, and that it
// reports rather than hides a term it does not.

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeInvestmentCard } from '../../src/fintrack_api/services/overview_services/core/makeInvestmentCard.js';

const base = {
 capitalContributed: 1000,
 ledgerBalance: 1100,
 realizedPnl: 100,
 closureAdjustment: 0,
 largestBalance: 700,
 daysSinceLastContribution: 12,
 currency: 'usd',
};

const emptyPortfolio = {
 ledgerBalance: 0,
 capitalContributed: 0,
 realizedPnl: 0,
 daysSinceLastContribution: null,
};

test('the two withheld-concentration cases are told apart by a field', () => {
 // Before the account count was published, a client reading that the
 // concentration figure is not reported could not tell an owner with no
 // investment account from one whose accounts hold nothing. Both notices say
 // which in words, and a client that renders figures rather than sentences had
 // nothing to branch on.
 const noAccounts = makeInvestmentCard({ ...base, ...emptyPortfolio, accountCount: 0, largestBalance: null });
 const noMoney = makeInvestmentCard({ ...base, ...emptyPortfolio, accountCount: 2, largestBalance: 0 });

 assert.equal(noAccounts.accountCount, 0);
 assert.equal(noAccounts.concentration, null);
 assert.equal(noMoney.accountCount, 2);
 assert.equal(noMoney.concentration, null);
 assert.notEqual(noAccounts.accountCount, noMoney.accountCount);
});

test('the three terms closing against the balance fires no notice', () => {
 const card = makeInvestmentCard({ ...base, accountCount: 2 });

 assert.equal(card.meta.notices.length, 0);
 assert.equal(card.accountCount, 2);
});

test('a balance the three terms do not account for fires one notice', () => {
 const card = makeInvestmentCard({ ...base, accountCount: 2, ledgerBalance: 1150 });

 assert.equal(card.meta.notices.length, 1);
});

test('the disagreement is reported as a sentence and never as a figure', () => {
 // The contract says the server publishes the terms and never the difference
 // between them: four published fields make the subtraction trivial, and a
 // client subtracting in floating point would find a cent the decimal
 // comparison did not and tell the owner their books are broken.
 const card = makeInvestmentCard({ ...base, accountCount: 2, ledgerBalance: 1150 });

 assert.equal(Object.hasOwn(card, 'reconciliationDifference'), false);
 assert.equal(card.ledgerBalance, 1150);
 assert.equal(card.capitalContributed, 1000);
 assert.equal(card.realizedPnl, 100);
 assert.equal(card.closureAdjustment, 0);
});

test('the closure adjustment is a real term of the comparison', () => {
 const card = makeInvestmentCard({
  ...base,
  accountCount: 1,
  closureAdjustment: -50,
  ledgerBalance: 1050,
  largestBalance: 1050,
 });

 assert.equal(card.meta.notices.length, 0);
 assert.equal(card.concentration, 1);
});

test('the card is frozen', () => {
 assert.equal(Object.isFrozen(makeInvestmentCard({ ...base, accountCount: 2 })), true);
});
