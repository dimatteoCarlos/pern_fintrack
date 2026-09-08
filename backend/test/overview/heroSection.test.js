// Contract tests for the hero section.
//
// The identity in the first test is the one check that catches the sign trap:
// the live by-type endpoint emits the payable leg negative and this contract
// declares it a positive magnitude. Get it backwards and a subtraction becomes
// an addition, which passes review because the figure still looks plausible —
// but net worth minus liquid net worth stops equalling the receivable leg.

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeHeroSection } from '../../src/fintrack_api/services/overview_services/core/makeHeroSection.js';

const base = {
 bankBalance: 1000,
 freeCash: 600,
 investmentBalance: 500,
 payable: 0,
 incomeTotal: 800,
 expenseTotal: 300,
 currency: 'usd',
};

test('net worth less liquid net worth is the receivable leg', () => {
 const hero = makeHeroSection({ ...base, debtPosition: 150, payable: 50 });

 assert.equal(hero.netWorth, 1650);
 assert.equal(hero.liquidNetWorth, 1450);
 assert.equal(hero.netWorth - hero.liquidNetWorth, 200);
});

test('with only money owed to the owner, the liquid figure is the lower one', () => {
 const hero = makeHeroSection({ ...base, debtPosition: 200, payable: 0 });

 assert.ok(hero.liquidNetWorth < hero.netWorth);
 assert.equal(hero.netWorth - hero.liquidNetWorth, 200);
});

test('with only money the owner owes, the two figures are equal', () => {
 const hero = makeHeroSection({ ...base, debtPosition: -80, payable: 80 });

 assert.equal(hero.netWorth, hero.liquidNetWorth);
});

test('with no debt at all, the two figures are equal', () => {
 const hero = makeHeroSection({ ...base, debtPosition: 0, payable: 0 });

 assert.equal(hero.netWorth, hero.liquidNetWorth);
});

test('a missing payable leg withholds the liquid figure with a notice', () => {
 const hero = makeHeroSection({ ...base, debtPosition: 10, payable: undefined });

 // null and not 0: a figure that cannot be computed is absent, because 0 is a
 // real answer that a client would render as a real answer.
 assert.equal(hero.liquidNetWorth, null);
 assert.ok(hero.meta.notices.length > 0);
});

test('free cash of zero is published as zero, not withheld', () => {
 const hero = makeHeroSection({ ...base, debtPosition: 0, payable: 0, freeCash: 0 });

 assert.equal(hero.freeCash, 0);
});

test('free cash may exceed the cash position', () => {
 // One account overdrawn and another not: the balance takes the negative and
 // the per-account floor gives free cash a zero for it. The pair looking wrong
 // is the only signal that says an account is overdrawn.
 const hero = makeHeroSection({ ...base, bankBalance: 100, freeCash: 400, debtPosition: 0, payable: 0 });

 assert.ok(hero.freeCash > hero.cashPosition);
});

test('the cash position is the bank balance and net worth has three terms', () => {
 const hero = makeHeroSection({ ...base, bankBalance: 1000, freeCash: 600, debtPosition: 0, payable: 0 });

 // No pocket term in either. A pocket is a plan and the money stays inside the
 // bank account, so adding it counts the same money twice.
 assert.equal(hero.cashPosition, 1000);
 assert.equal(hero.netWorth, 1500);
});

test('no income withholds the savings rate and still publishes the flow', () => {
 const hero = makeHeroSection({ ...base, debtPosition: 0, payable: 0, incomeTotal: 0, expenseTotal: 200 });

 assert.equal(hero.savingsRate, null);
 assert.equal(hero.netMonthlyFlow, -200);
});
